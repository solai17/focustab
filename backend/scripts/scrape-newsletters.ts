/**
 * Newsletter Scraper
 *
 * Scrapes newsletter archives and saves editions to the processing queue.
 * Processing happens via the queue system (Gemini with rate limiting).
 *
 * Newsletters:
 * 1. James Clear 3-2-1 - https://jamesclear.com/3-2-1
 * 2. Farnam Street Brain Food - https://fs.blog/brain-food/
 * 3. Sahil Bloom Curiosity Chronicle - https://www.sahilbloom.com/newsletter
 * 4. Alex and Books - https://alexandbooks.beehiiv.com/
 *
 * Usage:
 *   npm run scrape                    # Scrape all newsletters
 *   npm run scrape -- james           # Scrape only James Clear
 *   npm run scrape -- farnam sahil    # Scrape Farnam Street and Sahil Bloom
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../src/services/db';
import crypto from 'crypto';

// Configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const MAX_EDITIONS_PER_SOURCE = 1000; // High limit to get all editions (effectively no limit)

interface NewsletterConfig {
  name: string;
  senderEmail: string;
  website: string;
  archiveUrl: string;
  category: string;
  author: string;
  scraper: (config: NewsletterConfig) => Promise<EditionData[]>;
}

interface EditionData {
  subject: string;
  url: string;
  content: string;
  htmlContent?: string;
  publishedAt: Date;
  isSponsored?: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function fetchPage(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  [Attempt ${attempt}/${retries}] Failed to fetch ${url}: ${msg}`);
      if (attempt < retries) {
        await sleep(2000 * attempt);
      }
    }
  }
  return '';
}

function extractText(html: string): string {
  const $ = cheerio.load(html);
  // Remove scripts, styles, and navigation elements
  $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-–—]\s*/, '')
    .trim()
    .substring(0, 200);
}

// =============================================================================
// JAMES CLEAR 3-2-1 NEWSLETTER SCRAPER
// =============================================================================

async function scrapeJamesClear(config: NewsletterConfig): Promise<EditionData[]> {
  console.log(`\n[${config.name}] Starting scrape...`);
  const editions: EditionData[] = [];

  // James Clear lists all 3-2-1 editions on the main page
  const archiveHtml = await fetchPage(config.archiveUrl);
  if (!archiveHtml) return editions;

  const $ = cheerio.load(archiveHtml);
  const links: { url: string; title: string }[] = [];

  // Find all newsletter edition links
  // James Clear uses format: /3-2-1/month-day-year
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Match 3-2-1 newsletter links
    if (href.includes('/3-2-1/') && !href.endsWith('/3-2-1/') && !href.endsWith('/3-2-1')) {
      const fullUrl = href.startsWith('http') ? href : `https://jamesclear.com${href}`;
      if (!links.find(l => l.url === fullUrl)) {
        // Extract title from text or URL
        const title = text.length > 10 ? text : href.split('/').pop()?.replace(/-/g, ' ') || 'Newsletter';
        links.push({ url: fullUrl, title: cleanTitle(title) });
      }
    }
  });

  console.log(`[${config.name}] Found ${links.length} edition links`);

  // Scrape each edition
  const toScrape = links.slice(0, MAX_EDITIONS_PER_SOURCE);
  for (let i = 0; i < toScrape.length; i++) {
    const { url, title } = toScrape[i];
    console.log(`[${config.name}] Scraping ${i + 1}/${toScrape.length}: ${title.substring(0, 50)}...`);

    await sleep(DELAY_BETWEEN_REQUESTS);
    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const page$ = cheerio.load(pageHtml);

    // Remove unwanted elements
    page$('nav, header, footer, .sidebar, .related-posts, .comments, script, style').remove();

    // Extract article content
    const articleHtml = page$('article').html() ||
                        page$('.post-content').html() ||
                        page$('.entry-content').html() ||
                        page$('main').html() || '';

    const articleText = extractText(articleHtml);

    if (articleText.length > 200) {
      // Extract date
      const dateStr = page$('time').attr('datetime') ||
                     page$('meta[property="article:published_time"]').attr('content') ||
                     page$('.date').text();

      let publishedAt = new Date();
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed;
        }
      }

      editions.push({
        subject: `3-2-1: ${title}`,
        url,
        content: articleText,
        htmlContent: articleHtml,
        publishedAt,
      });
    }
  }

  console.log(`[${config.name}] Scraped ${editions.length} editions`);
  return editions;
}

// =============================================================================
// FARNAM STREET BRAIN FOOD SCRAPER
// =============================================================================

