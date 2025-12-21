/**
 * Test Scraper - Debug Script
 *
 * Scrapes just 5 editions from James Clear to test and debug the extraction.
 * Shows verbose output to identify issues.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../src/services/db';
import crypto from 'crypto';

type Browser = import('puppeteer').Browser;
type Page = import('puppeteer').Page;

let browser: Browser | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function initBrowser(): Promise<Browser | null> {
  if (browser) return browser;
  try {
    const puppeteer = await import('puppeteer');
    console.log('[Browser] Launching headless Chrome...');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('[Browser] Chrome launched successfully');
    return browser;
  } catch (error) {
    console.error('[Browser] Failed to launch:', error);
    return null;
  }
}

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function testJamesClear() {
  console.log('\n' + '='.repeat(60));
  console.log('  TEST SCRAPER - James Clear (5 editions)');
  console.log('='.repeat(60));

  const browserInstance = await initBrowser();
  if (!browserInstance) {
    console.error('Failed to launch browser');
    return;
  }

  let page: Page | null = null;

  try {
    // Step 1: Load archive page
    console.log('\n[Step 1] Loading archive page...');
    page = await browserInstance.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto('https://jamesclear.com/3-2-1', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    const archiveHtml = await page.content();
    const $ = cheerio.load(archiveHtml);

    // Find edition links
    const links: { url: string; title: string }[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href.includes('/3-2-1/') && !href.endsWith('/3-2-1/') && !href.endsWith('/3-2-1')) {
        const fullUrl = href.startsWith('http') ? href : `https://jamesclear.com${href}`;
        if (!links.find(l => l.url === fullUrl)) {
          const title = text.length > 10 ? text : href.split('/').pop()?.replace(/-/g, ' ') || 'Newsletter';
          links.push({ url: fullUrl, title: title.substring(0, 100) });
        }
      }
    });

    console.log(`[Step 1] Found ${links.length} edition links`);
    console.log(`[Step 1] First 5 links:`);
    links.slice(0, 5).forEach((l, i) => console.log(`  ${i + 1}. ${l.url}`));

    await page.close();
    page = null;

    // Step 2: Scrape 5 editions
    console.log('\n[Step 2] Scraping 5 editions...');
    const editions: any[] = [];

    for (let i = 0; i < Math.min(5, links.length); i++) {
      const { url, title } = links[i];
      console.log(`\n--- Edition ${i + 1}/5: ${url} ---`);

      page = await browserInstance.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(2000);

      const pageHtml = await page.content();
      const page$ = cheerio.load(pageHtml);

      // Debug: Show what selectors find
      console.log('  Checking selectors:');
      console.log(`    article: ${page$('article').length} found`);
      console.log(`    .post-content: ${page$('.post-content').length} found`);
      console.log(`    .entry-content: ${page$('.entry-content').length} found`);
      console.log(`    main: ${page$('main').length} found`);
      console.log(`    .content: ${page$('.content').length} found`);
      console.log(`    #content: ${page$('#content').length} found`);
      console.log(`    .post: ${page$('.post').length} found`);
      console.log(`    .newsletter: ${page$('.newsletter').length} found`);

      // Try different content extraction strategies
      page$('nav, header, footer, .sidebar, script, style, .related-posts, .comments').remove();

      let articleHtml = '';
      let articleText = '';

      // Try multiple selectors
      const selectors = ['article', '.post-content', '.entry-content', 'main', '.content', '#content', '.post', 'body'];
      for (const sel of selectors) {
        const content = page$(sel).html();
        if (content && content.length > 500) {
          articleHtml = content;
          articleText = page$(sel).text().replace(/\s+/g, ' ').trim();
          console.log(`  ✓ Found content with selector: "${sel}" (${articleText.length} chars)`);
          break;
        }
      }

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

        console.log(`  ✓ Extracted: ${articleText.length} chars, date: ${publishedAt.toISOString().split('T')[0]}`);
        console.log(`  Preview: "${articleText.substring(0, 150)}..."`);
      } else {
        console.log(`  ✗ Content too short: ${articleText.length} chars`);
      }

      await page.close();
      page = null;
      await sleep(1000);
    }

    // Step 3: Save to database
    console.log('\n[Step 3] Saving to database...');

    if (editions.length === 0) {
      console.log('  No editions to save!');
      return;
    }

    // Get or create source
    let source = await prisma.newsletterSource.findUnique({
      where: { senderEmail: 'james@jamesclear.com' },
    });

    if (!source) {
      source = await prisma.newsletterSource.create({
        data: {
          name: 'James Clear',
          senderEmail: 'james@jamesclear.com',
          senderDomain: 'jamesclear.com',
          website: 'https://jamesclear.com/3-2-1',
          category: 'wisdom',
          description: 'James Clear 3-2-1 Newsletter',
          isVerified: true,
        },
      });
      console.log('  Created newsletter source');
    } else {
      console.log('  Using existing newsletter source');
    }

    let saved = 0;
    let skipped = 0;

    for (const edition of editions) {
      const contentHash = generateContentHash(edition.url + edition.content.substring(0, 500));

      const existing = await prisma.edition.findUnique({
        where: { contentHash },
      });

      if (existing) {
        console.log(`  Skipped (duplicate): ${edition.subject.substring(0, 50)}...`);
        skipped++;
        continue;
      }

      try {
        const created = await prisma.edition.create({
          data: {
            sourceId: source.id,
            subject: edition.subject,
            contentHash,
            rawContent: edition.htmlContent || edition.content,
            textContent: edition.content,
            publishedAt: edition.publishedAt,
            receivedAt: new Date(),
            processingStatus: 'pending',
          },
        });
        console.log(`  ✓ Saved: ${edition.subject.substring(0, 50)}... (ID: ${created.id})`);
        saved++;
      } catch (error) {
        console.error(`  ✗ Error saving:`, error);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  SUMMARY: ${saved} saved, ${skipped} skipped`);
    console.log('='.repeat(60));

    // Show queue status
    const pending = await prisma.edition.count({ where: { processingStatus: 'pending' } });
    console.log(`  Editions pending processing: ${pending}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (page) await page.close();
    await closeBrowser();
    await prisma.$disconnect();
  }
}

testJamesClear();
