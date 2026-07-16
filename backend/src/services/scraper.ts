/**
 * In-process newsletter scraper service.
 *
 * Powers the admin portal's "Scrape" button and the weekly/daily scheduler.
 * Uses axios + cheerio only (no headless browser) so it runs safely inside
 * the web service; JS-heavy sites that need Puppeteer can still be scraped
 * with the local CLI script (npm run scrape).
 *
 * Design goals:
 * - INCREMENTAL: stops after hitting several already-stored editions in a
 *   row, so repeat runs only fetch what's new
 * - POLITE (anti-blocking): realistic browser headers, randomized delays
 *   between requests, per-run caps, immediate stop on 403/429
 * - OBSERVABLE: every step appends a log line to the ScrapeJob row that the
 *   admin portal displays live
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { prisma } from './db';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
const MAX_LINKS_PER_RUN = 60;      // How many candidate article links to consider
const MAX_NEW_PER_RUN = 25;        // Stop after saving this many new editions
const STOP_AFTER_CONSECUTIVE_KNOWN = 5; // Incremental cutoff
const REQUEST_TIMEOUT_MS = 20000;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 3500;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// Path fragments that are never article links
const SKIP_PATH_FRAGMENTS = [
  '/tag/', '/tags/', '/category/', '/categories/', '/author/', '/about',
  '/subscribe', '/login', '/signup', '/privacy', '/terms', '/contact',
  '/archive', '/search', '/page/', '/feed', '/rss', '/comments',
  '/cdn-cgi/', '/wp-admin', '/wp-login', 'mailto:', 'javascript:',
];

// In-memory guard: one running job per source per process
const runningSources = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function politeDelay(): Promise<void> {
  return sleep(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function contentHash(url: string, content: string): string {
  return crypto.createHash('sha256').update(url + content.substring(0, 500)).digest('hex');
}

class BlockedError extends Error {
  constructor(status: number) {
    super(`Source returned HTTP ${status} - likely rate-limited or blocking scrapers`);
  }
}

async function fetchPage(url: string): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      if (response.status === 403 || response.status === 429) {
        throw new BlockedError(response.status);
      }
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }
      return typeof response.data === 'string' ? response.data : '';
    } catch (error) {
      if (error instanceof BlockedError) throw error; // don't retry a block
      lastError = error instanceof Error ? error : new Error('fetch failed');
      if (attempt < 2) await sleep(2500);
    }
  }
  throw lastError || new Error('fetch failed');
}

/**
 * Discover candidate article links on an archive page.
 * Newest-first ordering is preserved from the document.
 */
function discoverArticleLinks(html: string, archiveUrl: string): string[] {
  const $ = cheerio.load(html);
  const archive = new URL(archiveUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const text = $(el).text().trim();
    if (!href || href.startsWith('#')) return;

    let resolved: URL;
    try {
      resolved = new URL(href, archiveUrl);
    } catch {
      return;
    }

    // Same site only (allow www <-> apex)
    const host = resolved.hostname.replace(/^www\./, '');
    const archiveHost = archive.hostname.replace(/^www\./, '');
    if (host !== archiveHost) return;
    if (!['http:', 'https:'].includes(resolved.protocol)) return;

    const path = resolved.pathname.toLowerCase();
    if (path === '/' || path === archive.pathname.toLowerCase()) return;
    if (SKIP_PATH_FRAGMENTS.some((frag) => path.includes(frag))) return;

    // Heuristic: article pages have a meaningful slug and linked text
    const slug = path.split('/').filter(Boolean).pop() || '';
    if (slug.length < 3) return;
    if (text.length < 5 && !/\d{4}/.test(slug)) return;

    resolved.hash = '';
    resolved.search = '';
    const clean = resolved.toString();
    if (!seen.has(clean)) {
      seen.add(clean);
      links.push(clean);
    }
  });

  return links.slice(0, MAX_LINKS_PER_RUN);
}

interface ExtractedArticle {
  title: string;
  text: string;
  html: string;
  publishedAt: Date;
}

/** Pull title, main content, and published date out of an article page. */
function extractArticle(html: string, url: string): ExtractedArticle | null {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, .sidebar, .comments, .related, .share-buttons, .subscribe-widget').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').text().split('|')[0].trim() ||
    url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ||
    'Untitled';

  let articleHtml = '';
  let articleText = '';
  const selectors = ['article', '.post-content', '.entry-content', '.body', 'main', '.content', '#content', '.post'];
  for (const sel of selectors) {
    const node = $(sel).first();
    const nodeHtml = node.html();
    if (nodeHtml && nodeHtml.length > 500) {
      articleHtml = nodeHtml;
      articleText = node.text().replace(/\s+/g, ' ').trim();
      break;
    }
  }
  if (!articleText) {
    articleText = $('body').text().replace(/\s+/g, ' ').trim();
    articleHtml = articleText;
  }
  if (articleText.length < 200) return null;

  const dateStr =
    $('time[datetime]').attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('.date, .post-date').first().text();

  let publishedAt = new Date();
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) publishedAt = parsed;
  }

  return { title: title.substring(0, 200), text: articleText, html: articleHtml, publishedAt };
}

