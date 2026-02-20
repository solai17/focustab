/**
 * Content Bytes Quality Audit Script
 *
 * Uses Claude Opus to evaluate content bytes for quality and removes low-quality content.
 *
 * Evaluation Criteria:
 * - Standalone clarity and insightfulness
 * - Actionability
 * - Memorability
 * - Value to the reader
 *
 * Usage:
 *   npx ts-node scripts/audit-content-bytes.ts
 *
 * Options (via environment):
 *   DRY_RUN=true         - Don't actually delete, just report
 *   BATCH_SIZE=50        - Number of bytes per API call (default: 50)
 *   MIN_QUALITY=0.6      - Minimum quality score to keep (default: 0.6)
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10);
const MIN_QUALITY_SCORE = parseFloat(process.env.MIN_QUALITY || '0.6');
const DRY_RUN = process.env.DRY_RUN === 'true';
const MODEL = 'claude-sonnet-4-6'; // Claude Sonnet 4.6

interface ByteForAudit {
  id: string;
  content: string;
  type: string;
  category: string;
  author: string | null;
}

interface AuditResult {
  id: string;
  score: number;
  reason: string;
}

const AUDIT_PROMPT = `You are evaluating content bytes for a wisdom/insight app. Each byte should be a standalone piece of valuable content that users see when opening a new browser tab.

Rate each byte on a scale of 0.0 to 1.0 based on these criteria:

**EVALUATION CRITERIA:**

1. **Standalone Clarity (25%)**: Can someone understand this without any context? Is it self-contained?
   - 1.0: Crystal clear, needs no explanation
   - 0.5: Somewhat clear but could use context
   - 0.0: Confusing or requires external knowledge

2. **Insightfulness (25%)**: Does it offer a non-obvious truth or perspective shift?
   - 1.0: "Aha!" moment, changes how you think
   - 0.5: Interesting but common knowledge
   - 0.0: Obvious, cliché, or empty platitude

3. **Actionability (25%)**: Can the reader do something with this?
   - 1.0: Clear action or mental model to apply
   - 0.5: Inspirational but vague on application
   - 0.0: Pure abstraction with no practical value

4. **Memorability (25%)**: Would someone remember and share this?
   - 1.0: Quotable, sticky, worth saving
   - 0.5: Good but forgettable
   - 0.0: Generic filler content

**AUTOMATIC LOW SCORES (< 0.4):**
- Promotional content or CTAs
- News/dated information
- Incomplete thoughts
- Generic motivational fluff ("Believe in yourself!")
- Content requiring the original article to understand

**SCORING GUIDE:**
- 0.9-1.0: Exceptional - life-changing insight, universally valuable
- 0.8-0.89: Excellent - most people would save/share
- 0.7-0.79: Good - valuable to interested readers
- 0.6-0.69: Acceptable - decent but not special
- 0.4-0.59: Below average - needs improvement
- 0.0-0.39: Poor - should be removed

Return a JSON array with evaluations for each byte:
[
  {
    "id": "byte-id-here",
    "score": 0.85,
    "reason": "Brief 5-10 word explanation"
  }
]

IMPORTANT: Return ONLY the JSON array, no markdown or explanation.`;

/**
 * Audit a batch of content bytes using Claude Opus
 */
