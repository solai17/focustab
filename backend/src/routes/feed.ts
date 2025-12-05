import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticateToken } from '../middleware/auth';
import {
  AuthenticatedRequest,
  ContentByteResponse,
  FeedResponse,
  FeedType,
  VoteInput,
  ViewInput,
} from '../types';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =============================================================================
// FEED ENDPOINTS
// =============================================================================

/**
 * GET /feed
 * Main feed endpoint - returns content bytes based on type
 * Query params:
 *   - type: personalized | popular | trending | subscribed | new (default: personalized)
 *   - limit: number (default: 10, max: 50)
 *   - cursor: string (for pagination)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const feedType = (req.query.type as FeedType) || 'personalized';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const cursor = req.query.cursor as string | undefined;

    // Get user for personalization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        contentHistory: {
          select: { byteId: true },
          orderBy: { shownAt: 'desc' },
          take: 500, // Last 500 seen bytes for filtering
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get IDs of content user has already seen
    const seenByteIds = user.contentHistory.map((h) => h.byteId);

    // Build query based on feed type
    let bytes;
    switch (feedType) {
      case 'popular':
        bytes = await getPopularFeed(userId, seenByteIds, limit, cursor);
        break;
      case 'trending':
        bytes = await getTrendingFeed(userId, seenByteIds, limit, cursor);
        break;
      case 'subscribed':
        bytes = await getSubscribedFeed(userId, seenByteIds, limit, cursor);
        break;
      case 'new':
        bytes = await getNewFeed(userId, seenByteIds, limit, cursor);
        break;
      case 'personalized':
      default:
        bytes = await getPersonalizedFeed(
          userId,
          seenByteIds,
          user.preferences,
          user.enableRecommendations,
          limit,
          cursor
        );
        break;
    }

    // Format response
    const response: FeedResponse = {
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
      nextCursor: bytes.length === limit ? bytes[bytes.length - 1].id : null,
      hasMore: bytes.length === limit,
    };

    res.json(response);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

/**
 * GET /feed/next
 * Get single next byte for new tab experience
 */
router.get('/next', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get user with preferences and recent history
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        contentHistory: {
          select: { byteId: true },
          orderBy: { shownAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const seenByteIds = user.contentHistory.map((h) => h.byteId);

    // Get one personalized byte
    const bytes = await getPersonalizedFeed(
      userId,
      seenByteIds,
      user.preferences,
      user.enableRecommendations,
      1
    );

    if (bytes.length === 0) {
      // Fall back to popular if no personalized content
      const popularBytes = await getPopularFeed(userId, [], 1);
      if (popularBytes.length === 0) {
        return res.json({ byte: null, queueSize: 0 });
      }
      return res.json({
        byte: formatByteResponse(popularBytes[0], userId),
        queueSize: await getQueueSize(userId, seenByteIds),
      });
    }

    // Record that we're showing this byte
    await prisma.contentHistory.upsert({
      where: {
        userId_byteId: { userId, byteId: bytes[0].id },
      },
      create: { userId, byteId: bytes[0].id },
      update: { shownAt: new Date() },
    });

    res.json({
      byte: formatByteResponse(bytes[0], userId),
      queueSize: await getQueueSize(userId, seenByteIds),
    });
  } catch (error) {
    console.error('Feed next error:', error);
    res.status(500).json({ error: 'Failed to fetch next byte' });
  }
});

// =============================================================================
// ENGAGEMENT ENDPOINTS
// =============================================================================

/**
 * POST /feed/bytes/:id/vote
 * Upvote or downvote a content byte
 * Body: { vote: 1 | -1 | 0 }
 */