async function appendLog(jobId: string, line: string): Promise<void> {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  try {
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { logs: { push: stamped } },
    });
  } catch (error) {
    console.error('[Scraper] Failed to append log:', error);
  }
}

export function isSourceScraping(sourceId: string): boolean {
  return runningSources.has(sourceId);
}

/**
 * Run a scrape job for one source. Designed to be fired asynchronously
 * (setImmediate) from a request handler - all progress lands on the
 * ScrapeJob row, never in the HTTP response.
 */
export async function runScrapeJob(sourceId: string, jobId: string): Promise<void> {
  if (runningSources.has(sourceId)) {
    await appendLog(jobId, 'Another scrape for this source is already running - aborted.');
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'failed', completedAt: new Date(), errorMessage: 'Source already being scraped' },
    });
    return;
  }
  runningSources.add(sourceId);

  let found = 0;
  let saved = 0;
  let skipped = 0;

  try {
    const source = await prisma.newsletterSource.findUnique({ where: { id: sourceId } });
    if (!source || !source.archiveUrl) {
      throw new Error('Source not found or has no archive URL');
    }

    await appendLog(jobId, `Scraping ${source.name} from ${source.archiveUrl}`);

    const archiveHtml = await fetchPage(source.archiveUrl);
    const links = discoverArticleLinks(archiveHtml, source.archiveUrl);
    found = links.length;
    await appendLog(jobId, `Found ${links.length} candidate article links`);
    await prisma.scrapeJob.update({ where: { id: jobId }, data: { editionsFound: found } });

    if (links.length === 0) {
      await appendLog(jobId, 'No article links found - this site may need the local browser scraper (npm run scrape).');
    }

    let consecutiveKnown = 0;

    for (const url of links) {
      if (saved >= MAX_NEW_PER_RUN) {
        await appendLog(jobId, `Reached per-run cap of ${MAX_NEW_PER_RUN} new editions - run again for more.`);
        break;
      }
      if (consecutiveKnown >= STOP_AFTER_CONSECUTIVE_KNOWN) {
        await appendLog(jobId, `Hit ${STOP_AFTER_CONSECUTIVE_KNOWN} already-stored editions in a row - caught up.`);
        break;
      }

      await politeDelay();

      let pageHtml: string;
      try {
        pageHtml = await fetchPage(url);
      } catch (error) {
        if (error instanceof BlockedError) throw error; // stop the whole run
        await appendLog(jobId, `Skipped (fetch failed): ${url}`);
        continue;
      }

      const article = extractArticle(pageHtml, url);
      if (!article) {
        await appendLog(jobId, `Skipped (no substantial content): ${url}`);
        continue;
      }

      const hash = contentHash(url, article.text);
      const existing = await prisma.edition.findUnique({ where: { contentHash: hash } });
      if (existing) {
        skipped++;
        consecutiveKnown++;
        continue;
      }
      consecutiveKnown = 0;

      await prisma.edition.create({
        data: {
          sourceId: source.id,
          subject: article.title,
          contentHash: hash,
          rawContent: article.html,
          textContent: article.text,
          publishedAt: article.publishedAt,
          receivedAt: new Date(),
          processingStatus: 'pending',
        },
      });
      saved++;
      await appendLog(jobId, `Saved: "${article.title.substring(0, 60)}" (${article.publishedAt.toISOString().slice(0, 10)})`);
      await prisma.scrapeJob.update({ where: { id: jobId }, data: { editionsNew: saved, editionsSkipped: skipped } });
    }

    // Finalize job + source bookkeeping
    const editionCount = await prisma.edition.count({ where: { sourceId } });
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: {
        lastScrapedAt: new Date(),
        lastScrapeStatus: 'success',
        lastScrapeError: null,
        totalEditions: editionCount,
      },
    });
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        editionsFound: found,
        editionsNew: saved,
        editionsSkipped: skipped,
      },
    });
    await appendLog(
      jobId,
      `Done. ${saved} new, ${skipped} already stored. ${saved > 0 ? `${saved} editions queued for insight extraction.` : ''}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await appendLog(jobId, `FAILED: ${message}`);
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        editionsNew: saved,
        editionsSkipped: skipped,
        errorMessage: message,
      },
    }).catch(() => {});
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { lastScrapedAt: new Date(), lastScrapeStatus: 'failed', lastScrapeError: message },
    }).catch(() => {});
  } finally {
    runningSources.delete(sourceId);
  }
}
