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
import { runScrapeJob, isSourceScraping } from '../services/scraper';

const router = Router();

// =============================================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// =============================================================================

// Admin email whitelist - in production, move to environment variable
const ADMIN_EMAILS = [
  'solaiyappan17@gmail.com',
  's.solaiyappan17@gmail.com',
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
      unauditedInsights,
      hiddenInsights,
      downvotedInsights,
      pendingRecommendations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.newsletterSource.count(),
      prisma.newsletterSource.count({ where: { isCurated: true } }),
      prisma.edition.count(),
      prisma.contentByte.count(),
      prisma.contentByte.count({ where: { isAudited: false } }),
      prisma.contentByte.count({ where: { isHidden: true } }),
      prisma.contentByte.count({ where: { downvotes: { gte: 3 } } }),
      prisma.newsletterRecommendation.count({ where: { status: 'pending' } }),
    ]);

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
        unaudited: unauditedInsights,
        hidden: hiddenInsights,
        downvoted: downvotedInsights,
      },
      recommendations: { pending: pendingRecommendations },
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

    // Latest edition date per source ("content up to") in one query
    const latestEditions = await prisma.edition.groupBy({
      by: ['sourceId'],
      where: { sourceId: { in: sources.map((s: { id: string }) => s.id) } },
      _max: { publishedAt: true },
    });
    const latestBySource = new Map<string, Date | null>(
      latestEditions.map((e: { sourceId: string; _max: { publishedAt: Date | null } }) => [e.sourceId, e._max.publishedAt])
    );

    // Enrich with insight counts + freshness
    const enrichedSources = await Promise.all(
      sources.map(async (source) => {
        const insightCount = await prisma.contentByte.count({
          where: {
            edition: { sourceId: source.id },
          },
        });

        return {
          ...source,
          latestEditionAt: latestBySource.get(source.id) || null,
          isScrapingNow: isSourceScraping(source.id),
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
 * GET /admin/sources/:id
 * Get a single newsletter source by ID
 */
router.get('/sources/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const source = await prisma.newsletterSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            editions: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({ source });
  } catch (error) {
    console.error('[Admin] Get source error:', error);
    res.status(500).json({ error: 'Failed to get source' });
  }
});

/**
 * PATCH /admin/sources/:id
 * Update a newsletter source
 */
router.patch('/sources/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Whitelist updatable fields - prevents mass assignment of stats,
    // verification flags, or other computed columns via crafted requests
    const ALLOWED_FIELDS = [
      'name', 'senderEmail', 'description', 'website', 'archiveUrl',
      'category', 'logoUrl', 'isCurated', 'scrapingEnabled', 'scrapeFrequency',
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    }

    // Keep senderDomain consistent when senderEmail changes
    if (typeof updates.senderEmail === 'string' && updates.senderEmail.includes('@')) {
      updates.senderDomain = (updates.senderEmail as string).split('@')[1];
    }

    const source = await prisma.newsletterSource.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    res.json({ source });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Another source already uses that sender email' });
    }
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
 * List insights with filters
 */
router.get('/insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      sourceId,
      hidden,
      audited,
      page = '1',
      limit = '100',
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};

    // Filter by visibility
    if (hidden === 'true') {
      where.isHidden = true;
    } else if (hidden === 'false') {
      where.isHidden = false;
    }

    // Filter by audit status
    if (audited === 'true') {
      where.isAudited = true;
    } else if (audited === 'false') {
      where.isAudited = false;
    }

    if (sourceId) {
      where.edition = { sourceId: sourceId as string };
    }

    const [insights, total, unauditedCount] = await Promise.all([
      prisma.contentByte.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: [
          { qualityScore: 'desc' },
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
      prisma.contentByte.count({ where: { isAudited: false } }),
    ]);

    res.json({
      insights: insights.map((i: any) => ({
        id: i.id,
        content: i.content,
        type: i.type,
        author: i.author,
        category: i.category,
        qualityScore: i.qualityScore,
        isAudited: i.isAudited,
        isHidden: i.isHidden || false,
        engagement: {
          upvotes: i.upvotes,
          downvotes: i.downvotes,
          viewCount: i.viewCount,
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
      unauditedCount,
    });
  } catch (error) {
    console.error('[Admin] Insights list error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * POST /admin/insights/:id/visibility
 * Show or hide an insight from users
 */
router.post('/insights/:id/visibility', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hidden } = req.body;

    await prisma.contentByte.update({
      where: { id },
      data: { isHidden: hidden === true },
    });

    res.json({ success: true, hidden: hidden === true });
  } catch (error) {
    console.error('[Admin] Update visibility error:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

/**
 * POST /admin/insights/trigger-audit
 * Inform admin to run the audit script
 */
router.post('/insights/trigger-audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unauditedCount = await prisma.contentByte.count({
      where: { isAudited: false },
    });

    res.json({
      success: true,
      unauditedCount,
      message: `Found ${unauditedCount} unaudited insights. Run 'npm run audit' in the backend folder to process them.`,
    });
  } catch (error) {
    console.error('[Admin] Trigger audit error:', error);
    res.status(500).json({ error: 'Failed to check unaudited count' });
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
      jobs: jobs.map((j: any) => {
        const { logs, ...rest } = j;
        return {
          ...rest,
          logCount: Array.isArray(logs) ? logs.length : 0, // full logs via /scrape/jobs/:id
          sourceName: sourceMap.get(j.sourceId) || 'Unknown',
        };
      }),
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
 * Start an incremental scrape for a source, running inside this server.
 * Progress and logs land on the ScrapeJob row (poll GET /admin/scrape/jobs/:id).
 */
router.post('/scrape/trigger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId, deep } = req.body;
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
      return res.status(400).json({ error: 'Source has no archive URL configured - add one in Edit first' });
    }

    if (isSourceScraping(sourceId)) {
      return res.status(409).json({ error: 'A scrape for this source is already running' });
    }

    const job = await prisma.scrapeJob.create({
      data: {
        sourceId,
        status: 'running',
        triggeredBy: 'admin',
        adminUserId: adminId,
      },
    });

    // Run in the background - the job row carries all progress
    setImmediate(() => {
      runScrapeJob(sourceId, job.id, { deep: deep === true }).catch((error) => {
        console.error('[Admin] Scrape job crashed:', error);
      });
    });

    res.json({
      success: true,
      job: {
        id: job.id,
        sourceId,
        sourceName: source.name,
        status: 'running',
      },
      message: 'Scrape started - watch progress in the Scraping tab.',
    });
  } catch (error) {
    console.error('[Admin] Trigger scrape error:', error);
    res.status(500).json({ error: 'Failed to trigger scrape' });
  }
});

/**
 * GET /admin/scrape/jobs/:id
 * Single job with full logs (polled by the admin portal while running)
 */
router.get('/scrape/jobs/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await prisma.scrapeJob.findUnique({
      where: { id: req.params.id },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const source = await prisma.newsletterSource.findUnique({
      where: { id: job.sourceId },
      select: { name: true },
    });
    res.json({ job: { ...job, sourceName: source?.name || 'Unknown' } });
  } catch (error) {
    console.error('[Admin] Get scrape job error:', error);
    res.status(500).json({ error: 'Failed to get scrape job' });
  }
});

// =============================================================================
// NEWSLETTER RECOMMENDATIONS
// =============================================================================

/**
 * GET /admin/recommendations
 * List newsletter recommendations from users
 */
router.get('/recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = 'pending' } = req.query;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const recommendations = await prisma.newsletterRecommendation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ recommendations });
  } catch (error) {
    console.error('[Admin] Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * POST /admin/recommendations/:id/approve
 * Approve a recommendation and create a source
 */
router.post('/recommendations/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.userId!;

    const recommendation = await prisma.newsletterRecommendation.findUnique({
      where: { id },
    });

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Category: admin override > user's first suggested tag > general
    const category: string =
      req.body.category || recommendation.tags?.[0] || 'general';

    // Parse and validate the recommended URL (user-submitted data)
    let hostname: string;
    try {
      const parsed = new URL(recommendation.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'Recommendation URL has an unsafe protocol' });
      }
      hostname = parsed.hostname;
    } catch {
      return res.status(400).json({ error: 'Recommendation has an invalid URL' });
    }

    // Reuse an existing source for this sender email instead of failing
    // on the unique constraint (two recommendations for the same domain)
    const senderEmail = `pending@${hostname}`;
    let source = await prisma.newsletterSource.findUnique({
      where: { senderEmail },
    });

    if (!source) {
      source = await prisma.newsletterSource.create({
        data: {
          name: recommendation.name,
          website: recommendation.url,
          senderEmail,
          senderDomain: hostname,
          category,
          isCurated: false, // Start as draft, admin can curate later
          description: 'Recommended by user',
        },
      });
    }

    // Update the recommendation
    await prisma.newsletterRecommendation.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        createdSourceId: source.id,
      },
    });

    res.json({ success: true, source });
  } catch (error) {
    console.error('[Admin] Approve recommendation error:', error);
    res.status(500).json({ error: 'Failed to approve recommendation' });
  }
});

/**
 * POST /admin/recommendations/:id/reject
 * Reject a recommendation
 */
router.post('/recommendations/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.userId!;

    await prisma.newsletterRecommendation.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Admin] Reject recommendation error:', error);
    res.status(500).json({ error: 'Failed to reject recommendation' });
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
