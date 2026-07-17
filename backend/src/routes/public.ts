/**
 * Public routes - no authentication.
 *
 * Powers the landing page's live byte preview with the library's
 * best-performing content instead of stale hardcoded samples.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';

const router = Router();

// Cache the showcase in memory - the landing page is high-traffic relative
// to how often the "best bytes" list actually changes
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SHOWCASE_SIZE = 30;

let cachedShowcase: unknown[] | null = null;
let cachedAt = 0;

/**
 * GET /public/showcase
 * Top-performing visible bytes for the landing page preview.
 * Returns only display fields - no ids that could be enumerated, no stats.
 */
router.get('/showcase', async (req: Request, res: Response) => {
  try {
    if (cachedShowcase && Date.now() - cachedAt < CACHE_TTL_MS) {
      return res.json({ bytes: cachedShowcase });
    }

    const bytes = await prisma.contentByte.findMany({
      where: {
        isHidden: false,
        isAudited: true,
        moderationStatus: { not: 'rejected' },
        edition: { source: { isCurated: true } },
      },
      orderBy: [
        { qualityScore: 'desc' },
        { engagementScore: 'desc' },
        { upvotes: 'desc' },
      ],
      take: SHOWCASE_SIZE,
      select: {
        content: true,
        type: true,
        author: true,
        edition: {
          select: { source: { select: { name: true } } },
        },
      },
    });

    const showcase = bytes.map((b: any) => ({
      content: b.content,
      type: b.type,
      author: b.author,
      source: { name: b.edition.source.name },
    }));

    // Only cache non-empty results - an empty library (fresh setup) should
    // re-check on the next request, not serve nothing for an hour
    if (showcase.length > 0) {
      cachedShowcase = showcase;
      cachedAt = Date.now();
    }

    res.json({ bytes: showcase });
  } catch (error) {
    console.error('[Public] Showcase error:', error);
    res.status(500).json({ error: 'Failed to load showcase' });
  }
});

export default router;
