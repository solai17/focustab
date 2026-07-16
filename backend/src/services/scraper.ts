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
const MAX_LINKS_PER_PAGE = 60;     // Candidate article links per archive page
const MAX_ARCHIVE_PAGES = 10;      // How deep to paginate per run
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

  return links.slice(0, MAX_LINKS_PER_PAGE);
}

/** Read the page number out of a URL (?page=N or /page/N/), defaulting to 1. */
function pageNumberOf(url: URL): number {
  const fromQuery = parseInt(url.searchParams.get('page') || url.searchParams.get('p') || '', 10);
  if (!isNaN(fromQuery) && fromQuery > 0) return fromQuery;
  const match = url.pathname.match(/\/page\/(\d+)\/?$/i);
  if (match) return parseInt(match[1], 10);
  return 1;
}

/**
 * Find the "next page" link of an archive (multi-page archives like
 * beehiiv's ?page=2 or WordPress's /page/2/).
 * Tries, in order: rel="next", next/older link text, numeric pagination.
 */
function findNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const current = new URL(currentUrl);
  const currentHost = current.hostname.replace(/^www\./, '');

  const resolveSameSite = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      const resolved = new URL(href, currentUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) return null;
      if (resolved.hostname.replace(/^www\./, '') !== currentHost) return null;
      resolved.hash = '';
      const clean = resolved.toString();
      return clean !== currentUrl ? clean : null;
    } catch {
      return null;
    }
  };

  // 1. Explicit rel="next"
  const relNext =
    resolveSameSite($('a[rel="next"]').attr('href')) ||
    resolveSameSite($('link[rel="next"]').attr('href'));
  if (relNext) return relNext;

  // 2. Link text like "Next", "Older posts", "»", "→"
  let textNext: string | null = null;
  $('a[href]').each((_, el) => {
    if (textNext) return;
    const text = $(el).text().trim().toLowerCase();
    if (/^(next( page)?|older( posts| entries)?|more posts|»|›|→|>)$/.test(text) || text === 'load more') {
      textNext = resolveSameSite($(el).attr('href'));
    }
  });
  if (textNext) return textNext;

  // 3. Numeric pagination: a link whose page number is exactly current + 1
  const wantPage = pageNumberOf(current) + 1;
  let numericNext: string | null = null;
  $('a[href]').each((_, el) => {
    if (numericNext) return;
    const resolved = resolveSameSite($(el).attr('href'));
    if (!resolved) return;
    try {
      if (pageNumberOf(new URL(resolved)) === wantPage) numericNext = resolved;
    } catch {
      /* ignore */
    }
  });
  return numericNext;
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

    let consecutiveKnown = 0;
    let stopped = false;
    const seenArticleUrls = new Set<string>();
    const visitedPages = new Set<string>();
    let archivePageUrl: string | null = source.archiveUrl;

    // Walk paginated archives (page 1, 2, ...) until caught up or capped
    for (let pageNum = 1; pageNum <= MAX_ARCHIVE_PAGES && archivePageUrl && !stopped; pageNum++) {
      visitedPages.add(archivePageUrl);

      const archiveHtml = await fetchPage(archivePageUrl);
      const pageLinks = discoverArticleLinks(archiveHtml, source.archiveUrl)
        .filter((url) => !seenArticleUrls.has(url));
      pageLinks.forEach((url) => seenArticleUrls.add(url));
      found += pageLinks.length;

      await appendLog(jobId, `Archive page ${pageNum}: ${pageLinks.length} article links`);
      await prisma.scrapeJob.update({ where: { id: jobId }, data: { editionsFound: found } });

      if (pageNum === 1 && pageLinks.length === 0) {
        await appendLog(jobId, 'No article links found - this site may need the local browser scraper (npm run scrape).');
      }

      for (const url of pageLinks) {
        if (saved >= MAX_NEW_PER_RUN) {
          await appendLog(jobId, `Reached per-run cap of ${MAX_NEW_PER_RUN} new editions - run again for more.`);
          stopped = true;
          break;
        }
        if (consecutiveKnown >= STOP_AFTER_CONSECUTIVE_KNOWN) {
          await appendLog(jobId, `Hit ${STOP_AFTER_CONSECUTIVE_KNOWN} already-stored editions in a row - caught up.`);
          stopped = true;
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

      if (stopped) break;

      // Follow pagination (beehiiv ?page=2, WordPress /page/2/, rel=next, "Older posts")
      const nextPage = findNextPageUrl(archiveHtml, archivePageUrl);
      if (!nextPage || visitedPages.has(nextPage)) {
        if (pageNum > 1 || nextPage === null) {
          await appendLog(jobId, `No further archive pages after page ${pageNum}.`);
        }
        break;
      }
      if (pageNum === MAX_ARCHIVE_PAGES) {
        await appendLog(jobId, `Reached the ${MAX_ARCHIVE_PAGES}-page cap for this run - run again to go deeper.`);
        break;
      }
      await appendLog(jobId, `Following pagination -> ${nextPage}`);
      await politeDelay();
      archivePageUrl = nextPage;
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
