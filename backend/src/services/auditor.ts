/**
 * In-server content quality auditor.
 *
 * Powers the admin portal's "Audit Unaudited Insights" button - scores
 * every unaudited byte with Claude, deletes low-quality ones, and keeps
 * a live status object the portal polls for progress.
 *
 * The standalone script (npm run audit) remains for local runs; this is
 * the same logic running inside the API so the button actually works.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 50;
const MIN_QUALITY_SCORE = 0.6;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;

export interface AuditStatus {
  running: boolean;
  total: number;
  processed: number;
  kept: number;
  deleted: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastMessage: string;
  error: string | null;
}

const status: AuditStatus = {
  running: false,
  total: 0,
  processed: 0,
  kept: 0,
  deleted: 0,
  startedAt: null,
  finishedAt: null,
  lastMessage: 'No audit has run since the server started.',
  error: null,
};

export function getAuditStatus(): AuditStatus {
  return { ...status };
}

export function isAuditRunning(): boolean {
  return status.running;
}

const AUDIT_PROMPT = `You are evaluating content bytes for ByteLetters, whose promise is: every new browser tab leaves the reader a little wiser. Each byte is shown standalone for 10-30 seconds of attention.

Rate each byte from 0.0 to 1.0:

1. Standalone Clarity (25%): understandable with zero context?
2. Insightfulness (25%): a non-obvious truth or perspective shift?
3. Actionability (25%): can the reader do something with it?
4. Memorability (25%): would someone save or share it?

AUTOMATIC LOW SCORES (< 0.4):
- Promotional content or CTAs
- News or dated information
- Incomplete thoughts
- Generic motivational filler ("Believe in yourself!")
- Content that needs the original article to make sense

Return a JSON array only:
[{"id": "byte-id", "score": 0.85, "reason": "5-10 word explanation"}]`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AuditResult {
  id: string;
  score: number;
  reason: string;
}

async function auditBatch(
  bytes: { id: string; content: string; type: string; category: string; author: string | null }[]
): Promise<AuditResult[]> {
  const table = bytes
    .map(
      (b, i) =>
        `[${i + 1}] ID: ${b.id}\nType: ${b.type} | Category: ${b.category}${b.author ? ` | Author: ${b.author}` : ''}\nContent: "${b.content}"\n`
    )
    .join('\n---\n');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 6144,
        thinking: { type: 'disabled' }, // response parsed as raw JSON from content[0]
        messages: [
          { role: 'user', content: `${AUDIT_PROMPT}\n\nHere are ${bytes.length} content bytes to evaluate:\n\n${table}` },
        ],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]) as AuditResult[];
    } catch (error: any) {
      const retryable = [429, 500, 503, 529].includes(error?.status);
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw error;
    }
  }
  return [];
}

/**
 * Run a full audit of unaudited bytes. Fire asynchronously (setImmediate);
 * progress lands on the status object the admin portal polls.
 */
export async function runAuditJob(): Promise<void> {
  if (status.running) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    status.lastMessage = 'ANTHROPIC_API_KEY is not set on the server.';
    status.error = 'missing_api_key';
    return;
  }

  status.running = true;
  status.processed = 0;
  status.kept = 0;
  status.deleted = 0;
  status.startedAt = new Date().toISOString();
  status.finishedAt = null;
  status.error = null;

  try {
    const unaudited = await prisma.contentByte.findMany({
      where: { isAudited: false },
      select: { id: true, content: true, type: true, category: true, author: true },
      orderBy: { createdAt: 'asc' },
    });

    status.total = unaudited.length;
    status.lastMessage = `Auditing ${unaudited.length} insights in batches of ${BATCH_SIZE}...`;

    for (let i = 0; i < unaudited.length; i += BATCH_SIZE) {
      const batch = unaudited.slice(i, i + BATCH_SIZE);
      const results = await auditBatch(batch);

      for (const result of results) {
        if (!batch.some((b: { id: string }) => b.id === result.id)) continue;
        status.processed++;

        if (result.score < MIN_QUALITY_SCORE) {
          await prisma.contentByte.delete({ where: { id: result.id } }).catch(() => {});
          status.deleted++;
        } else {
          await prisma.contentByte
            .update({
              where: { id: result.id },
              data: { qualityScore: result.score, isAudited: true },
            })
            .catch(() => {});
          status.kept++;
        }
      }

      status.lastMessage = `Audited ${status.processed}/${status.total} - kept ${status.kept}, removed ${status.deleted}`;
      if (i + BATCH_SIZE < unaudited.length) await sleep(1500);
    }

    // Resync per-source insight counts after deletions
    const sources = await prisma.newsletterSource.findMany({ select: { id: true } });
    for (const source of sources) {
      const count = await prisma.contentByte.count({
        where: { edition: { sourceId: source.id }, isHidden: false },
      });
      await prisma.newsletterSource.update({
        where: { id: source.id },
        data: { totalInsights: count },
      });
    }

    status.lastMessage = `Done. ${status.kept} kept, ${status.deleted} removed of ${status.total} audited.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status.error = message;
    status.lastMessage = `Audit failed after ${status.processed} insights: ${message}`;
    console.error('[Auditor] Failed:', error);
  } finally {
    status.running = false;
    status.finishedAt = new Date().toISOString();
  }
}