async function scrapeFarnamStreet(config: NewsletterConfig): Promise<EditionData[]> {
  console.log(`\n[${config.name}] Starting scrape...`);
  const editions: EditionData[] = [];
  const seenUrls = new Set<string>();

  // FS Blog has paginated archives
  let page = 1;
  const maxPages = 50;

  while (page <= maxPages && editions.length < MAX_EDITIONS_PER_SOURCE) {
    const pageUrl = page === 1
      ? config.archiveUrl
      : `${config.archiveUrl}page/${page}/`;

    console.log(`[${config.name}] Fetching archive page ${page}...`);
    const archiveHtml = await fetchPage(pageUrl);

    if (!archiveHtml) {
      break;
    }

    const $ = cheerio.load(archiveHtml);
    const links: { url: string; title: string }[] = [];

    // Find Brain Food article links
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // Brain Food posts have URLs like /brain-food/...
      if (href.includes('/brain-food/') && !href.endsWith('/brain-food/')) {
        const fullUrl = href.startsWith('http') ? href : `https://fs.blog${href}`;
        if (!seenUrls.has(fullUrl) && text.length > 5) {
          seenUrls.add(fullUrl);
          links.push({ url: fullUrl, title: cleanTitle(text) });
        }
      }
    });

    if (links.length === 0) {
      console.log(`[${config.name}] No more links found on page ${page}`);
      break;
    }

    console.log(`[${config.name}] Found ${links.length} links on page ${page}`);

    // Scrape each edition
    for (const { url, title } of links) {
      if (editions.length >= MAX_EDITIONS_PER_SOURCE) break;

      console.log(`[${config.name}] Scraping: ${title.substring(0, 50)}...`);
      await sleep(DELAY_BETWEEN_REQUESTS);

      const pageHtml = await fetchPage(url);
      if (!pageHtml) continue;

      const page$ = cheerio.load(pageHtml);
      page$('nav, header, footer, .sidebar, .related, .comments, script, style').remove();

      const articleHtml = page$('article .entry-content').html() ||
                          page$('.post-content').html() ||
                          page$('article').html() || '';

      const articleText = extractText(articleHtml);

      if (articleText.length > 200) {
        const dateStr = page$('time').attr('datetime') ||
                       page$('meta[property="article:published_time"]').attr('content');

        let publishedAt = new Date();
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        }

        editions.push({
          subject: `Brain Food: ${title}`,
          url,
          content: articleText,
          htmlContent: articleHtml,
          publishedAt,
        });
      }
    }

    page++;
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`[${config.name}] Scraped ${editions.length} editions`);
  return editions;
}

// =============================================================================
// SAHIL BLOOM CURIOSITY CHRONICLE SCRAPER
// =============================================================================

async function scrapeSahilBloom(config: NewsletterConfig): Promise<EditionData[]> {
  console.log(`\n[${config.name}] Starting scrape...`);
  const editions: EditionData[] = [];
  const seenUrls = new Set<string>();

  // Try multiple archive sources
  const archiveUrls = [
    'https://www.sahilbloom.com/newsletter',
    'https://sahilbloom.substack.com/archive',
  ];

  for (const archiveUrl of archiveUrls) {
    if (editions.length >= MAX_EDITIONS_PER_SOURCE) break;

    console.log(`[${config.name}] Trying archive: ${archiveUrl}`);
    const archiveHtml = await fetchPage(archiveUrl);
    if (!archiveHtml) continue;

    const $ = cheerio.load(archiveHtml);
    const links: { url: string; title: string }[] = [];

    // Look for post links (Substack uses /p/ pattern)
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if ((href.includes('/p/') || href.includes('/posts/')) && text.length > 5) {
        let fullUrl = href;
        if (!href.startsWith('http')) {
          if (archiveUrl.includes('substack')) {
            fullUrl = `https://sahilbloom.substack.com${href}`;
          } else {
            fullUrl = `https://www.sahilbloom.com${href}`;
          }
        }

        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          links.push({ url: fullUrl, title: cleanTitle(text) });
        }
      }
    });

    console.log(`[${config.name}] Found ${links.length} edition links`);

    // Scrape each edition
    for (let i = 0; i < links.length && editions.length < MAX_EDITIONS_PER_SOURCE; i++) {
      const { url, title } = links[i];
      console.log(`[${config.name}] Scraping ${editions.length + 1}/${Math.min(links.length, MAX_EDITIONS_PER_SOURCE)}: ${title.substring(0, 50)}...`);

      await sleep(DELAY_BETWEEN_REQUESTS);
      const pageHtml = await fetchPage(url);
      if (!pageHtml) continue;

      const page$ = cheerio.load(pageHtml);
      page$('nav, header, footer, .sidebar, script, style, .subscribe-widget').remove();

      const articleHtml = page$('.post-content').html() ||
                          page$('.body').html() ||
                          page$('article').html() ||
                          page$('main').html() || '';

      const articleText = extractText(articleHtml);

      if (articleText.length > 200) {
        const dateStr = page$('time').attr('datetime') ||
                       page$('meta[property="article:published_time"]').attr('content');

        let publishedAt = new Date();
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        }

        editions.push({
          subject: title,
          url,
          content: articleText,
          htmlContent: articleHtml,
          publishedAt,
        });
      }
    }

    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`[${config.name}] Scraped ${editions.length} editions`);
  return editions;
}

