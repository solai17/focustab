import { useMemo } from 'react';

interface MortalityBarProps {
  name: string;
  sundaysRemaining: number;
  percentLived: number;
}

// Format name properly - handle email prefixes like "apple.solai" -> "Apple"
function formatDisplayName(name: string): string {
  if (!name) return '';

  // Get first part (before space or dot)
  const firstName = name.split(/[\s.]/)[0];

  // Capitalize first letter
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

// Wisdom messages that connect mortality awareness to living intentionally
const WISDOM_MESSAGES = [
  "Time is your most precious currency.",
  "Each moment is an invitation to live fully.",
  "What matters most to you today?",
  "Your attention shapes your reality.",
  "Health and time—guard them wisely.",
  "Make this moment count.",
];

export function MortalityBar({ name, sundaysRemaining, percentLived }: MortalityBarProps) {
  const displayName = useMemo(() => formatDisplayName(name), [name]);
  const formattedSundays = sundaysRemaining.toLocaleString();

  // Select a consistent wisdom message based on the day
  const wisdomMessage = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return WISDOM_MESSAGES[dayOfYear % WISDOM_MESSAGES.length];
  }, []);

  // Calculate life stages for visual representation
  const lifeStage = useMemo(() => {
    if (percentLived < 25) return { label: 'Spring', emoji: '🌱' };
    if (percentLived < 50) return { label: 'Summer', emoji: '☀️' };
    if (percentLived < 75) return { label: 'Autumn', emoji: '🍂' };
    return { label: 'Winter', emoji: '❄️' };
  }, [percentLived]);

  return (
    <div className="opacity-0 animate-fade-in text-center">
      {/* Wisdom Connection */}
      <div className="mb-6">
        <p className="text-smoke/60 text-sm italic mb-1">
          {wisdomMessage}
        </p>
      </div>

      {/* Main Counter */}
      <div className="mb-6">
        <p className="text-smoke text-xs uppercase tracking-[0.2em] mb-2">
          {displayName ? `${displayName}'s` : 'Your'} Sundays Remaining
        </p>
        <h1 className="font-display text-6xl md:text-7xl font-medium text-pearl mb-3">
          <span className="text-life">{formattedSundays}</span>
        </h1>
      </div>

      {/* Life Journey Visualization */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <span className="text-xs text-smoke/40">Birth</span>
        <div className="relative w-48 h-2 bg-ash/30 rounded-full overflow-hidden">
          {/* Lived portion */}
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-life/40 via-life to-life/80 rounded-full transition-all duration-1000"
            style={{ width: `${percentLived}%` }}
          />
          {/* Current position marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-life rounded-full shadow-lg shadow-life/50 transition-all duration-1000"
            style={{ left: `calc(${percentLived}% - 6px)` }}
          />
        </div>
        <span className="text-xs text-smoke/40">{lifeStage.emoji}</span>
      </div>

      {/* Percentage */}
      <p className="text-smoke/50 text-xs mb-8">
        {percentLived.toFixed(0)}% of your journey
      </p>

      {/* Subtle Divider */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="w-12 h-px bg-gradient-to-r from-transparent to-ash/30" />
        <div className="w-1.5 h-1.5 rounded-full bg-life/20" />
        <div className="w-12 h-px bg-gradient-to-l from-transparent to-ash/30" />
      </div>
    </div>
  );
}

export default MortalityBar;
