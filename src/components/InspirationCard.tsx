import { Sparkles, RefreshCw } from 'lucide-react';
import type { Inspiration } from '../types';

interface InspirationCardProps {
  inspiration: Inspiration;
  onRefresh: () => void;
}

export function InspirationCard({ inspiration, onRefresh }: InspirationCardProps) {
  return (
    <div className="opacity-0 animate-slide-up stagger-2">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-amber" />
        <span className="text-xs uppercase tracking-widest text-smoke font-medium">
          Inspiration
        </span>
        <button
          onClick={onRefresh}
          className="ml-auto p-1.5 rounded-lg hover:bg-ash transition-colors group"
          title="Get new inspiration"
        >
          <RefreshCw className="w-3.5 h-3.5 text-smoke group-hover:text-pearl transition-colors" />
        </button>
      </div>
      
      <blockquote className="relative">
        {/* Decorative quote mark */}
        <span className="absolute -top-2 -left-2 text-6xl text-ash font-display select-none">
          "
        </span>
        
        <p className="font-display text-xl md:text-2xl text-pearl leading-relaxed pl-6 pr-4">
          {inspiration.quote}
        </p>
        
        <footer className="mt-4 pl-6 flex items-center gap-2 text-sm">
          <span className="text-smoke">—</span>
          <cite className="not-italic text-pearl/80">{inspiration.author}</cite>
          {inspiration.source && (
            <>
              <span className="text-ash">·</span>
              <span className="text-smoke text-xs">{inspiration.source}</span>
            </>
          )}
        </footer>
      </blockquote>
    </div>
  );
}
