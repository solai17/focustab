/**
 * Processing Queue Service
 *
 * Manages the queue of newsletters waiting to be processed by AI.
 * Uses Claude Sonnet 4 for content extraction.
 *
 * Flow:
 * 1. Webhook stores email with status "pending"
 * 2. Cron job calls processBatch() every 5 minutes
 * 3. Each batch processes up to 10 editions
 * 4. Status updated to "completed" or "failed"
 */

import { prisma } from './db';
import { processEditionWithClaude } from './claude';

// Configuration
const MAX_BATCH_SIZE = 10; // Max editions per batch
const MAX_ATTEMPTS = 3;    // Max retry attempts before marking as failed
const PROCESSING_DELAY_MS = 2000; // Delay between requests (2s for safety)

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface ProcessingResult {
  editionId: string;
  success: boolean;
  bytesExtracted: number;
  error?: string;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.edition.count({ where: { processingStatus: 'pending' } }),
    prisma.edition.count({ where: { processingStatus: 'processing' } }),
    prisma.edition.count({ where: { processingStatus: 'completed' } }),
    prisma.edition.count({ where: { processingStatus: 'failed' } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}

/**
 * Get next batch of editions to process
 */
export async function getNextBatch(limit: number = MAX_BATCH_SIZE) {
  // First, reset any stale "processing" status (stuck for > 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.edition.updateMany({
    where: {
      processingStatus: 'processing',
      receivedAt: { lt: tenMinutesAgo },
    },
    data: {
      processingStatus: 'pending',
    },
  });

  // Get pending editions, prioritizing older ones
  // Include source with website field to determine if we need to extract source info
  return prisma.edition.findMany({
    where: {
      processingStatus: 'pending',
      processAttempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      source: {
        select: {
          id: true,
          name: true,
          website: true,
        },
      },
    },
    orderBy: { receivedAt: 'asc' },
    take: limit,
  });
}

/**
 * Process a single edition
 */
export async function processEdition(
  edition: {
    id: string;
    subject: string;
    textContent: string;
    source: { name: string; id: string; website: string | null };
  }
): Promise<ProcessingResult> {
  const { id, subject, textContent, source } = edition;

  try {
    // Mark as processing
    await prisma.edition.update({
      where: { id },
      data: {
        processingStatus: 'processing',
        processAttempts: { increment: 1 },
      },
    });

    // Check if we need to extract source info (only for sources without website)
    const needSourceInfo = source.website === null;

    console.log(`[Queue] Processing: "${subject}" from ${source.name}${needSourceInfo ? ' (extracting source info)' : ''}`);

    // Process with Claude AI
    // Pass extractSourceInfo flag if source doesn't have website yet
    const result = await processEditionWithClaude(subject, textContent, source.name, needSourceInfo);

    // Update source with extracted info if available
    if (needSourceInfo && result.newsletterInfo) {
      const updateData: { name?: string; website?: string } = {};

      // Update name if AI found a better one (and it's different from email-derived name)
      if (result.newsletterInfo.name && result.newsletterInfo.name !== source.name) {
        updateData.name = result.newsletterInfo.name;
      }

      // Update website if found
      if (result.newsletterInfo.website) {
        updateData.website = result.newsletterInfo.website;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.newsletterSource.update({
          where: { id: source.id },
          data: updateData,
        });
        console.log(`[Queue] Updated source: name=${updateData.name || source.name}, website=${updateData.website || 'not found'}`);
      }
    }

    // Save extracted bytes
    if (result.bytes.length > 0) {
      await prisma.contentByte.createMany({
        data: result.bytes.map((byte) => ({
          editionId: id,
          content: byte.content,
          type: byte.type,
          author: byte.author,
          context: byte.context,
          category: byte.category,
          qualityScore: byte.qualityScore,
        })),
      });
    }

    // Update edition status with model tracking
    await prisma.edition.update({
      where: { id },
      data: {
        processingStatus: 'completed',
        isProcessed: true,
        processedAt: new Date(),
        summary: result.summary,
        readTimeMinutes: result.readTimeMinutes,
        processedByModel: result.modelUsed || 'unknown',
        processingError: null,
      },
    });

    // Update source stats
    await prisma.newsletterSource.update({
      where: { id: source.id },
      data: {
        totalEngagement: { increment: result.bytes.length },
      },
    });

    console.log(`[Queue] ✓ Completed: ${result.bytes.length} bytes extracted`);

    return {
      editionId: id,
      success: true,
      bytesExtracted: result.bytes.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Queue] ✗ Failed: ${errorMessage}`);

    // Check if we've exceeded max attempts
    const edition = await prisma.edition.findUnique({ where: { id } });
    const attempts = (edition?.processAttempts || 0) + 1;

    await prisma.edition.update({
      where: { id },
      data: {
        processingStatus: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        processingError: errorMessage,
      },
    });

    return {
      editionId: id,
      success: false,
      bytesExtracted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Process a batch of editions
 * Respects rate limits by adding delays between requests
 */
export async function processBatch(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessingResult[];
}> {
  const batch = await getNextBatch();

  if (batch.length === 0) {
    console.log('[Queue] No pending editions to process');
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  console.log(`[Queue] Processing batch of ${batch.length} editions...`);

  const results: ProcessingResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const edition = batch[i];

    // Add delay between requests to respect rate limits (except for first)
    if (i > 0) {
      await sleep(PROCESSING_DELAY_MS);
    }

    const result = await processEdition(edition);
    results.push(result);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(`[Queue] Batch complete: ${succeeded} succeeded, ${failed} failed`);

  return {
    processed: batch.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Reset failed editions to pending (for retry)
 */
export async function resetFailedEditions(): Promise<number> {
  const result = await prisma.edition.updateMany({
    where: {
      processingStatus: 'failed',
    },
    data: {
      processingStatus: 'pending',
      processAttempts: 0,
      processingError: null,
    },
  });

  console.log(`[Queue] Reset ${result.count} failed editions to pending`);
  return result.count;
}

/**
 * Mark an edition as pending for processing
 */
export async function markEditionPending(editionId: string): Promise<void> {
  await prisma.edition.update({
    where: { id: editionId },
    data: {
      processingStatus: 'pending',
      processAttempts: 0,
      processingError: null,
    },
  });
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
