/**
 * Internal Routes - Cron jobs and admin endpoints
 *
 * These endpoints are protected by a secret key and should only
 * be called by trusted services (Cloudflare Workers, cron jobs, etc.)
 */

import { Router, Request, Response } from 'express';
import {
  processBatch,
  getQueueStats,
  resetFailedEditions,
} from '../services/processingQueue';

const router = Router();

// Secret key for internal endpoints
const INTERNAL_SECRET = process.env.INTERNAL_CRON_SECRET || process.env.CLOUDFLARE_WEBHOOK_SECRET || '';

/**
 * Middleware to verify internal secret
 */
function verifyInternalSecret(req: Request, res: Response, next: () => void) {
  const providedSecret = req.headers['x-cron-secret'] || req.headers['x-internal-secret'];

  // In development, allow without secret
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!INTERNAL_SECRET) {
    console.warn('[Internal] No INTERNAL_CRON_SECRET configured');
    return next(); // Allow if not configured (for initial setup)
  }

  if (providedSecret !== INTERNAL_SECRET) {
    console.warn('[Internal] Invalid secret provided');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}

// Apply middleware to all routes
router.use(verifyInternalSecret);

/**
 * POST /internal/process-queue
 *
 * Process pending newsletters in the queue.
 * Should be called by Cloudflare Worker every 5 minutes.
 *
 * Rate limits respected:
 * - 10 RPM (max 10 editions per batch)
 * - ~6.5s delay between requests
 * - ~50 editions per 5-minute window
 */
router.post('/process-queue', async (req: Request, res: Response) => {
  console.log('[Cron] Processing queue triggered');

  try {
    const startTime = Date.now();
    const result = await processBatch();
    const duration = Date.now() - startTime;

    console.log(`[Cron] Batch complete in ${duration}ms: ${result.succeeded}/${result.processed} succeeded`);

    res.json({
      success: true,
      duration,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Process queue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /internal/queue-stats
 *
 * Get current queue statistics.
 */
router.get('/queue-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('[Internal] Queue stats error:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

/**
 * POST /internal/reset-failed
 *
 * Reset all failed editions to pending (for retry).
 */
router.post('/reset-failed', async (req: Request, res: Response) => {
  try {
    const count = await resetFailedEditions();
    res.json({
      success: true,
      resetCount: count,
    });
  } catch (error) {
    console.error('[Internal] Reset failed error:', error);
    res.status(500).json({ error: 'Failed to reset failed editions' });
  }
});

/**
 * GET /internal/health
 *
 * Health check for the cron worker.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
