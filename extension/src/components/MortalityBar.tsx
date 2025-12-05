import { useMemo } from 'react';

interface MortalityBarProps {
  name: string;
  sundaysRemaining: number;
  percentLived: number;
}

// Contextual messages that connect mortality to content
const CONTEXT_MESSAGES = [
  "Make this moment count.",
  "What will you learn today?",
  "Time well spent starts now.",
  "Every moment is a choice.",
  "Wisdom awaits below.",
  "Feed your mind wisely.",
  "What matters to you today?",
  "Your attention is precious.",
];

export function MortalityBar({ name, sundaysRemaining, percentLived }: MortalityBarProps) {
  const firstName = useMemo(() => name.split(' ')[0], [name]);

  // Pick a consistent message based on the day
  const contextMessage = useMemo(() => {
    const dayIndex = new Date().getDay();
    return CONTEXT_MESSAGES[dayIndex % CONTEXT_MESSAGES.length];
  }, []);

  // Format the number with commas
  const formattedSundays = sundaysRemaining.toLocaleString();

  return (
    <div className="opacity-0 animate-fade-in text-center">
      {/* Main Message */}
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-medium text-pearl mb-1">
          {firstName ? (
            <>
              {firstName}, you have{' '}
              <span className="text-life font-semibold">{formattedSundays}</span>
              {' '}Sundays remaining.
            </>
          ) : (
            <>
              You have{' '}
              <span className="text-life font-semibold">{formattedSundays}</span>
              {' '}Sundays remaining.
            </>
          )}
        </h1>

        {/* Progress Bar - Compact inline version */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="w-32 h-1.5 bg-ash rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-life-dim to-life rounded-full life-bar-fill"
              style={{ width: `${percentLived}%` }}
            />
          </div>
          <span className="text-smoke text-sm font-mono">
            {percentLived.toFixed(0)}% lived
          </span>
        </div>
      </div>

      {/* Contextual Bridge Message */}
      <p className="text-smoke/70 text-lg font-light tracking-wide mb-8 animate-fade-in animation-delay-200">
        {contextMessage}
      </p>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="w-12 h-px bg-gradient-to-r from-transparent to-ash" />
        <div className="w-1.5 h-1.5 rounded-full bg-life/50" />
        <div className="w-12 h-px bg-gradient-to-l from-transparent to-ash" />
      </div>
    </div>
  );
}

export default MortalityBar;