// =============================================================================
// ALEX AND BOOKS SCRAPER (BEEHIIV)
// =============================================================================

async function scrapeAlexAndBooks(config: NewsletterConfig): Promise<EditionData[]> {
  console.log(`\n[${config.name}] Starting scrape...`);
  const editions: EditionData[] = [];
  const seenUrls = new Set<string>();

  // Beehiiv newsletters have posts at /p/
  const archiveUrls = [
    config.archiveUrl,
    `${config.archiveUrl}/archive`,
  ];

  for (const archiveUrl of archiveUrls) {
    if (editions.length >= MAX_EDITIONS_PER_SOURCE) break;

    console.log(`[${config.name}] Trying archive: ${archiveUrl}`);
    const archiveHtml = await fetchPage(archiveUrl);
    if (!archiveHtml) continue;

    const $ = cheerio.load(archiveHtml);
    const links: { url: string; title: string }[] = [];

    // Beehiiv post links contain /p/
    $('a[href*="/p/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (text.length > 5) {
        const fullUrl = href.startsWith('http') ? href : `https://alexandbooks.beehiiv.com${href}`;
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          links.push({ url: fullUrl, title: cleanTitle(text) });
        }
      }
    });

    console.log(`[${config.name}] Found ${links.length} edition links`);

    // Scrape each edition, skip sponsored
    for (let i = 0; i < links.length && editions.length < MAX_EDITIONS_PER_SOURCE; i++) {
      const { url, title } = links[i];

      // Skip obvious sponsored posts by title
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('sponsor') ||
          lowerTitle.includes('partner') ||
          lowerTitle.includes('presented by') ||
          lowerTitle.includes('brought to you by') ||
          lowerTitle.includes('[ad]')) {
        console.log(`[${config.name}] Skipping (sponsored title): ${title.substring(0, 50)}...`);
        continue;
      }

      console.log(`[${config.name}] Scraping ${editions.length + 1}: ${title.substring(0, 50)}...`);
      await sleep(DELAY_BETWEEN_REQUESTS);

      const pageHtml = await fetchPage(url);
      if (!pageHtml) continue;

      const page$ = cheerio.load(pageHtml);

      // Check for sponsored content markers in page
      const pageText = page$('body').text().toLowerCase();
      if (pageText.includes('this post is sponsored') ||
          pageText.includes('sponsored by') ||
          pageText.includes('paid partnership') ||
          pageText.includes('this is a paid advertisement')) {
        console.log(`[${config.name}] Skipping (sponsored content): ${title.substring(0, 50)}...`);
        continue;
      }

      page$('nav, header, footer, .sidebar, script, style, .subscribe-widget').remove();

      const articleHtml = page$('.post-content').html() ||
                          page$('article').html() ||
                          page$('.content').html() ||
                          page$('main').html() || '';

      const articleText = extractText(articleHtml);

      if (articleText.length > 200) {
        const dateStr = page$('time').attr('datetime') ||
                       page$('meta[property="article:published_time"]').attr('content');

        let publishedAt = new Date();
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        }

        editions.push({
          subject: title,
          url,
          content: articleText,
          htmlContent: articleHtml,
          publishedAt,
          isSponsored: false,
        });
      }
    }

    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`[${config.name}] Scraped ${editions.length} editions (excluding sponsored)`);
  return editions;
}

// =============================================================================
// NEWSLETTER CONFIGURATIONS
// =============================================================================

const NEWSLETTERS: NewsletterConfig[] = [
  {
    name: 'James Clear',
    senderEmail: 'james@jamesclear.com',
    website: 'https://jamesclear.com/3-2-1',
    archiveUrl: 'https://jamesclear.com/3-2-1',
    category: 'wisdom',
    author: 'James Clear',
    scraper: scrapeJamesClear,
  },
  {
    name: 'Farnam Street',
    senderEmail: 'newsletter@fs.blog',
    website: 'https://fs.blog/newsletter/',
    archiveUrl: 'https://fs.blog/brain-food/',
    category: 'wisdom',
    author: 'Shane Parrish',
    scraper: scrapeFarnamStreet,
  },
  {
    name: 'The Curiosity Chronicle',
    senderEmail: 'sahil@sahilbloom.com',
    website: 'https://www.sahilbloom.com/newsletter',
    archiveUrl: 'https://www.sahilbloom.com/newsletter',
    category: 'productivity',
    author: 'Sahil Bloom',
    scraper: scrapeSahilBloom,
  },
  {
    name: 'Alex and Books',
    senderEmail: 'alex@alexandbooks.com',
    website: 'https://alexandbooks.beehiiv.com/',
    archiveUrl: 'https://alexandbooks.beehiiv.com',
    category: 'wisdom',
    author: 'Alex',
    scraper: scrapeAlexAndBooks,
  },
];

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

