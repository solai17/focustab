import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, NewsletterSourceResponse, ContentByteResponse } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =============================================================================
// SOURCE DISCOVERY
// =============================================================================

/**
 * GET /discover/sources
 * Discover newsletter sources to follow
 * Query params:
 *   - category: filter by category
 *   - sort: popular | new | trending (default: popular)
 *   - limit: number (default: 20)
 *   - cursor: pagination
 */
router.get('/sources', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const category = req.query.category as string | undefined;
    const sort = (req.query.sort as string) || 'popular';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    // Get user's existing subscriptions
    const userSubscriptions = await prisma.userSubscription.findMany({
      where: { userId },
      select: { sourceId: true },
    });
    const subscribedIds = new Set(userSubscriptions.map((s) => s.sourceId));

    // Build order by clause
    let orderBy: any = { avgEngagementScore: 'desc' };
    if (sort === 'new') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'trending') {
      orderBy = { totalEngagement: 'desc' };
    }

    // Query sources
    const sources = await prisma.newsletterSource.findMany({
      where: {
        ...(category && { category }),
        ...(cursor && { id: { lt: cursor } }),
        // Only show sources with some content
        editions: { some: { isProcessed: true } },
      },
      orderBy,
      take: limit,
    });

    // Format response
    const response: NewsletterSourceResponse[] = sources.map((source) => ({
      id: source.id,
      name: source.name,
      description: source.description,
      category: source.category,
      subscriberCount: source.subscriberCount,
      avgEngagementScore: source.avgEngagementScore,
      isVerified: source.isVerified,
      isSubscribed: subscribedIds.has(source.id),
    }));

    res.json({
      sources: response,
      nextCursor: sources.length === limit ? sources[sources.length - 1].id : null,
      hasMore: sources.length === limit,
    });
  } catch (error) {
    console.error('Discover sources error:', error);
    res.status(500).json({ error: 'Failed to discover sources' });
  }
});

/**
 * GET /discover/sources/:id
 * Get details about a specific newsletter source
 */
router.get('/sources/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sourceId = req.params.id;

    const source = await prisma.newsletterSource.findUnique({
      where: { id: sourceId },
      include: {
        editions: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
          include: {
            bytes: {
              orderBy: { engagementScore: 'desc' },
              take: 3,
            },
          },
        },
        subscriptions: {
          where: { userId },
          take: 1,
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      id: source.id,
      name: source.name,
      description: source.description,
      category: source.category,
      tags: source.tags,
      subscriberCount: source.subscriberCount,
      avgEngagementScore: source.avgEngagementScore,
      isVerified: source.isVerified,
      isSubscribed: source.subscriptions.length > 0,
      recentEditions: source.editions.map((edition) => ({
        id: edition.id,
        subject: edition.subject,
        summary: edition.summary,
        publishedAt: edition.publishedAt,
        topBytes: edition.bytes.map((byte) => ({
          id: byte.id,
          content: byte.content,
          type: byte.type,
          engagementScore: byte.engagementScore,
        })),
      })),
    });
  } catch (error) {
    console.error('Get source error:', error);
    res.status(500).json({ error: 'Failed to get source details' });
  }
});

/**
 * POST /discover/sources/:id/subscribe
 * Subscribe to a newsletter source
 */
router.post('/sources/:id/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sourceId = req.params.id;
    const { discoveryMethod } = req.body;

    // Check source exists
    const source = await prisma.newsletterSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Create or update subscription
    await prisma.userSubscription.upsert({
      where: { userId_sourceId: { userId, sourceId } },
      create: {
        userId,
        sourceId,
        discoveryMethod: discoveryMethod || 'search',
      },
      update: { isActive: true },
    });

    // Update subscriber count
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { subscriberCount: { increment: 1 } },
    });

    res.json({ success: true, isSubscribed: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * DELETE /discover/sources/:id/subscribe
 * Unsubscribe from a newsletter source
 */
router.delete('/sources/:id/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sourceId = req.params.id;

    // Update subscription
    await prisma.userSubscription.updateMany({
      where: { userId, sourceId },
      data: { isActive: false },
    });

    // Update subscriber count
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { subscriberCount: { decrement: 1 } },
    });

    res.json({ success: true, isSubscribed: false });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// =============================================================================
// TRENDING CONTENT
// =============================================================================

/**
 * GET /discover/trending
 * Get trending content bytes
 * Query params:
 *   - timeframe: 1h | 24h | 7d (default: 24h)
 *   - category: filter by category
 *   - limit: number (default: 20)
 */
router.get('/trending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const timeframe = (req.query.timeframe as string) || '24h';
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    // Calculate time cutoff
    const timeMap: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    const cutoff = new Date(Date.now() - (timeMap[timeframe] || timeMap['24h']));

    // Get trending bytes
    const bytes = await prisma.contentByte.findMany({
      where: {
        createdAt: { gte: cutoff },
        ...(category && { category }),
      },
      include: {
        edition: { include: { source: true } },
        engagements: { where: { userId }, take: 1 },
      },
      orderBy: { trendingScore: 'desc' },
      take: limit,
    });

    res.json({
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
      timeframe,
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to get trending content' });
  }
});

/**
 * GET /discover/popular
 * Get all-time popular content (great for new users)
 * Query params:
 *   - category: filter by category
 *   - limit: number (default: 20)
 */
router.get('/popular', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    // Get popular bytes
    const bytes = await prisma.contentByte.findMany({
      where: {
        ...(category && { category }),
        // Only show content with minimum engagement
        engagementScore: { gte: 5 },
      },
      include: {
        edition: { include: { source: true } },
        engagements: { where: { userId }, take: 1 },
      },
      orderBy: { engagementScore: 'desc' },
      take: limit,
    });

    res.json({
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
    });
  } catch (error) {
    console.error('Popular error:', error);
    res.status(500).json({ error: 'Failed to get popular content' });
  }
});

