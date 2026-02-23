import { useState, useEffect, useRef } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  RefreshCw,
  CheckCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { ContentByte, VoteValue } from '../types';

interface ByteCardProps {
  byte: ContentByte;
  onVote: (byteId: string, vote: VoteValue) => void;
  onSave: (byteId: string) => void;
  onShare: (byteId: string) => void;
  onNext: () => void;
  onView: (byteId: string, dwellTimeMs: number, isRead: boolean) => void;
  queueSize: number;
  isLoadingNext?: boolean;
}

export function ByteCard({
  byte,
  onVote,
  onSave,
  onShare,
  onNext,
  onView,
  queueSize,
  isLoadingNext = false,
}: ByteCardProps) {
  const [localVote, setLocalVote] = useState<VoteValue>(0);
  const [localSaved, setLocalSaved] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const viewStartTime = useRef(Date.now());
  const isReadRef = useRef(false);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTimeRef = useRef(0); // Accumulated active time in ms
  const lastActiveTimestamp = useRef(Date.now());

  const READ_THRESHOLD_MS = 5000; // 5 seconds of active tab time = read

  // Reset state when byte changes
  useEffect(() => {
    setLocalVote((byte.userEngagement?.vote as VoteValue) || 0);
    setLocalSaved(byte.userEngagement?.isSaved || false);
    viewStartTime.current = Date.now();
    isReadRef.current = false;
    activeTimeRef.current = 0;
    lastActiveTimestamp.current = Date.now();
  }, [byte.id]);

  // Track tab visibility to determine if user actually read the byte
  useEffect(() => {
    const startReadTimer = () => {
      // Calculate remaining time needed to hit threshold
      const remaining = READ_THRESHOLD_MS - activeTimeRef.current;
      if (remaining <= 0 || isReadRef.current) return;

      lastActiveTimestamp.current = Date.now();
      readTimerRef.current = setTimeout(() => {
        isReadRef.current = true;
        // Immediately send read signal so backend knows even if tab stays open
        const dwellTime = Date.now() - viewStartTime.current;
        onView(byte.id, dwellTime, true);
      }, remaining);
    };

    const pauseReadTimer = () => {
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      // Accumulate the active time so far
      activeTimeRef.current += Date.now() - lastActiveTimestamp.current;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startReadTimer();
      } else {
        pauseReadTimer();
      }
    };

    // Start tracking if tab is already visible
    if (document.visibilityState === 'visible') {
      startReadTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
      }
      // Send final dwell time on unmount (byte change or navigation)
      const dwellTime = Date.now() - viewStartTime.current;
      if (dwellTime > 1000) {
        onView(byte.id, dwellTime, isReadRef.current);
      }
    };
  }, [byte.id, onView]);

  const handleVote = (vote: VoteValue) => {
    const newVote = localVote === vote ? 0 : vote;
    setLocalVote(newVote);
    onVote(byte.id, newVote);
  };

  const handleSave = () => {
    setLocalSaved(!localSaved);
    onSave(byte.id);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `"${byte.content}"\n\n— ${byte.author || byte.source.name}`
      );
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
      onShare(byte.id);
    } catch {
      onShare(byte.id);
    }
  };

  // Get badge color based on type
  const getTypeBadgeColor = () => {
    switch (byte.type) {
      case 'quote':
        return 'bg-amber-500/20 text-amber-400';
      case 'insight':
        return 'bg-blue-500/20 text-blue-400';
      case 'statistic':
        return 'bg-green-500/20 text-green-400';
      case 'action':
        return 'bg-purple-500/20 text-purple-400';
      case 'takeaway':
        return 'bg-rose-500/20 text-rose-400';
      default:
        return 'bg-smoke/20 text-smoke';
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Main Card */}
      <div className="bg-obsidian/80 backdrop-blur-sm rounded-2xl p-8 border border-ash/30 shadow-2xl">
        {/* Header: Type Badge & Source */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getTypeBadgeColor()}`}
            >
              {byte.type}
            </span>
            {byte.context && (
              <span className="text-smoke text-sm">{byte.context}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-smoke text-sm">
            {byte.source.isVerified && (
              <CheckCircle className="w-4 h-4 text-life" />
            )}
            <a
              href={byte.source.website || `https://www.google.com/search?q=${encodeURIComponent(byte.source.name + ' newsletter subscribe')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-life/80 hover:text-life transition-colors group underline underline-offset-2 decoration-life/30 hover:decoration-life/60"
              title={byte.source.website ? `Read more from ${byte.source.name}` : `Find ${byte.source.name} newsletter`}
            >
              <span>{byte.source.name}</span>
              <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
            {byte.isSponsored && (
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded">
                Sponsored
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="relative mb-6">
          {/* Decorative Quote Mark */}
          {byte.type === 'quote' && (
            <div className="absolute -top-4 -left-2 text-6xl text-ash/30 font-serif select-none">
              "
            </div>
          )}

          <p className="text-pearl text-xl md:text-2xl leading-relaxed font-serif pl-6">
            {byte.content}
          </p>
        </div>

        {/* Author Attribution */}
        {byte.author && (
          <div className="mb-8 pl-6">
            <span className="text-smoke">—</span>
            <span className="text-pearl/80 ml-2 font-medium">{byte.author}</span>
          </div>
        )}

        {/* Engagement Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-ash/30">
          {/* Vote Buttons - No counts shown, just icons for user feedback */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote(1)}
              className={`p-2 rounded-lg transition-all ${
                localVote === 1
                  ? 'bg-life/20 text-life'
                  : 'hover:bg-ash/30 text-smoke hover:text-pearl'
              }`}
              title="I found this valuable"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>

            <button
              onClick={() => handleVote(-1)}
              className={`p-2 rounded-lg transition-all ${
                localVote === -1
                  ? 'bg-rose/20 text-rose'
                  : 'hover:bg-ash/30 text-smoke hover:text-pearl'
              }`}
              title="Not for me"
            >
              <ThumbsDown className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`p-2 rounded-lg transition-all ${
                localSaved
                  ? 'bg-amber/20 text-amber'
                  : 'hover:bg-ash/30 text-smoke hover:text-pearl'
              }`}
              title="Save for later"
            >
              <Bookmark className={`w-5 h-5 ${localSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-ash/30 text-smoke hover:text-pearl transition-all"
              title="Copy to clipboard"
            >
              <Share2 className="w-5 h-5" />
            </button>

            <button
              onClick={onNext}
              disabled={isLoadingNext}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ml-2 ${
                isLoadingNext
                  ? 'bg-ash/50 text-smoke cursor-wait'
                  : 'bg-ash/30 hover:bg-ash/50 text-pearl'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingNext ? 'animate-spin' : ''}`} />
              <span className="font-medium">{isLoadingNext ? 'Loading...' : 'Next'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Queue Indicator */}
      {queueSize > 0 && (
        <div className="flex items-center justify-center mt-4 gap-2 text-smoke text-sm">
          <Sparkles className="w-4 h-4" />
          <span>{queueSize} more bytes waiting</span>
        </div>
      )}

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-life/90 text-void px-4 py-2 rounded-lg font-medium animate-fade-in">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}

export default ByteCard;
