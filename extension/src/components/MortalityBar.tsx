import { useMemo } from 'react';

interface MortalityBarProps {
  name: string;
  sundaysRemaining: number;
  percentLived: number;
}

export function MortalityBar({ name, sundaysRemaining, percentLived }: MortalityBarProps) {
  const firstName = useMemo(() => name.split(' ')[0], [name]);
  const formattedSundays = sundaysRemaining.toLocaleString();

  return (
    <div className="opacity-0 animate-fade-in text-center">
      {/* Main Message */}
      <div className="mb-8">
        <p className="text-smoke text-sm uppercase tracking-widest mb-3">
          {firstName ? `${firstName}'s` : 'Your'} Sundays remaining
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-medium text-pearl mb-4">
          <span className="text-life">{formattedSundays}</span>
        </h1>

        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-40 h-1 bg-ash rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-life/60 to-life rounded-full life-bar-fill"
              style={{ width: `${percentLived}%` }}
            />
          </div>
          <span className="text-smoke/60 text-xs font-mono">
            {percentLived.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="w-16 h-px bg-gradient-to-r from-transparent to-ash/50" />
        <div className="w-1 h-1 rounded-full bg-life/30" />
        <div className="w-16 h-px bg-gradient-to-l from-transparent to-ash/50" />
      </div>
    </div>
  );
}

export default MortalityBar;