/**
 * GET /discover/categories
 * Get all available categories with counts
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Group by category
    const categories = await prisma.contentByte.groupBy({
      by: ['category'],
      _count: { id: true },
      _avg: { engagementScore: true },
      orderBy: { _count: { id: 'desc' } },
    });

    res.json({
      categories: categories.map((cat) => ({
        name: cat.category,
        count: cat._count.id,
        avgEngagement: cat._avg.engagementScore || 0,
      })),
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// =============================================================================
// FOR NEW USERS - ONBOARDING CONTENT
// =============================================================================

/**
 * GET /discover/onboarding
 * Get curated content for new users who haven't forwarded any newsletters
 * Returns a mix of most engaged content across categories
 */
router.get('/onboarding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);

    // Get user to check if they're truly new
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        contentHistory: { take: 1 },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isNewUser = user.subscriptions.length === 0 && user.contentHistory.length === 0;

    // For new users, get the best content from verified sources
    const bytes = await prisma.contentByte.findMany({
      where: {
        // Prioritize verified and high-engagement content
        edition: {
          source: {
            isVerified: true,
          },
        },
        // Minimum quality threshold
        engagementScore: { gte: 10 },
        qualityScore: { gte: 0.7 },
      },
      include: {
        edition: { include: { source: true } },
      },
      orderBy: [
        { engagementScore: 'desc' },
        { qualityScore: 'desc' },
      ],
      take: limit,
    });

    // If not enough verified content, supplement with popular
    if (bytes.length < limit) {
      const additionalBytes = await prisma.contentByte.findMany({
        where: {
          id: { notIn: bytes.map((b) => b.id) },
          engagementScore: { gte: 5 },
        },
        include: {
          edition: { include: { source: true } },
        },
        orderBy: { engagementScore: 'desc' },
        take: limit - bytes.length,
      });
      bytes.push(...additionalBytes);
    }

    // Get suggested sources to follow
    const suggestedSources = await prisma.newsletterSource.findMany({
      where: {
        isVerified: true,
        subscriberCount: { gte: 10 },
      },
      orderBy: { avgEngagementScore: 'desc' },
      take: 5,
    });

    res.json({
      isNewUser,
      welcomeMessage: isNewUser
        ? "Welcome! Here's some of our most loved content to get you started."
        : "Discover popular content from our community.",
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
      suggestedSources: suggestedSources.map((source) => ({
        id: source.id,
        name: source.name,
        description: source.description,
        category: source.category,
        subscriberCount: source.subscriberCount,
        isVerified: source.isVerified,
      })),
    });
  } catch (error) {
    console.error('Onboarding content error:', error);
    res.status(500).json({ error: 'Failed to get onboarding content' });
  }
});

// =============================================================================
// SPONSORED CONTENT (Monetization)
// =============================================================================

/**
 * GET /discover/sponsored
 * Get sponsored content for users who enabled recommendations
 */
router.get('/sponsored', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 1, 5);

    // Check if user enabled recommendations
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { enableRecommendations: true },
    });

    if (!user?.enableRecommendations) {
      return res.json({ bytes: [], message: 'Recommendations not enabled' });
    }

    // Get sponsored content user hasn't seen
    const seenByteIds = await prisma.contentHistory.findMany({
      where: { userId },
      select: { byteId: true },
    });

    const bytes = await prisma.contentByte.findMany({
      where: {
        isSponsored: true,
        id: { notIn: seenByteIds.map((s) => s.byteId) },
      },
      include: {
        edition: { include: { source: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      bytes: bytes.map((byte) => formatByteResponse(byte, userId)),
    });
  } catch (error) {
    console.error('Sponsored error:', error);
    res.status(500).json({ error: 'Failed to get sponsored content' });
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
