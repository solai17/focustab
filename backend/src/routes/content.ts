import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateToken } from '../middleware/auth';
import { calculateSundaysRemaining, calculatePercentLived } from '../services/utils';
import { AuthenticatedRequest, DailyContent } from '../types';

const router = Router();

/**
 * GET /content/today
 * Get daily content for the new tab page
 */
router.get('/today', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get user for life calculations
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get random inspiration (prefer unshown, then least shown)
    const inspiration = await prisma.inspiration.findFirst({
      where: { userId },
      orderBy: [
        { shownCount: 'asc' },
        { lastShownAt: 'asc' },
      ],
    });

    // Update shown count if we got an inspiration
    if (inspiration) {
      await prisma.inspiration.update({
        where: { id: inspiration.id },
        data: {
          shownCount: { increment: 1 },
          lastShownAt: new Date(),
        },
      });
    }

    // Get recent newsletters (unread first, then by date)
    const newsletters = await prisma.newsletter.findMany({
      where: { 
        userId,
        isProcessed: true,
      },
      orderBy: [
        { isRead: 'asc' },
        { receivedAt: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        subject: true,
        senderName: true,
        summary: true,
        keyInsight: true,
        readTimeMinutes: true,
        receivedAt: true,
        isRead: true,
      },
    });

    // Calculate life stats
    const stats = {
      sundaysRemaining: calculateSundaysRemaining(user.birthDate, user.lifeExpectancy),
      percentLived: calculatePercentLived(user.birthDate, user.lifeExpectancy),
    };

    const content: DailyContent = {
      inspiration: inspiration ? {
        id: inspiration.id,
        quote: inspiration.quote,
        author: inspiration.author,
        source: inspiration.source,
        category: inspiration.category,
      } : null,
      newsletters,
      stats,
    };

    res.json(content);
  } catch (error) {
    console.error('Get daily content error:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

/**
 * GET /content/inspiration/refresh
 * Get a new random inspiration
 */
router.get('/inspiration/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get a different inspiration (least shown)
    const inspiration = await prisma.inspiration.findFirst({
      where: { userId },
      orderBy: [
        { shownCount: 'asc' },
        { lastShownAt: 'asc' },
      ],
    });

    if (!inspiration) {
      res.json({ inspiration: null });
      return;
    }

    // Update shown count
    await prisma.inspiration.update({
      where: { id: inspiration.id },
      data: {
        shownCount: { increment: 1 },
        lastShownAt: new Date(),
      },
    });

    res.json({
      inspiration: {
        id: inspiration.id,
        quote: inspiration.quote,
        author: inspiration.author,
        source: inspiration.source,
        category: inspiration.category,
      },
    });
  } catch (error) {
    console.error('Refresh inspiration error:', error);
    res.status(500).json({ error: 'Failed to refresh inspiration' });
  }
});

/**
 * GET /content/newsletters
 * Get all newsletters for the user
 */
router.get('/newsletters', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { unreadOnly } = req.query;

    const where: Record<string, unknown> = { 
      userId,
      isProcessed: true,
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const newsletters = await prisma.newsletter.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        senderName: true,
        senderEmail: true,
        summary: true,
        keyInsight: true,
        readTimeMinutes: true,
        receivedAt: true,
        isRead: true,
      },
    });

    res.json({ newsletters });
  } catch (error) {
    console.error('Get newsletters error:', error);
    res.status(500).json({ error: 'Failed to get newsletters' });
  }
});

/**
 * GET /content/newsletter/:id
 * Get a single newsletter with full content
 */
router.get('/newsletter/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const newsletter = await prisma.newsletter.findFirst({
      where: { id, userId },
    });

    if (!newsletter) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    res.json({ newsletter });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ error: 'Failed to get newsletter' });
  }
});

/**
 * POST /content/newsletter/:id/read
 * Mark a newsletter as read
 */
router.post('/newsletter/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const newsletter = await prisma.newsletter.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    if (newsletter.count === 0) {
      res.status(404).json({ error: 'Newsletter not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * GET /content/stats
 * Get user statistics
 */
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [user, newsletterCount, inspirationCount, unreadCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.newsletter.count({ where: { userId } }),
      prisma.inspiration.count({ where: { userId } }),
      prisma.newsletter.count({ where: { userId, isRead: false } }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      stats: {
        sundaysRemaining: calculateSundaysRemaining(user.birthDate, user.lifeExpectancy),
        percentLived: calculatePercentLived(user.birthDate, user.lifeExpectancy),
        totalNewsletters: newsletterCount,
        totalInspirations: inspirationCount,
        unreadNewsletters: unreadCount,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
