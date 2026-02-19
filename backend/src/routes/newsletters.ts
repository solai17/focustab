/**
 * Newsletter Routes for ByteLetters Extension
 *
 * Endpoints for browsing and subscribing to curated newsletters.
 * Used by the Sources screen in the extension.
 */

import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =============================================================================
// CURATED NEWSLETTERS
// =============================================================================

/**
 * GET /newsletters
 * List all curated newsletters with user subscription status
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category } = req.query;

    // Build where clause for curated sources
    const where: any = { isCurated: true };
    if (category && category !== 'all') {
      where.category = category as string;
    }

    // Get all curated sources
    const sources = await prisma.newsletterSource.findMany({
      where,
      orderBy: [
        { subscriberCount: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        website: true,
        logoUrl: true,
        category: true,
        subscriberCount: true,
        totalInsights: true,
        isVerified: true,
      },
    });

    // Get user's subscriptions
    const userSubscriptions = await prisma.userSubscription.findMany({
      where: { userId, isActive: true },
      select: { sourceId: true },
    });

    const subscribedIds = new Set(userSubscriptions.map((s) => s.sourceId));

    // Combine data
    const newsletters = sources.map((source) => ({
      ...source,
      isSubscribed: subscribedIds.has(source.id),
    }));

    // Get category counts for filtering
    const categoryStats = await prisma.newsletterSource.groupBy({
      by: ['category'],
      where: { isCurated: true },
      _count: { id: true },
    });

    res.json({
      newsletters,
      categories: categoryStats.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
      subscribedCount: subscribedIds.size,
    });
  } catch (error) {
    console.error('Newsletters list error:', error);
    res.status(500).json({ error: 'Failed to fetch newsletters' });
  }
});

/**
 * GET /newsletters/subscribed
 * Get only user's subscribed newsletters
 */
router.get('/subscribed', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const subscriptions = await prisma.userSubscription.findMany({
      where: { userId, isActive: true },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            description: true,
            website: true,
            logoUrl: true,
            category: true,
            subscriberCount: true,
            totalInsights: true,
            isVerified: true,
          },
        },
      },
      orderBy: { subscribedAt: 'desc' },
    });

    res.json({
      newsletters: subscriptions.map((s) => ({
        ...s.source,
        isSubscribed: true,
        subscribedAt: s.subscribedAt,
      })),
    });
  } catch (error) {
    console.error('Subscribed newsletters error:', error);
    res.status(500).json({ error: 'Failed to fetch subscribed newsletters' });
  }
});

/**
 * POST /newsletters/:id/subscribe
 * Subscribe to a newsletter
 */
router.post('/:id/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sourceId = req.params.id;

    // Verify source exists and is curated
    const source = await prisma.newsletterSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }

    if (!source.isCurated) {
      return res.status(400).json({ error: 'Newsletter is not available for subscription' });
    }

    // Create or reactivate subscription
    const subscription = await prisma.userSubscription.upsert({
      where: {
        userId_sourceId: { userId, sourceId },
      },
      create: {
        userId,
        sourceId,
        isActive: true,
        discoveryMethod: 'browse',
      },
      update: {
        isActive: true,
        subscribedAt: new Date(),
      },
    });

    // Update subscriber count
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { subscriberCount: { increment: 1 } },
    });

    res.json({
      success: true,
      subscription: {
        sourceId,
        isSubscribed: true,
        subscribedAt: subscription.subscribedAt,
      },
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * POST /newsletters/:id/unsubscribe
 * Unsubscribe from a newsletter
 */
router.post('/:id/unsubscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sourceId = req.params.id;

    // Find existing subscription
    const existing = await prisma.userSubscription.findUnique({
      where: {
        userId_sourceId: { userId, sourceId },
      },
    });

    if (!existing || !existing.isActive) {
      return res.status(400).json({ error: 'Not subscribed to this newsletter' });
    }

    // Deactivate subscription
    await prisma.userSubscription.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    // Update subscriber count
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { subscriberCount: { decrement: 1 } },
    });

    res.json({
      success: true,
      subscription: {
        sourceId,
        isSubscribed: false,
      },
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * POST /newsletters/subscribe-all
 * Subscribe to all curated newsletters (for onboarding)
 */
router.post('/subscribe-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get all curated sources
    const curatedSources = await prisma.newsletterSource.findMany({
      where: { isCurated: true },
      select: { id: true },
    });

    // Get existing subscriptions
    const existing = await prisma.userSubscription.findMany({
      where: { userId },
      select: { sourceId: true },
    });
    const existingIds = new Set(existing.map((e) => e.sourceId));

    // Create subscriptions for new sources
    const newSubscriptions = curatedSources
      .filter((s) => !existingIds.has(s.id))
      .map((s) => ({
        userId,
        sourceId: s.id,
        isActive: true,
        discoveryMethod: 'onboarding',
      }));

    if (newSubscriptions.length > 0) {
      await prisma.userSubscription.createMany({
        data: newSubscriptions,
      });

      // Update subscriber counts
      await prisma.newsletterSource.updateMany({
        where: {
          id: { in: newSubscriptions.map((s) => s.sourceId) },
        },
        data: { subscriberCount: { increment: 1 } },
      });
    }

    // Reactivate any inactive subscriptions
    await prisma.userSubscription.updateMany({
      where: {
        userId,
        sourceId: { in: curatedSources.map((s) => s.id) },
        isActive: false,
      },
      data: { isActive: true },
    });

    res.json({
      success: true,
      subscribedCount: curatedSources.length,
    });
  } catch (error) {
    console.error('Subscribe all error:', error);
    res.status(500).json({ error: 'Failed to subscribe to all' });
  }
});

export default router;
