/**
 * Value-streak milestone ladder.
 *
 * The streak counts bytes actually READ (tab active 5+ seconds), not days
 * opened - it can never break, only grow. Equivalence math: one newsletter
 * yields ~10 bytes, so bytes / 10 = newsletters distilled.
 */

export interface Milestone {
  at: number;
  name: string;
  message: string;
}

export const MILESTONES: Milestone[] = [
  { at: 10, name: 'First Bytes', message: '10 insights banked. The habit begins.' },
  { at: 50, name: 'Getting Wiser', message: '50 bytes ≈ 5 newsletters distilled.' },
  { at: 100, name: 'Century', message: '100 bytes ≈ 10 newsletters — nearly 2 hours of reading, compressed.' },
  { at: 250, name: 'Deep Reader', message: '250 bytes ≈ 25 newsletters. A month of inbox reading, distilled.' },
  { at: 500, name: 'Half Library', message: '500 bytes ≈ 50 newsletters. Half a library lives in your head now.' },
  { at: 1000, name: 'Librarian', message: '1,000 bytes ≈ 100 newsletters — most people never finish one. Kudos.' },
  { at: 2500, name: 'Scholar', message: "2,500 bytes ≈ 250 newsletters. You've read more wisdom than most read news." },
  { at: 5000, name: 'Sage', message: "5,000 bytes ≈ 500 newsletters. You're the reason we built this." },
];

/** Highest milestone at or below the given total (null if below the first). */
export function highestMilestoneReached(total: number): Milestone | null {
  let reached: Milestone | null = null;
  for (const m of MILESTONES) {
    if (total >= m.at) reached = m;
    else break;
  }
  return reached;
}

/** Next milestone above the given total (null once past the last one). */
export function nextMilestone(total: number): Milestone | null {
  for (const m of MILESTONES) {
    if (total < m.at) return m;
  }
  return null;
}

/** Tooltip line for the header chip, e.g. "18 to 500 ≈ 50 newsletters distilled". */
export function chipTooltip(total: number): string {
  const next = nextMilestone(total);
  if (!next) {
    return `${total.toLocaleString()} bytes read ≈ ${Math.floor(total / 10).toLocaleString()} newsletters distilled. Sage status.`;
  }
  const remaining = next.at - total;
  return `${remaining.toLocaleString()} to ${next.at.toLocaleString()} ≈ ${(next.at / 10).toLocaleString()} newsletters distilled`;
}
