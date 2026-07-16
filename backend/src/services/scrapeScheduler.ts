/**
 * Scheduled scraping.
 *
 * Every hour (and shortly after boot), finds sources whose scrapeFrequency
 * says they're due - daily = 24h since last scrape, weekly = 7 days,
 * manual = never automatic - and runs incremental scrape jobs for them,
 * one at a time to stay polite.
 *
 * Note for free-tier hosting: the check also runs on boot, so even if the
 * service sleeps between requests, waking it catches up on due scrapes.
 */

import { prisma } from './db';
import { runScrapeJob, isSourceScraping } from './scraper';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
const BOOT_DELAY_MS = 30 * 1000;          // let the server settle first

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

let checking = false;

async function checkDueSources(): Promise<void> {
  if (checking) return;
  checking = true;

  try {
    const sources = await prisma.newsletterSource.findMany({
      where: {
        scrapingEnabled: true,
        archiveUrl: { not: null },
        scrapeFrequency: { in: Object.keys(FREQUENCY_MS) },
      },
      select: { id: true, name: true, scrapeFrequency: true, lastScrapedAt: true },
    });

    const now = Date.now();
    const due = sources.filter((s) => {
      const interval = FREQUENCY_MS[s.scrapeFrequency];
      if (!interval) return false;
      if (!s.lastScrapedAt) return true; // never scraped
      return now - s.lastScrapedAt.getTime() >= interval;
    });

    if (due.length === 0) return;
    console.log(`[Scheduler] ${due.length} source(s) due for scraping: ${due.map((s) => s.name).join(', ')}`);

    // Sequential, not parallel - be gentle to targets and to our own memory
    for (const source of due) {
      if (isSourceScraping(source.id)) continue;
      const job = await prisma.scrapeJob.create({
        data: { sourceId: source.id, status: 'running', triggeredBy: 'scheduled' },
      });
      await runScrapeJob(source.id, job.id);
    }
  } catch (error) {
    console.error('[Scheduler] Check failed:', error);
  } finally {
    checking = false;
  }
}

export function startScrapeScheduler(): void {
  if (process.env.DISABLE_SCRAPE_SCHEDULER === 'true') {
    console.log('[Scheduler] Disabled via DISABLE_SCRAPE_SCHEDULER');
    return;
  }
  setTimeout(() => void checkDueSources(), BOOT_DELAY_MS);
  setInterval(() => void checkDueSources(), CHECK_INTERVAL_MS);
  console.log('[Scheduler] Scrape scheduler started (hourly checks, boot catch-up in 30s)');
}