router.post('/bytes/:id/vote', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const byteId = req.params.id;
    const { vote } = req.body as VoteInput;

    // Validate vote value
    if (![- 1, 0, 1].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be -1, 0, or 1' });
    }

    // Check byte exists
    const byte = await prisma.contentByte.findUnique({
      where: { id: byteId },
    });

    if (!byte) {
      return res.status(404).json({ error: 'Content byte not found' });
    }

    // Get existing engagement
    const existingEngagement = await prisma.userEngagement.findUnique({
      where: { userId_byteId: { userId, byteId } },
    });

    const previousVote = existingEngagement?.vote || 0;

    // Update or create engagement
    await prisma.userEngagement.upsert({
      where: { userId_byteId: { userId, byteId } },
      create: { userId, byteId, vote },
      update: { vote },
    });

    // Update aggregate counts on ContentByte
    const upvoteDelta =
      (vote === 1 ? 1 : 0) - (previousVote === 1 ? 1 : 0);
    const downvoteDelta =
      (vote === -1 ? 1 : 0) - (previousVote === -1 ? 1 : 0);

    await prisma.contentByte.update({
      where: { id: byteId },
      data: {
        upvotes: { increment: upvoteDelta },
        downvotes: { increment: downvoteDelta },
      },
    });

    // Update user preferences based on vote
    if (vote !== 0) {
      await updateUserPreferences(userId, byte.category, vote);
    }

    // Recalculate engagement score
    await recalculateEngagementScore(byteId);

    res.json({
      success: true,
      vote,
      engagement: {
        upvotes: byte.upvotes + upvoteDelta,
        downvotes: byte.downvotes + downvoteDelta,
      },
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

/**
 * POST /feed/bytes/:id/view
 * Track that user viewed a byte (with optional dwell time)
 * Body: { dwellTimeMs: number }
 */
router.post('/bytes/:id/view', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const byteId = req.params.id;
    const { dwellTimeMs } = req.body as ViewInput;

    // Update engagement with view
    await prisma.userEngagement.upsert({
      where: { userId_byteId: { userId, byteId } },
      create: {
        userId,
        byteId,
        viewCount: 1,
        totalDwellTimeMs: dwellTimeMs || 0,
      },
      update: {
        viewCount: { increment: 1 },
        totalDwellTimeMs: { increment: dwellTimeMs || 0 },
      },
    });

    // Update aggregate view count
    await prisma.contentByte.update({
      where: { id: byteId },
      data: { viewCount: { increment: 1 } },
    });

    // Record in history
    await prisma.contentHistory.upsert({
      where: { userId_byteId: { userId, byteId } },
      create: { userId, byteId, dwellTimeMs },
      update: { shownAt: new Date(), dwellTimeMs },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

/**
 * POST /feed/bytes/:id/save
 * Save or unsave a content byte
 */
router.post('/bytes/:id/save', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const byteId = req.params.id;

    // Get current save state
    const existing = await prisma.userEngagement.findUnique({
      where: { userId_byteId: { userId, byteId } },
    });

    const newSaveState = !existing?.isSaved;

    // Update engagement
    await prisma.userEngagement.upsert({
      where: { userId_byteId: { userId, byteId } },
      create: { userId, byteId, isSaved: true },
      update: { isSaved: newSaveState },
    });

    // Update aggregate count
    await prisma.contentByte.update({
      where: { id: byteId },
      data: { saveCount: { increment: newSaveState ? 1 : -1 } },
    });

    res.json({ success: true, isSaved: newSaveState });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save byte' });
  }
});

/**
 * GET /feed/saved
 * Get user's saved bytes
 */
router.get('/saved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const savedEngagements = await prisma.userEngagement.findMany({
      where: {
        userId,
        isSaved: true,
        ...(cursor && { id: { lt: cursor } }),
      },
      include: {
        byte: {
          include: {
            edition: {
              include: { source: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const bytes = savedEngagements
      .map((e) => e.byte)
      .filter((b) => b !== null);

    res.json({
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
      nextCursor:
        savedEngagements.length === limit
          ? savedEngagements[savedEngagements.length - 1].id
          : null,
      hasMore: savedEngagements.length === limit,
    });
  } catch (error) {
    console.error('Saved error:', error);
    res.status(500).json({ error: 'Failed to fetch saved bytes' });
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getPopularFeed(
  userId: string,
  excludeIds: string[],
  limit: number,
  cursor?: string
) {
  return prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      ...(cursor && { engagementScore: { lt: parseFloat(cursor) } }),
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: { engagementScore: 'desc' },
    take: limit,
  });
}

async function getTrendingFeed(
  userId: string,
  excludeIds: string[],
  limit: number,
  cursor?: string
) {
  return prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
      ...(cursor && { trendingScore: { lt: parseFloat(cursor) } }),
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: { trendingScore: 'desc' },
    take: limit,
  });
}

async function getSubscribedFeed(
  userId: string,
  excludeIds: string[],
  limit: number,
  cursor?: string
) {
  // Get user's subscribed sources
  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId, isActive: true },
    select: { sourceId: true },
  });

  const sourceIds = subscriptions.map((s) => s.sourceId);

  if (sourceIds.length === 0) {
    return [];
  }

  return prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      edition: { sourceId: { in: sourceIds } },
      ...(cursor && { createdAt: { lt: new Date(cursor) } }),
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function getNewFeed(
  userId: string,
  excludeIds: string[],
  limit: number,
  cursor?: string
) {
  return prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      ...(cursor && { createdAt: { lt: new Date(cursor) } }),
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function getPersonalizedFeed(
  userId: string,
  excludeIds: string[],
  preferences: { category: string; weight: number }[],
  enableRecommendations: boolean,
  limit: number,
  cursor?: string
) {
  // Build category weights map
  const categoryWeights = new Map(
    preferences.map((p) => [p.category, p.weight])
  );

  // Calculate mix ratios
  const hasPreferences = preferences.length > 0;

  // Get bytes with a mix strategy
  const bytes = await prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      // Only show sponsored if user enabled recommendations
      ...(enableRecommendations ? {} : { isSponsored: false }),
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: [
      { engagementScore: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit * 3, // Get more to sort/filter
  });

  // Score and sort by personalization
  const scoredBytes = bytes.map((byte) => {
    const categoryWeight = categoryWeights.get(byte.category) || 0.5;
    const engagementBoost = byte.engagementScore * 0.4;
    const recencyBoost =
      (1 - (Date.now() - byte.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) * 0.2;
    const personalScore =
      categoryWeight * 0.3 + engagementBoost + Math.max(0, recencyBoost);

    return { byte, score: personalScore };
  });

  // Sort by personalized score
  scoredBytes.sort((a, b) => b.score - a.score);

  return scoredBytes.slice(0, limit).map((s) => s.byte);
}

async function getQueueSize(userId: string, seenByteIds: string[]): Promise<number> {
  return prisma.contentByte.count({
    where: {
      id: { notIn: seenByteIds },
    },
  });
}

async function updateUserPreferences(
  userId: string,
  category: string,
  vote: number
) {
  // Get existing preference
  const existing = await prisma.userPreference.findUnique({
    where: { userId_category: { userId, category } },
  });

  // Calculate new weight
  const currentWeight = existing?.weight || 0.5;
  const adjustment = vote > 0 ? 0.05 : -0.03; // Upvote increases, downvote decreases
  const newWeight = Math.max(0, Math.min(1, currentWeight + adjustment));

  // Upsert preference
  await prisma.userPreference.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, weight: newWeight },
    update: { weight: newWeight },
  });
}

async function recalculateEngagementScore(byteId: string) {
  const byte = await prisma.contentByte.findUnique({
    where: { id: byteId },
  });

  if (!byte) return;

  // Engagement score formula
  const engagementScore =
    byte.upvotes * 1.0 -
    byte.downvotes * 0.5 +
    byte.viewCount * 0.01 +
    byte.saveCount * 2.0 +
    byte.shareCount * 3.0;

  // Trending score with time decay
  const hoursAgo =
    (Date.now() - byte.createdAt.getTime()) / (1000 * 60 * 60);
  const trendingScore = engagementScore / Math.pow(hoursAgo + 2, 1.5);

  await prisma.contentByte.update({
    where: { id: byteId },
    data: { engagementScore, trendingScore },
  });
}

function formatByteResponse(byte: any, userId: string): ContentByteResponse {
  const userEngagement = byte.engagements?.[0];

  return {
    id: byte.id,
    content: byte.content,
    type: byte.type,
    author: byte.author,
    context: byte.context,
    category: byte.category,
    source: {
      id: byte.edition.source.id,
      name: byte.edition.source.name,
      isVerified: byte.edition.source.isVerified,
    },
    engagement: {
      upvotes: byte.upvotes,
      downvotes: byte.downvotes,
      viewCount: byte.viewCount,
    },
    userEngagement: userEngagement
      ? {
          vote: userEngagement.vote,
          isSaved: userEngagement.isSaved,
        }
      : undefined,
    isSponsored: byte.isSponsored,
    createdAt: byte.createdAt,
  };
}

export default router;
