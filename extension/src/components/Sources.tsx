import { useState, useEffect } from 'react';
import { X, Check, Loader2, Library, ExternalLink } from 'lucide-react';

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
  onClose: () => void;
}

export function Sources({ onClose }: SourcesProps) {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNewsletters();
  }, []);

  const loadNewsletters = async () => {
    try {
      const { getStoredAuth } = await import('../services/auth');
      const auth = await getStoredAuth();
      if (!auth?.token) return;

      const API_URL = import.meta.env.VITE_API_URL || 'https://api.byteletters.app';
      const response = await fetch(`${API_URL}/newsletters`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNewsletters(data.newsletters);
        setCategories([{ name: 'all', count: data.newsletters.length }, ...data.categories]);
      }
    } catch (error) {
      console.error('Failed to load newsletters:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (newsletter: Newsletter) => {
    if (subscribing.has(newsletter.id)) return;

    setSubscribing((prev) => new Set(prev).add(newsletter.id));

    try {
      const { getStoredAuth } = await import('../services/auth');
      const auth = await getStoredAuth();
      if (!auth?.token) return;

      const API_URL = import.meta.env.VITE_API_URL || 'https://api.byteletters.app';
      const endpoint = newsletter.isSubscribed ? 'unsubscribe' : 'subscribe';

      const response = await fetch(`${API_URL}/newsletters/${newsletter.id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      if (response.ok) {
        setNewsletters((prev) =>
          prev.map((n) =>
            n.id === newsletter.id
              ? { ...n, isSubscribed: !n.isSubscribed }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
    } finally {
      setSubscribing((prev) => {
        const next = new Set(prev);
        next.delete(newsletter.id);
        return next;
      });
    }
  };

  const filteredNewsletters =
    selectedCategory === 'all'
      ? newsletters
      : newsletters.filter((n) => n.category === selectedCategory);

  const subscribedCount = newsletters.filter((n) => n.isSubscribed).length;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      wisdom: 'bg-purple-500/20 text-purple-300',
      productivity: 'bg-blue-500/20 text-blue-300',
      business: 'bg-emerald-500/20 text-emerald-300',
      tech: 'bg-cyan-500/20 text-cyan-300',
      life: 'bg-rose-500/20 text-rose-300',
      creativity: 'bg-amber-500/20 text-amber-300',
      general: 'bg-slate-500/20 text-slate-300',
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-obsidian border border-ash rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ash">
          <div className="flex items-center gap-3">
            <Library className="w-6 h-6 text-life" />
            <div>
              <h2 className="text-xl font-semibold text-pearl">Newsletter Sources</h2>
              <p className="text-sm text-smoke">
                {subscribedCount} of {newsletters.length} subscribed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ash/50 text-smoke hover:text-pearl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 p-4 border-b border-ash overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-life text-void font-medium'
                  : 'bg-slate hover:bg-ash text-smoke hover:text-pearl'
              }`}
            >
              {cat.name === 'all' ? 'All' : cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
              <span className="ml-1.5 opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Newsletter List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-life animate-spin" />
            </div>
          ) : filteredNewsletters.length === 0 ? (
            <div className="text-center py-12 text-smoke">
              <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No newsletters found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNewsletters.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    newsletter.isSubscribed
                      ? 'bg-life/5 border-life/30'
                      : 'bg-slate/30 border-ash hover:border-smoke'
                  }`}
                >
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-lg bg-ash flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {newsletter.logoUrl ? (
                      <img
                        src={newsletter.logoUrl}
                        alt={newsletter.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-smoke">
                        {newsletter.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-pearl truncate">
                        {newsletter.name}
                      </h3>
                      {newsletter.isVerified && (
                        <span className="text-life text-xs">Verified</span>
                      )}
                    </div>
                    {newsletter.description && (
                      <p className="text-sm text-smoke truncate mt-0.5">
                        {newsletter.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(newsletter.category)}`}>
                        {newsletter.category}
                      </span>
                      <span className="text-xs text-smoke">
                        {newsletter.totalInsights} insights
                      </span>
                      {newsletter.website && (
                        <a
                          href={newsletter.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-smoke hover:text-life flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => toggleSubscription(newsletter)}
                    disabled={subscribing.has(newsletter.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      newsletter.isSubscribed
                        ? 'bg-life/20 text-life hover:bg-rose/20 hover:text-rose'
                        : 'bg-life text-void hover:bg-life/90'
                    }`}
                  >
                    {subscribing.has(newsletter.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : newsletter.isSubscribed ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <span>Subscribe</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ash bg-slate/30">
          <p className="text-xs text-smoke text-center">
            You'll only see insights from newsletters you're subscribed to.
            Toggle off sources you're not interested in.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Sources;
