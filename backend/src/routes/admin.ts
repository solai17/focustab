/**
 * Admin Routes for ByteLetters
 *
 * Protected routes for managing newsletters, insights, and scraping.
 * Uses whitelist-based authentication for admin access.
 */

import { Router, Response, NextFunction } from 'express';
import { prisma } from '../services/db';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// =============================================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// =============================================================================

// Admin email whitelist - in production, move to environment variable
const ADMIN_EMAILS = [
  'solaiyappan17@gmail.com',
  // Add more admin emails as needed
];

/**
 * Middleware to verify admin access
 * Must be used after authenticateToken
 */
async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isAdmin: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is in admin whitelist OR has isAdmin flag
    const isAdminUser = ADMIN_EMAILS.includes(user.email) || user.isAdmin;

    if (!isAdminUser) {
      console.warn(`[Admin] Unauthorized access attempt by: ${user.email}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Auto-set isAdmin flag if in whitelist but not flagged
    if (ADMIN_EMAILS.includes(user.email) && !user.isAdmin) {
      await prisma.user.update({
        where: { id: userId },
        data: { isAdmin: true },
      });
    }

    next();
  } catch (error) {
    console.error('[Admin] Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Apply authentication to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// =============================================================================
// DASHBOARD STATS
// =============================================================================

/**
 * GET /admin/stats
 * Get overall dashboard statistics
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalSources,
      curatedSources,
      totalEditions,
      totalInsights,
      pendingModeration,
      rejectedInsights,
      downvotedInsights,
      forwardedEmails,
      recentScrapeJobs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.newsletterSource.count(),
      prisma.newsletterSource.count({ where: { isCurated: true } }),
      prisma.edition.count(),
      prisma.contentByte.count(),
      prisma.contentByte.count({ where: { moderationStatus: 'pending' } }),
      prisma.contentByte.count({ where: { moderationStatus: 'rejected' } }),
      prisma.contentByte.count({ where: { downvotes: { gte: 3 } } }),
      prisma.forwardedEmail.count({ where: { status: 'pending' } }),
      prisma.scrapeJob.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        include: {
          // Note: We'll need to handle this manually since we don't have relation
        },
      }),
    ]);

    // Get insights by moderation status
    const moderationStats = await prisma.contentByte.groupBy({
      by: ['moderationStatus'],
      _count: { id: true },
    });

    // Get processing queue stats
    const processingStats = await prisma.edition.groupBy({
      by: ['processingStatus'],
      _count: { id: true },
    });

    res.json({
      users: { total: totalUsers },
      sources: {
        total: totalSources,
        curated: curatedSources,
      },
      editions: { total: totalEditions },
      insights: {
        total: totalInsights,
        pendingModeration,
        rejected: rejectedInsights,
        downvoted: downvotedInsights,
        byStatus: moderationStats.reduce((acc, s) => {
          acc[s.moderationStatus] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
      forwardedEmails: { pending: forwardedEmails },
      processing: processingStats.reduce((acc, s) => {
        acc[s.processingStatus] = s._count.id;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('[Admin] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// =============================================================================
// NEWSLETTER SOURCE MANAGEMENT
// =============================================================================

/**
 * GET /admin/sources
 * List all newsletter sources with stats
 */
router.get('/sources', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { curated, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = curated === 'true' ? { isCurated: true } : {};

    const [sources, total] = await Promise.all([
      prisma.newsletterSource.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              editions: true,
              subscriptions: true,
            },
          },
        },
      }),
      prisma.newsletterSource.count({ where }),
    ]);

    // Enrich with insight counts
    const enrichedSources = await Promise.all(
      sources.map(async (source) => {
        const insightCount = await prisma.contentByte.count({
          where: {
            edition: { sourceId: source.id },
          },
        });

        return {
          ...source,
          stats: {
            editions: source._count.editions,
            subscribers: source._count.subscriptions,
            insights: insightCount,
          },
        };
      })
    );

    res.json({
      sources: enrichedSources,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('[Admin] Sources list error:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * POST /admin/sources
 * Create a new newsletter source
 */
router.post('/sources', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      senderEmail,
      description,
      website,
      archiveUrl,
      category,
      logoUrl,
      isCurated = true,
      scrapingEnabled = true,
    } = req.body;

    // Validate required fields
    if (!name || !senderEmail) {
      return res.status(400).json({ error: 'Name and sender email are required' });
    }

    // Check for existing source
    const existing = await prisma.newsletterSource.findUnique({
      where: { senderEmail },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Source with this email already exists',
        existingId: existing.id,
      });
    }

    const source = await prisma.newsletterSource.create({
      data: {
        name,
        senderEmail,
        senderDomain: senderEmail.split('@')[1],
        description,
        website,
        archiveUrl,
        category: category || 'general',
        logoUrl,
        isCurated,
        scrapingEnabled,
        isVerified: true, // Admin-added sources are verified
      },
    });

    res.status(201).json({ source });
  } catch (error) {
    console.error('[Admin] Create source error:', error);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

/**
 * PATCH /admin/sources/:id
 * Update a newsletter source
 */
router.patch('/sources/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be directly updated
    delete updates.id;
    delete updates.createdAt;

    const source = await prisma.newsletterSource.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    res.json({ source });
  } catch (error) {
    console.error('[Admin] Update source error:', error);
    res.status(500).json({ error: 'Failed to update source' });
  }
});

/**
 * DELETE /admin/sources/:id
 * Delete a newsletter source (cascades to editions and insights)
 */
router.delete('/sources/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if source exists
    const source = await prisma.newsletterSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: { editions: true },
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Warn about cascade deletion
    if (source._count.editions > 0) {
      const { confirm } = req.body;
      if (confirm !== 'DELETE') {
        return res.status(400).json({
          error: 'This will delete all editions and insights. Send { confirm: "DELETE" } to proceed.',
          editionsCount: source._count.editions,
        });
      }
    }

    await prisma.newsletterSource.delete({ where: { id } });

    res.json({ success: true, deleted: source.name });
  } catch (error) {
    console.error('[Admin] Delete source error:', error);
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

// =============================================================================
// INSIGHT MODERATION
// =============================================================================

/**
 * GET /admin/insights
 * List insights with filters for moderation
 */
router.get('/insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status = 'pending',
      sourceId,
      minDownvotes,
      page = '1',
      limit = '50',
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};

    if (status && status !== 'all') {
      where.moderationStatus = status;
    }

    if (sourceId) {
      where.edition = { sourceId: sourceId as string };
    }

    if (minDownvotes) {
      where.downvotes = { gte: parseInt(minDownvotes as string) };
    }

    const [insights, total] = await Promise.all([
      prisma.contentByte.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: [
          { downvotes: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          edition: {
            include: {
              source: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.contentByte.count({ where }),
    ]);

    res.json({
      insights: insights.map((i) => ({
        id: i.id,
        content: i.content,
        type: i.type,
        author: i.author,
        category: i.category,
        qualityScore: i.qualityScore,
        moderationStatus: i.moderationStatus,
        rejectionReason: i.rejectionReason,
        engagement: {
          upvotes: i.upvotes,
          downvotes: i.downvotes,
          views: i.viewCount,
          saves: i.saveCount,
        },
        source: i.edition.source,
        createdAt: i.createdAt,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('[Admin] Insights list error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * POST /admin/insights/:id/moderate
 * Approve or reject an insight
 */
router.post('/insights/:id/moderate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const adminId = req.userId!;

    if (!['approve', 'reject', 'flag'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use: approve, reject, or flag' });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      flag: 'flagged',
    };

    const insight = await prisma.contentByte.update({
      where: { id },
      data: {
        moderationStatus: statusMap[action],
        moderatedBy: adminId,
        moderatedAt: new Date(),
        rejectionReason: action === 'reject' ? reason : null,
      },
    });

    res.json({
      success: true,
      insight: {
        id: insight.id,
        moderationStatus: insight.moderationStatus,
        moderatedAt: insight.moderatedAt,
      },
    });
  } catch (error) {
    console.error('[Admin] Moderate insight error:', error);
    res.status(500).json({ error: 'Failed to moderate insight' });
  }
});

/**
 * POST /admin/insights/bulk-moderate
 * Bulk approve/reject insights
 */
router.post('/insights/bulk-moderate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids, action, reason } = req.body;
    const adminId = req.userId!;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No insight IDs provided' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use: approve or reject' });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
    };

    const result = await prisma.contentByte.updateMany({
      where: { id: { in: ids } },
      data: {
        moderationStatus: statusMap[action],
        moderatedBy: adminId,
        moderatedAt: new Date(),
        rejectionReason: action === 'reject' ? reason : null,
      },
    });

    res.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error('[Admin] Bulk moderate error:', error);
    res.status(500).json({ error: 'Failed to bulk moderate' });
  }
});

// =============================================================================
// FORWARDED EMAILS REVIEW
// =============================================================================

/**
 * GET /admin/forwarded
 * List forwarded emails pending review
 */
router.get('/forwarded', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = 'pending', page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = status === 'all' ? {} : { status: status as string };

    const [emails, total] = await Promise.all([
      prisma.forwardedEmail.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { receivedAt: 'desc' },
      }),
      prisma.forwardedEmail.count({ where }),
    ]);

    res.json({
      emails,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('[Admin] Forwarded emails error:', error);
    res.status(500).json({ error: 'Failed to fetch forwarded emails' });
  }
});

/**
 * POST /admin/forwarded/:id/review
 * Review a forwarded email
 */
router.post('/forwarded/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, notes, createSource } = req.body;
    const adminId = req.userId!;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    let createdSourceId: string | null = null;

    // If approving and createSource is provided, create the newsletter source
    if (action === 'approve' && createSource) {
      const source = await prisma.newsletterSource.create({
        data: {
          name: createSource.name,
          senderEmail: createSource.senderEmail,
          senderDomain: createSource.senderEmail.split('@')[1],
          description: createSource.description,
          website: createSource.website,
          archiveUrl: createSource.archiveUrl,
          category: createSource.category || 'general',
          isCurated: true,
          scrapingEnabled: !!createSource.archiveUrl,
          isVerified: true,
        },
      });
      createdSourceId = source.id;
    }

    await prisma.forwardedEmail.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        createdSourceId,
      },
    });

    res.json({ success: true, createdSourceId });
  } catch (error) {
    console.error('[Admin] Review forwarded error:', error);
    res.status(500).json({ error: 'Failed to review email' });
  }
});

// =============================================================================
// SCRAPING MANAGEMENT
// =============================================================================

/**
 * GET /admin/scrape/jobs
 * List recent scrape jobs
 */
router.get('/scrape/jobs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId, status, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (sourceId) where.sourceId = sourceId;
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.scrapeJob.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { startedAt: 'desc' },
      }),
      prisma.scrapeJob.count({ where }),
    ]);

    // Enrich with source names
    const sourceIds = [...new Set(jobs.map((j) => j.sourceId))];
    const sources = await prisma.newsletterSource.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true },
    });
    const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

    res.json({
      jobs: jobs.map((j) => ({
        ...j,
        sourceName: sourceMap.get(j.sourceId) || 'Unknown',
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('[Admin] Scrape jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch scrape jobs' });
  }
});

/**
 * POST /admin/scrape/trigger
 * Trigger a scrape job for a source
 */
router.post('/scrape/trigger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId } = req.body;
    const adminId = req.userId!;

    if (!sourceId) {
      return res.status(400).json({ error: 'Source ID required' });
    }

    const source = await prisma.newsletterSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    if (!source.archiveUrl) {
      return res.status(400).json({ error: 'Source has no archive URL configured' });
    }

    // Create a scrape job record
    const job = await prisma.scrapeJob.create({
      data: {
        sourceId,
        triggeredBy: 'admin',
        adminUserId: adminId,
      },
    });

    // TODO: Actually trigger the scrape (queue it for background processing)
    // For now, we'll return the job ID and the actual scraping will be done separately

    res.json({
      success: true,
      job: {
        id: job.id,
        sourceId,
        sourceName: source.name,
        status: 'queued',
      },
      message: 'Scrape job queued. Run the scraper to process.',
    });
  } catch (error) {
    console.error('[Admin] Trigger scrape error:', error);
    res.status(500).json({ error: 'Failed to trigger scrape' });
  }
});

// =============================================================================
// DATA CLEANUP
// =============================================================================

/**
 * POST /admin/cleanup/users
 * Clean up all users (fresh start)
 */
router.post('/cleanup/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL_USERS') {
      return res.status(400).json({
        error: 'This will delete ALL users. Send { confirm: "DELETE_ALL_USERS" } to proceed.',
      });
    }

    // Delete all user-related data
    const result = await prisma.$transaction([
      prisma.contentHistory.deleteMany({}),
      prisma.userEngagement.deleteMany({}),
      prisma.userPreference.deleteMany({}),
      prisma.userSubscription.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);

    res.json({
      success: true,
      deleted: {
        contentHistory: result[0].count,
        engagements: result[1].count,
        preferences: result[2].count,
        subscriptions: result[3].count,
        users: result[4].count,
      },
    });
  } catch (error) {
    console.error('[Admin] Cleanup users error:', error);
    res.status(500).json({ error: 'Failed to cleanup users' });
  }
});

export default router;
