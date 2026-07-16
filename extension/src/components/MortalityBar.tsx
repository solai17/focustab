import { useMemo } from 'react';
import type { Milestone } from '../data/milestones';

interface MortalityBarProps {
  name: string;
  weekNumber: number;
  weeksRemaining: number;
  /** When set, this tab celebrates a freshly crossed milestone (amber variant) */
  milestone?: Milestone | null;
}

// Format name properly - get first word and capitalize
function formatDisplayName(name: string): string {
  if (!name) return '';

  // If name contains @, it's an email - get prefix before @
  const cleanName = name.includes('@') ? name.split('@')[0] : name;

  // Get first word (space-separated) for display
  const firstName = cleanName.includes('.') && cleanName.split('.').every(part => part.length <= 2)
    ? cleanName.split('.')[0]
    : cleanName.split(' ')[0];

  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

/**
 * The Ritual hero: every tab opens with a dated, personal imperative that
 * hands off - via a glowing thread - to the byte below it.
 *
 * Normal tab:     "Make week #1,897 count, Solai."
 * Milestone tab:  "1,000 bytes, Solai." (amber, shown once per milestone)
 */
export function MortalityBar({ name, weekNumber, weeksRemaining, milestone }: MortalityBarProps) {
  const displayName = useMemo(() => formatDisplayName(name), [name]);

  if (milestone) {
    return (
      <div className="opacity-0 animate-fade-in text-center mb-2">
        <p className="text-amber text-[0.68rem] uppercase tracking-[0.26em] mb-4">
          Milestone reached
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-medium text-pearl mb-3 text-balance">
          <em className="not-italic text-amber tabular-nums">{milestone.at.toLocaleString()}</em>{' '}
          bytes{displayName ? `, ${displayName}` : ''}.
        </h1>
        <p className="text-smoke text-[0.95rem]">{milestone.message}</p>

        {/* Amber thread into the byte */}
        <div className="relative w-px h-11 mx-auto mt-5 mb-1 bg-gradient-to-b from-amber/70 to-amber/5">
          <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-amber" />
        </div>
      </div>
    );
  }

  return (
    <div className="opacity-0 animate-fade-in text-center mb-2">
      <p className="text-life text-[0.68rem] uppercase tracking-[0.26em] mb-4">
        Byte-sized wisdom &middot; Every tab
      </p>
      <h1 className="font-display text-3xl md:text-4xl font-medium text-pearl mb-3 text-balance">
        Make week{' '}
        <em className="italic text-life tabular-nums">#{weekNumber.toLocaleString()}</em>{' '}
        count{displayName ? `, ${displayName}` : ''}.
      </h1>
      <p className="text-smoke text-[0.95rem]">
        <b className="text-pearl font-semibold tabular-nums">{weeksRemaining.toLocaleString()}</b>{' '}
        weeks remain. Here&rsquo;s a byte to leave this tab wiser.
      </p>

      {/* Thread into the byte */}
      <div className="relative w-px h-11 mx-auto mt-5 mb-1 bg-gradient-to-b from-life/70 to-life/5">
        <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-life" />
      </div>
    </div>
  );
}

export default MortalityBar;