async function saveEditions(config: NewsletterConfig, editions: EditionData[]) {
  console.log(`\n[${config.name}] Saving ${editions.length} editions to database...`);

  // Create or get newsletter source
  let source = await prisma.newsletterSource.findUnique({
    where: { senderEmail: config.senderEmail },
  });

  if (!source) {
    source = await prisma.newsletterSource.create({
      data: {
        name: config.name,
        senderEmail: config.senderEmail,
        senderDomain: config.senderEmail.split('@')[1],
        website: config.website,
        category: config.category,
        description: `${config.name} by ${config.author}`,
        isVerified: true, // Curated quality sources
      },
    });
    console.log(`[${config.name}] Created newsletter source`);
  } else {
    // Update website if not set
    if (!source.website) {
      await prisma.newsletterSource.update({
        where: { id: source.id },
        data: { website: config.website },
      });
    }
    console.log(`[${config.name}] Using existing newsletter source`);
  }

  // Save editions to processing queue
  let saved = 0;
  let skipped = 0;

  for (const edition of editions) {
    const contentHash = generateContentHash(edition.url + edition.content.substring(0, 500));

    // Check if already exists
    const existing = await prisma.edition.findUnique({
      where: { contentHash },
    });

    if (existing) {
      skipped++;
      continue;
    }

    try {
      await prisma.edition.create({
        data: {
          sourceId: source.id,
          subject: edition.subject,
          contentHash,
          rawContent: edition.htmlContent || edition.content,
          textContent: edition.content,
          publishedAt: edition.publishedAt,
          receivedAt: new Date(),
          processingStatus: 'pending', // Queue for processing
        },
      });
      saved++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++;
      } else {
        console.error(`[${config.name}] Error saving edition:`, error);
      }
    }
  }

  console.log(`[${config.name}] Saved ${saved} editions, skipped ${skipped} duplicates`);
  return { saved, skipped };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  Newsletter Scraper - ByteLetters');
  console.log('='.repeat(60));

  // Check which newsletters to scrape (can pass as args)
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));

  let newslettersToScrape: NewsletterConfig[];

  if (args.length > 0) {
    newslettersToScrape = NEWSLETTERS.filter(n =>
      args.some(a => n.name.toLowerCase().includes(a.toLowerCase()))
    );

    if (newslettersToScrape.length === 0) {
      console.log('\nNo matching newsletters found.');
      console.log('Available newsletters:');
      NEWSLETTERS.forEach(n => console.log(`  - ${n.name}`));
      console.log('\nUsage: npm run scrape -- [newsletter_name]');
      process.exit(1);
    }
  } else {
    newslettersToScrape = NEWSLETTERS;
  }

  console.log(`\nScraping ${newslettersToScrape.length} newsletter(s):`);
  newslettersToScrape.forEach(n => console.log(`  - ${n.name} (${n.archiveUrl})`));

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const config of newslettersToScrape) {
    try {
      const editions = await config.scraper(config);
      const { saved, skipped } = await saveEditions(config, editions);
      totalSaved += saved;
      totalSkipped += skipped;
    } catch (error) {
      console.error(`\n[${config.name}] Error:`, error);
    }
  }

  // Print queue stats
  console.log('\n' + '='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));
  console.log(`  New editions added: ${totalSaved}`);
  console.log(`  Duplicates skipped: ${totalSkipped}`);

  const stats = await prisma.edition.groupBy({
    by: ['processingStatus'],
    _count: { id: true },
  });

  console.log('\n  Processing Queue:');
  stats.forEach(s => console.log(`    ${s.processingStatus}: ${s._count.id}`));

  const sources = await prisma.newsletterSource.findMany({
    select: { name: true, _count: { select: { editions: true } } },
  });

  console.log('\n  Editions by Source:');
  sources.forEach(s => console.log(`    ${s.name}: ${s._count.editions}`));

  console.log('\n' + '='.repeat(60));
  console.log('  To process the queue, run: npm run dev');
  console.log('  Then call: POST /queue/process');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
