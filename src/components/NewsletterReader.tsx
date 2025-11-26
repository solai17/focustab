import { X, Clock, ExternalLink, Check } from 'lucide-react';
import type { Newsletter } from '../types';
import { formatRelativeDate } from '../utils/storage';

interface NewsletterReaderProps {
  newsletter: Newsletter;
  onClose: () => void;
  onMarkRead: () => void;
}

export function NewsletterReader({ newsletter, onClose, onMarkRead }: NewsletterReaderProps) {
  const handleMarkRead = () => {
    onMarkRead();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] bg-obsidian border border-ash rounded-2xl shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-ash">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-life">{newsletter.source}</span>
              <span className="text-ash">·</span>
              <span className="text-xs text-smoke flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {newsletter.readTimeMinutes} min read
              </span>
              <span className="text-ash">·</span>
              <span className="text-xs text-smoke">
                {formatRelativeDate(newsletter.receivedAt)}
              </span>
            </div>
            <h2 className="font-display text-xl text-pearl">{newsletter.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ash transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-smoke" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Key Insight Highlight */}
          <div className="mb-6 p-4 bg-life/5 border border-life/20 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-life/80 mb-2 block">
              Key Insight
            </span>
            <p className="text-pearl font-medium">{newsletter.keyInsight}</p>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-sm uppercase tracking-wider text-smoke mb-3">Summary</h3>
            <p className="text-pearl/90 leading-relaxed">{newsletter.summary}</p>
          </div>

          {/* Full Content (if available) */}
          {newsletter.fullContent && (
            <div className="prose prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: newsletter.fullContent }} />
            </div>
          )}

          {/* Demo notice */}
          {!newsletter.fullContent && (
            <div className="mt-8 p-6 border border-dashed border-ash rounded-xl text-center">
              <p className="text-smoke text-sm mb-2">
                Full newsletter content will appear here when you connect your inbox.
              </p>
              <p className="text-smoke/60 text-xs">
                In the demo version, we show the summary and key insight.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-ash">
          {newsletter.originalUrl && (
            <a
              href={newsletter.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-smoke hover:text-pearl border border-ash rounded-lg hover:border-smoke transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              View original
            </a>
          )}
          
          <div className="flex-1" />
          
          {!newsletter.isRead && (
            <button
              onClick={handleMarkRead}
              className="flex items-center gap-2 px-4 py-2.5 bg-life text-void font-medium rounded-lg hover:bg-life/90 transition-all"
            >
              <Check className="w-4 h-4" />
              Mark as read
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-smoke hover:text-pearl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