async function auditBatch(bytes: ByteForAudit[]): Promise<AuditResult[]> {
  // Format bytes as a table for efficient processing
  const bytesTable = bytes.map((b, i) =>
    `[${i + 1}] ID: ${b.id}\nType: ${b.type} | Category: ${b.category}${b.author ? ` | Author: ${b.author}` : ''}\nContent: "${b.content}"\n`
  ).join('\n---\n');

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${AUDIT_PROMPT}

Here are ${bytes.length} content bytes to evaluate:

${bytesTable}`,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse audit response:', responseText.slice(0, 200));
      return [];
    }

    const results: AuditResult[] = JSON.parse(jsonMatch[0]);
    return results;
  } catch (error) {
    console.error('Audit batch error:', error);
    return [];
  }
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('='.repeat(60));
  console.log('CONTENT BYTES QUALITY AUDIT');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Min Quality Score: ${MIN_QUALITY_SCORE}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log('='.repeat(60));

  // Get total count
  const totalBytes = await prisma.contentByte.count();
  console.log(`\nTotal content bytes: ${totalBytes}`);

  // Get bytes that haven't been audited yet (isAudited = false)
  // To re-audit everything, use: REAUDIT_ALL=true npm run audit
  const reauditAll = process.env.REAUDIT_ALL === 'true';
  const unauditedBytes = await prisma.contentByte.findMany({
    where: reauditAll ? {} : { isAudited: false },
    select: {
      id: true,
      content: true,
      type: true,
      category: true,
      author: true,
      qualityScore: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Bytes to audit: ${unauditedBytes.length}`);

  let processed = 0;
  let updated = 0;
  let toDelete: string[] = [];
  let kept = 0;

  // Process in batches
  for (let i = 0; i < unauditedBytes.length; i += BATCH_SIZE) {
    const batch = unauditedBytes.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(unauditedBytes.length / BATCH_SIZE);

    console.log(`\n[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} bytes...`);

    const results = await auditBatch(batch);

    if (results.length === 0) {
      console.log('  ⚠️  No results from this batch, skipping...');
      continue;
    }

    // Process results
    for (const result of results) {
      const byte = batch.find(b => b.id === result.id);
      if (!byte) continue;

      processed++;

      if (result.score < MIN_QUALITY_SCORE) {
        toDelete.push(result.id);
        // Mark as audited and then delete immediately
        if (!DRY_RUN) {
          await prisma.contentByte.update({
            where: { id: result.id },
            data: {
              qualityScore: result.score,
              isAudited: true,
            },
          });
          // Delete immediately instead of waiting until end
          await prisma.contentByte.delete({
            where: { id: result.id },
          });
          console.log(`  ❌ [${result.score.toFixed(2)}] DELETED: "${byte.content.slice(0, 50)}..." - ${result.reason}`);
        } else {
          console.log(`  ❌ [${result.score.toFixed(2)}] "${byte.content.slice(0, 50)}..." - ${result.reason}`);
        }
      } else {
        kept++;
        // Update quality score and mark as audited
        if (!DRY_RUN) {
          const updated_byte = await prisma.contentByte.update({
            where: { id: result.id },
            data: {
              qualityScore: result.score,
              isAudited: true,
            },
          });
          // Verify the update happened
          if (updated_byte.qualityScore !== result.score) {
            console.log(`  ⚠️ UPDATE FAILED for ${result.id}`);
          }
        }
        updated++;
        if (result.score >= 0.85) {
          console.log(`  ✓ [${result.score.toFixed(2)}] SAVED: "${byte.content.slice(0, 50)}..." - ${result.reason}`);
        }
      }
    }

    // Progress update
    const progress = ((i + batch.length) / unauditedBytes.length * 100).toFixed(1);
    console.log(`  Progress: ${progress}% | Kept: ${kept} | To Delete: ${toDelete.length}`);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < unauditedBytes.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Delete low-quality bytes
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Kept (≥${MIN_QUALITY_SCORE}): ${kept}`);
  console.log(`To delete (<${MIN_QUALITY_SCORE}): ${toDelete.length}`);
  console.log(`Quality scores updated: ${updated}`);

  if (toDelete.length > 0) {
    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN - No bytes were deleted');
      console.log(`Would delete ${toDelete.length} bytes`);
    } else {
      console.log(`\n✓ Already deleted ${toDelete.length} low-quality bytes during processing`);
    }
  }

  // Show score distribution
  console.log('\n' + '='.repeat(60));
  console.log('SCORE DISTRIBUTION (after audit)');
  console.log('='.repeat(60));

  const distribution = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN "qualityScore" >= 0.9 THEN '0.9-1.0 (Exceptional)'
        WHEN "qualityScore" >= 0.8 THEN '0.8-0.89 (Excellent)'
        WHEN "qualityScore" >= 0.7 THEN '0.7-0.79 (Good)'
        WHEN "qualityScore" >= 0.6 THEN '0.6-0.69 (Acceptable)'
        WHEN "qualityScore" >= 0.4 THEN '0.4-0.59 (Below Avg)'
        ELSE '0.0-0.39 (Poor)'
      END as range,
      COUNT(*) as count
    FROM content_bytes
    GROUP BY range
    ORDER BY range DESC
  `;

  console.log(distribution);
}

// Run the audit
runAudit()
  .then(() => {
    console.log('\n✓ Audit complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
