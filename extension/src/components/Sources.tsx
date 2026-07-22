import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Loader2, Library, ExternalLink, Send, Sparkles, RotateCw } from 'lucide-react';
import { storage } from '../utils/storage';

interface Newsletter {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  category: string;
  subscriberCount: number;
  totalInsights: number;
  isVerified: boolean;
  isSubscribed: boolean;
}

interface Category {
  name: string;
  count: number;
}

interface SourcesProps {
  /** Called on close; `subscriptionsChanged` tells the app to rebuild its byte queue */
  onClose: (subscriptionsChanged: boolean) => void;
}

// Topics a user can attach to a newsletter recommendation (mirrors backend)
const RECOMMEND_TAGS = [
  'wisdom', 'productivity', 'business', 'tech', 'life',
  'creativity', 'leadership', 'finance', 'health',
];
const MAX_TAGS = 3;

// Cache the newsletter list so the modal renders instantly on open
const SOURCES_CACHE_KEY = 'byteletters_sources_cache';

// Production builds always use the production API (see services/auth.ts)
const API_URL = import.meta.env.PROD
  ? 'https://api.byteletters.app'
  : (import.meta.env.VITE_API_URL || 'https://api.byteletters.app');

export function Sources({ onClose }: SourcesProps) {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());
  const [showRecommendForm, setShowRecommendForm] = useState(false);
  const [recName, setRecName] = useState('');
  const [recUrl, setRecUrl] = useState('');
  const [recTags, setRecTags] = useState<string[]>([]);
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recResult, setRecResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Tracks whether the user toggled any subscription this session
  const subscriptionsChangedRef = useRef(false);

  const handleClose = () => onClose(subscriptionsChangedRef.current);

  const toggleTag = (tag: string) => {
    setRecTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < MAX_TAGS
          ? [...prev, tag]
          : prev
    );
  };

  const applyData = useCallback((data: { newsletters: Newsletter[]; categories: Category[] }) => {
    setNewsletters(data.newsletters);
    setCategories([{ name: 'all', count: data.newsletters.length }, ...data.categories]);
  }, []);

  // Fetch with retries - a cold backend (free-tier spin-up) was causing
  // empty lists that only appeared after several manual refreshes
  const loadNewsletters = useCallback(async () => {
    setLoadFailed(false);

    const { getStoredAuth } = await import('../services/auth');
    const auth = await getStoredAuth();
    if (!auth?.token) {
      setLoading(false);
      setLoadFailed(true);
      return;
    }

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(`${API_URL}/newsletters`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (response.ok) {
          const data = await response.json();
          applyData(data);
          setLoading(false);
          // Cache for instant render next time
          void storage.set(SOURCES_CACHE_KEY, {
            newsletters: data.newsletters,
            categories: data.categories,
          });
          return;
        }
      } catch {
        // fall through to retry
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }

    setLoading(false);
    // Only surface the failure if we have nothing cached to show
    setNewsletters((prev) => {
      if (prev.length === 0) setLoadFailed(true);
      return prev;
    });
  }, [applyData]);

  useEffect(() => {
    // Instant render from cache, then refresh from the server
    (async () => {
      const cached = await storage.get<{ newsletters: Newsletter[]; categories: Category[] }>(SOURCES_CACHE_KEY);
      if (cached?.newsletters?.length) {
        applyData(cached);
        setLoading(false);
      }
      void loadNewsletters();
    })();
  }, [applyData, loadNewsletters]);

  const toggleSubscription = async (newsletter: Newsletter) => {
    if (subscribing.has(newsletter.id)) return;

    setSubscribing((prev) => new Set(prev).add(newsletter.id));

    // Optimistic flip - the toggle responds instantly
    const flip = (subscribed: boolean) =>
      setNewsletters((prev) =>
        prev.map((n) => (n.id === newsletter.id ? { ...n, isSubscribed: subscribed } : n))
      );
    flip(!newsletter.isSubscribed);

    try {
      const { getStoredAuth } = await import('../services/auth');
      const auth = await getStoredAuth();
      if (!auth?.token) {
        flip(newsletter.isSubscribed);
        return;
      }

      const endpoint = newsletter.isSubscribed ? 'unsubscribe' : 'subscribe';
      const response = await fetch(`${API_URL}/newsletters/${newsletter.id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (response.ok) {
        subscriptionsChangedRef.current = true;
      } else {
        flip(newsletter.isSubscribed); // revert on failure
      }
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
      flip(newsletter.isSubscribed); // revert on failure
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(newsletter.id);
        return next;
      });
    }
  };

  const submitRecommendation = async () => {
    if (!recName.trim() || !recUrl.trim()) return;

    setRecSubmitting(true);
    setRecResult(null);

    try {
      const { getStoredAuth } = await import('../services/auth');
      const auth = await getStoredAuth();
      if (!auth?.token) {
        setRecResult({ type: 'error', message: 'Please sign in to submit a recommendation.' });
        return;
      }

      const response = await fetch(`${API_URL}/feed/recommend-newsletter`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: recName.trim(), url: recUrl.trim(), tags: recTags }),
      });

      const data = await response.json();

      if (response.ok) {
        setRecResult({ type: 'success', message: 'Thanks! We\'ll review it and add it to the library soon.' });
        setRecName('');
        setRecUrl('');
        setRecTags([]);
        setTimeout(() => setShowRecommendForm(false), 3000);
      } else {
        setRecResult({ type: 'error', message: data.error || 'Failed to submit recommendation.' });
      }
    } catch {
      setRecResult({ type: 'error', message: 'Failed to connect. Please try again.' });
    } finally {
      setRecSubmitting(false);
    }
  };

  const filteredNewsletters =
    selectedCategory === 'all'
      ? newsletters
      : newsletters.filter((n) => n.category === selectedCategory);

  const subscribedCount = newsletters.filter((n) => n.isSubscribed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-obsidian border border-ash rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-5 border-b border-ash">
          <div className="flex items-start gap-3">
            <Library className="w-6 h-6 text-life mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-pearl">Your Sources</h2>
              <p className="text-sm text-smoke mt-1 leading-relaxed">
                Your new tabs show bytes only from newsletters that are switched on.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-ash/50 text-smoke hover:text-pearl transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-ash/60 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-life text-void font-medium'
                  : 'bg-slate/70 hover:bg-ash text-smoke hover:text-pearl'
              }`}
            >
              {cat.name === 'all' ? 'All' : cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-xs text-smoke/70 whitespace-nowrap pl-2">
            {subscribedCount} of {newsletters.length} on
          </span>
        </div>

        {/* Newsletter List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            /* Skeleton rows instead of a spinner - feels faster */
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate/30 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-ash/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-36 rounded bg-ash/60" />
                    <div className="h-2.5 w-24 rounded bg-ash/40" />
                  </div>
                  <div className="w-10 h-[22px] rounded-full bg-ash/50" />
                </div>
              ))}
            </div>
          ) : loadFailed ? (
            <div className="text-center py-12">
              <p className="text-smoke mb-1">Couldn't reach the server.</p>
              <p className="text-smoke/60 text-sm mb-5">It may be waking up — this takes a few seconds.</p>
              <button
                onClick={() => { setLoading(true); void loadNewsletters(); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-life text-void text-sm font-medium hover:bg-life/90 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          ) : filteredNewsletters.length === 0 ? (
            <div className="text-center py-12 text-smoke">
              <Library className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No newsletters in this topic yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredNewsletters.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    newsletter.isSubscribed ? 'bg-life/[0.06]' : 'bg-transparent hover:bg-slate/40'
                  }`}
                >
                  {/* Logo */}
                  <div className="w-9 h-9 rounded-lg bg-ash/70 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {newsletter.logoUrl ? (
                      <img src={newsletter.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-smoke">{newsletter.name.charAt(0)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-pearl text-sm truncate">{newsletter.name}</span>
                      {newsletter.isVerified && <Check className="w-3.5 h-3.5 text-life flex-shrink-0" />}
                      {newsletter.website && (
                        <a
                          href={newsletter.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-smoke/50 hover:text-life flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title={`Visit ${newsletter.name}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-smoke/80 mt-0.5 capitalize">
                      {newsletter.category}
                      {newsletter.totalInsights > 0 && (
                        <span className="text-smoke/60"> · {newsletter.totalInsights.toLocaleString()} bytes</span>
                      )}
                    </p>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleSubscription(newsletter)}
                    disabled={subscribing.has(newsletter.id)}
                    role="switch"
                    aria-checked={newsletter.isSubscribed}
                    aria-label={`${newsletter.isSubscribed ? 'Turn off' : 'Turn on'} ${newsletter.name}`}
                    className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-life/50 ${
                      newsletter.isSubscribed ? 'bg-life' : 'bg-ash'
                    } ${subscribing.has(newsletter.id) ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        newsletter.isSubscribed ? 'translate-x-[21px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Recommend Newsletter (primary CTA) */}
        <div className="p-4 border-t border-ash bg-slate/30">
          {!showRecommendForm ? (
            <button
              onClick={() => { setShowRecommendForm(true); setRecResult(null); }}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-life text-void font-semibold text-sm hover:bg-life/90 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Missing your favorite newsletter? Recommend it
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-pearl font-semibold">Suggest a newsletter for ByteLetters</p>
              <input
                type="text"
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="Newsletter name"
                className="w-full px-3 py-2.5 bg-obsidian border border-ash rounded-lg text-pearl text-sm placeholder-smoke/50 focus:border-life focus:outline-none"
              />
              <input
                type="url"
                value={recUrl}
                onChange={(e) => setRecUrl(e.target.value)}
                placeholder="Newsletter URL (e.g., https://...)"
                className="w-full px-3 py-2.5 bg-obsidian border border-ash rounded-lg text-pearl text-sm placeholder-smoke/50 focus:border-life focus:outline-none"
              />
              {/* Topic tags */}
              <div>
                <p className="text-xs text-smoke mb-2">
                  What's it about? <span className="opacity-60">(pick up to {MAX_TAGS})</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {RECOMMEND_TAGS.map((tag) => {
                    const selected = recTags.includes(tag);
                    const disabled = !selected && recTags.length >= MAX_TAGS;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        disabled={disabled}
                        className={`px-2.5 py-1 rounded-full text-xs capitalize transition-colors ${
                          selected
                            ? 'bg-life text-void font-medium'
                            : disabled
                              ? 'bg-obsidian border border-ash text-smoke/40 cursor-not-allowed'
                              : 'bg-obsidian border border-ash text-smoke hover:text-pearl hover:border-smoke'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              {recResult && (
                <p className={`text-xs ${recResult.type === 'success' ? 'text-life' : 'text-rose'}`}>
                  {recResult.message}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRecommendForm(false); setRecResult(null); }}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-ash/50 text-smoke hover:text-pearl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRecommendation}
                  disabled={recSubmitting || !recName.trim() || !recUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-life text-void text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{recSubmitting ? 'Sending...' : 'Submit'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sources;
