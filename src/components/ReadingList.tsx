import { BookOpen, Clock, Check, ChevronRight } from 'lucide-react';
import type { Newsletter } from '../types';
import { formatRelativeDate } from '../utils/storage';

interface ReadingListProps {
  newsletters: Newsletter[];
  onRead: (newsletter: Newsletter) => void;
}

export function ReadingList({ newsletters, onRead }: ReadingListProps) {
  const unread = newsletters.filter(n => !n.isRead);
  const displayList = unread.length > 0 ? unread.slice(0, 3) : newsletters.slice(0, 3);

  return (
    <div className="opacity-0 animate-slide-up stagger-3">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-life" />
        <span className="text-xs uppercase tracking-widest text-smoke font-medium">
          Read Today
        </span>
        {unread.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-life/10 text-life rounded-full">
            {unread.length} unread
          </span>
        )}
      </div>

      <div className="space-y-3">
        {displayList.map((newsletter, index) => (
          <NewsletterCard
            key={newsletter.id}
            newsletter={newsletter}
            onClick={() => onRead(newsletter)}
            style={{ animationDelay: `${0.4 + index * 0.1}s` }}
          />
        ))}

        {newsletters.length === 0 && (
          <div className="text-center py-8 text-smoke">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No newsletters yet</p>
            <p className="text-xs text-smoke/60 mt-1">
              Forward newsletters to your inbox to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface NewsletterCardProps {
  newsletter: Newsletter;
  onClick: () => void;
  style?: React.CSSProperties;
}

function NewsletterCard({ newsletter, onClick, style }: NewsletterCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-slate/50 border border-ash/50 card-hover group opacity-0 animate-fade-in"
      style={style}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Source and time */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-life">{newsletter.source}</span>
            <span className="text-ash">·</span>
            <span className="text-xs text-smoke flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {newsletter.readTimeMinutes} min
            </span>
            {newsletter.isRead && (
              <>
                <span className="text-ash">·</span>
                <span className="text-xs text-smoke flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Read
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-pearl group-hover:text-white transition-colors line-clamp-1">
            {newsletter.title}
          </h3>

          {/* Key insight */}
          <p className="text-sm text-smoke mt-1 line-clamp-2">
            {newsletter.keyInsight}
          </p>

          {/* Date */}
          <p className="text-xs text-smoke/60 mt-2">
            {formatRelativeDate(newsletter.receivedAt)}
          </p>
        </div>

        <ChevronRight className="w-5 h-5 text-smoke group-hover:text-pearl transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
