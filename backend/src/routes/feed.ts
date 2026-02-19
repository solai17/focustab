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

    // Get user for personalization with history and engagements
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        contentHistory: {
          where: { isRead: true }, // Only exclude bytes that were actually read
          select: { byteId: true },
        },
        engagements: {
          where: {
            OR: [
              { vote: { not: 0 } }, // User voted (liked or disliked)
              { isSaved: true },     // User saved/bookmarked
            ],
          },
          select: { byteId: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude bytes that user has read OR interacted with (voted/saved)
    const readByteIds = user.contentHistory.map((h) => h.byteId);
    const interactedByteIds = user.engagements.map((e) => e.byteId);
    const seenByteIds = [...new Set([...readByteIds, ...interactedByteIds])];

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

    // Get user with preferences, history, subscriptions, and engagements
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        contentHistory: {
          where: { isRead: true }, // Only exclude bytes that were actually read
          select: { byteId: true },
        },
        subscriptions: {
          where: { isActive: true },
          select: { sourceId: true },
        },
        engagements: {
          where: {
            OR: [
              { vote: { not: 0 } }, // User voted (liked or disliked)
              { isSaved: true },     // User saved/bookmarked
            ],
          },
          select: { byteId: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude bytes that user has read OR interacted with (voted/saved)
    const readByteIds = user.contentHistory.map((h) => h.byteId);
    const interactedByteIds = user.engagements.map((e) => e.byteId);
    const seenByteIds = [...new Set([...readByteIds, ...interactedByteIds])];
    const userSourceIds = user.subscriptions.map((s) => s.sourceId);
    const hasUserSubscriptions = userSourceIds.length > 0;

    // If user disabled recommendations and has no subscriptions, return empty
    if (!user.enableRecommendations && !hasUserSubscriptions) {
      return res.json({
        byte: null,
        queueSize: 0,
        hasUserSubscriptions: false,
        isCommunityContent: false,
      });
    }

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
      if (!user.enableRecommendations) {
        // User disabled recommendations, don't show popular
        return res.json({
          byte: null,
          queueSize: 0,
          hasUserSubscriptions,
          isCommunityContent: false,
        });
      }

      const popularBytes = await getPopularFeed(userId, [], 1);
      if (popularBytes.length === 0) {
        return res.json({ byte: null, queueSize: 0, hasUserSubscriptions, isCommunityContent: false });
      }
      return res.json({
        byte: formatByteResponse(popularBytes[0], userId),
        queueSize: await getQueueSize(userId, seenByteIds),
        hasUserSubscriptions,
        isCommunityContent: true, // Popular feed is always community content
      });
    }

    // Record that we're showing this byte (isRead stays false until user actually reads it)
    await prisma.contentHistory.upsert({
      where: {
        userId_byteId: { userId, byteId: bytes[0].id },
      },
      create: { userId, byteId: bytes[0].id, isRead: false },
      update: { shownAt: new Date() },
    });

    // Check if this byte is from user's own subscriptions
    const byteSourceId = bytes[0].edition?.sourceId;
    const isFromUserSubscription = byteSourceId ? userSourceIds.includes(byteSourceId) : false;

    res.json({
      byte: formatByteResponse(bytes[0], userId),
      queueSize: await getQueueSize(userId, seenByteIds),
      hasUserSubscriptions,
      isCommunityContent: !isFromUserSubscription,
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
 * Body: { dwellTimeMs: number, isRead?: boolean }
 * isRead = true means user actually read the byte (tab active 5+ seconds)
 */
router.post('/bytes/:id/view', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const byteId = req.params.id;
    const { dwellTimeMs, isRead } = req.body as ViewInput;

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

    // Record in history - only mark as read if explicitly confirmed
    await prisma.contentHistory.upsert({
      where: { userId_byteId: { userId, byteId } },
      create: { userId, byteId, dwellTimeMs, isRead: isRead || false },
      update: {
        shownAt: new Date(),
        dwellTimeMs,
        // Only upgrade to read, never downgrade
        ...(isRead ? { isRead: true } : {}),
      },
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
  // Get more bytes to sort by combined score
  const bytes = await prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
    },
    include: {
      edition: { include: { source: true } },
      engagements: { where: { userId }, take: 1 },
    },
    orderBy: [
      { qualityScore: 'desc' },
      { engagementScore: 'desc' },
    ],
    take: limit * 2,
  });

  // Sort by combined quality + engagement score
  // This ensures high-quality new content surfaces even without engagement
  const sorted = bytes.sort((a, b) => {
    const scoreA = (a.qualityScore || 0.5) * 0.4 + Math.min(a.engagementScore / 100, 1) * 0.6;
    const scoreB = (b.qualityScore || 0.5) * 0.4 + Math.min(b.engagementScore / 100, 1) * 0.6;
    return scoreB - scoreA;
  });

  return sorted.slice(0, limit);
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

  // Check if user is new (no preferences = cold start)
  const isNewUser = preferences.length === 0;

  // Get bytes with a mix strategy - fetch more for diversity filtering
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
      { qualityScore: 'desc' },  // Prioritize high-quality content
      { engagementScore: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit * 5, // Get more to allow for diversity filtering
  });

  // Score and sort by personalization with randomness
  // For NEW users: rely heavily on qualityScore + engagementScore
  // For existing users: add category preferences
  const scoredBytes = bytes.map((byte) => {
    // Quality score from AI (0-1) - most important for new users
    const qualityBoost = (byte.qualityScore || 0.5) * (isNewUser ? 0.4 : 0.2);

    // Engagement score from community (normalized)
    const maxEngagement = 100; // Normalize engagement
    const normalizedEngagement = Math.min(byte.engagementScore / maxEngagement, 1);
    const engagementBoost = normalizedEngagement * (isNewUser ? 0.3 : 0.2);

    // Category preference (only for users with preferences) - reduced weight to prevent feedback loop
    const categoryWeight = isNewUser ? 0 : (categoryWeights.get(byte.category) || 0.5) * 0.2;

    // Recency boost (newer content gets slight boost)
    const ageInDays = (Date.now() - byte.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    const recencyBoost = Math.max(0, (1 - ageInDays / 30)) * 0.1; // Decay over 30 days

    // Randomness factor to break ties and prevent staleness (15-20% weight)
    const randomBoost = Math.random() * 0.2;

    const personalScore = qualityBoost + engagementBoost + categoryWeight + recencyBoost + randomBoost;

    return {
      byte,
      score: personalScore,
      sourceId: byte.edition?.source?.id || 'unknown',
      author: byte.author || byte.edition?.source?.name || 'unknown'
    };
  });

  // Sort by personalized score
  scoredBytes.sort((a, b) => b.score - a.score);

  // Apply diversity filtering - limit any single source/author to max 2 per batch
  const MAX_PER_SOURCE = 2;
  const MAX_PER_AUTHOR = 2;
  const sourceCount = new Map<string, number>();
  const authorCount = new Map<string, number>();
  const diverseResults: typeof scoredBytes = [];

  for (const item of scoredBytes) {
    if (diverseResults.length >= limit) break;

    const currentSourceCount = sourceCount.get(item.sourceId) || 0;
    const currentAuthorCount = authorCount.get(item.author) || 0;

    // Skip if this source or author has already appeared too many times
    if (currentSourceCount >= MAX_PER_SOURCE || currentAuthorCount >= MAX_PER_AUTHOR) {
      continue;
    }

    // Add to results and update counts
    diverseResults.push(item);
    sourceCount.set(item.sourceId, currentSourceCount + 1);
    authorCount.set(item.author, currentAuthorCount + 1);
  }

  // If we couldn't fill the limit due to diversity constraints, add remaining items
  if (diverseResults.length < limit) {
    for (const item of scoredBytes) {
      if (diverseResults.length >= limit) break;
      if (!diverseResults.includes(item)) {
        diverseResults.push(item);
      }
    }
  }

  return diverseResults.map((s) => s.byte);
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
      website: byte.edition.source.website || null,
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
