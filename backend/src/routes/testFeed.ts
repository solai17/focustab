// Simplified feed routes for testing with mock database
import { Router, Request, Response } from 'express';
import { mockDb } from '../services/mockDb';

const router = Router();

/**
 * GET /test-feed
 * Get feed of content bytes (no auth required for testing)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const category = req.query.category as string | undefined;

    const bytes = await mockDb.contentByte.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ engagementScore: 'desc' }],
      take: limit,
    });

    res.json({
      bytes: bytes.map(byte => ({
        id: byte.id,
        content: byte.content,
        type: byte.type,
        author: byte.author,
        context: byte.context,
        category: byte.category,
        source: {
          name: byte.sourceName,
          category: byte.sourceCategory,
        },
        engagement: {
          upvotes: byte.upvotes,
          downvotes: byte.downvotes,
          viewCount: byte.viewCount,
        },
        isSponsored: byte.isSponsored,
        createdAt: byte.createdAt,
      })),
      total: bytes.length,
    });
  } catch (error) {
    console.error('Test feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

/**
 * GET /test-feed/next
 * Get single random byte for new tab experience
 */
router.get('/next', async (req: Request, res: Response) => {
  try {
    const bytes = await mockDb.contentByte.findMany({
      orderBy: [{ engagementScore: 'desc' }],
      take: 10,
    });

    if (bytes.length === 0) {
      return res.json({ byte: null, queueSize: 0 });
    }

    // Pick a random byte from top 10
    const randomIndex = Math.floor(Math.random() * bytes.length);
    const byte = bytes[randomIndex];

    res.json({
      byte: {
        id: byte.id,
        content: byte.content,
        type: byte.type,
        author: byte.author,
        context: byte.context,
        category: byte.category,
        source: {
          name: byte.sourceName,
          category: byte.sourceCategory,
        },
        engagement: {
          upvotes: byte.upvotes,
          downvotes: byte.downvotes,
          viewCount: byte.viewCount,
        },
        isSponsored: byte.isSponsored,
        createdAt: byte.createdAt,
      },
      queueSize: bytes.length,
    });
  } catch (error) {
    console.error('Test feed next error:', error);
    res.status(500).json({ error: 'Failed to fetch next byte' });
  }
});

/**
 * POST /test-feed/bytes/:id/vote
 * Vote on a byte (mock - just returns success)
 */
router.post('/bytes/:id/vote', async (req: Request, res: Response) => {
  try {
    const byteId = req.params.id;
    const { vote } = req.body;

    if (![-1, 0, 1].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be -1, 0, or 1' });
    }

    const byte = await mockDb.contentByte.findUnique({ where: { id: byteId } });

    if (!byte) {
      return res.status(404).json({ error: 'Content byte not found' });
    }

    // Update mock data
    await mockDb.contentByte.update({
      where: { id: byteId },
      data: {
        upvotes: byte.upvotes + (vote === 1 ? 1 : 0),
        downvotes: byte.downvotes + (vote === -1 ? 1 : 0),
      },
    });

    res.json({
      success: true,
      vote,
      engagement: {
        upvotes: byte.upvotes + (vote === 1 ? 1 : 0),
        downvotes: byte.downvotes + (vote === -1 ? 1 : 0),
      },
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

/**
 * GET /test-feed/sources
 * Get available newsletter sources
 */
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const sources = await mockDb.newsletterSource.findMany({
      orderBy: [{ avgEngagementScore: 'desc' }],
    });

    res.json({
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        subscriberCount: s.subscriberCount,
        isVerified: s.isVerified,
      })),
    });
  } catch (error) {
    console.error('Sources error:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * GET /test-feed/stats
 * Get mock database stats
 */
router.get('/stats', (req: Request, res: Response) => {
  const stats = mockDb.getStats();
  res.json({
    mode: 'mock',
    stats,
    message: 'Running with in-memory mock database for testing',
  });
});

export default router;
