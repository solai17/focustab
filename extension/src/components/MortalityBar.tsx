import { useMemo } from 'react';

interface MortalityBarProps {
  name: string;
  sundaysRemaining: number;
  percentLived: number;
}

export function MortalityBar({ name, sundaysRemaining, percentLived }: MortalityBarProps) {
  const firstName = useMemo(() => name.split(' ')[0], [name]);
  
  return (
    <div className="opacity-0 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-medium text-pearl mb-2">
          You have{' '}
          <span className="text-life font-semibold">
            {sundaysRemaining.toLocaleString()}
          </span>
          {' '}Sundays left
          {firstName && <span className="text-smoke">, {firstName}</span>}
        </h1>
        <p className="text-smoke text-sm font-mono">
          {percentLived.toFixed(1)}% of your journey complete
        </p>
      </div>
      
      {/* Progress bar container */}
      <div className="relative w-full max-w-2xl mx-auto">
        {/* Background track */}
        <div className="h-3 bg-ash rounded-full overflow-hidden">
          {/* Filled portion */}
          <div
            className="h-full bg-gradient-to-r from-life-dim via-life to-life rounded-full life-bar-fill relative"
            style={{ width: `${percentLived}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse-slow" />
          </div>
        </div>
        
        {/* Markers */}
        <div className="flex justify-between mt-2 text-xs text-smoke/60 font-mono">
          <span>Birth</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>∞</span>
        </div>
      </div>
    </div>
  );
}
