import { useEffect, useState, useCallback, useRef } from 'react';
import { Settings as SettingsIcon, Bookmark, BookmarkCheck, ChevronDown, ChevronRight, Library } from 'lucide-react';
// Use the new logo from public folder
const ByteLettersLogo = '/icons/icon128.png';
import type { UserProfile, ContentByte, VoteValue } from './types';
import {
  getUserProfile,
  saveUserProfile,
  calculateSundaysRemaining,
  calculatePercentLived,
} from './utils/storage';
import {
  initializeAuth,
  getChromeIdentity,
  authenticateWithGoogle,
  clearAuth,
  updateProfile,
  getStoredAuth,
  type AuthUser,
} from './services/auth';
import {
  fetchNextByte,
  fetchSavedBytes,
  voteByte,
  toggleSaveByte,
  trackByteView,
} from './services/api';
import { SAMPLE_BYTES, getNextByte as getNextMockByte } from './data/mockData';
import { MortalityBar } from './components/MortalityBar';
import { ByteCard } from './components/ByteCard';
import { Onboarding } from './components/Onboarding';
import { Settings } from './components/Settings';
import { Sources } from './components/Sources';

// Convert backend user to local profile format
function userToProfile(user: AuthUser): UserProfile {
  return {
    name: user.name,
    birthDate: user.birthDate || new Date().toISOString().split('T')[0],
    lifeExpectancy: user.lifeExpectancy || 80,
    inboxEmail: user.inboxEmail,
    enableRecommendations: user.enableRecommendations ?? true,
    createdAt: new Date().toISOString(),
  };
}


function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNext, setIsFetchingNext] = useState(false); // Instant loading state for Next button
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentByte, setCurrentByte] = useState<ContentByte | null>(null);
  const [savedBytes, setSavedBytes] = useState<ContentByte[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showingCommunityBytes] = useState(false);
  const [communityBytes] = useState<ContentByte[]>([]);
  const [communityByteIndex, setCommunityByteIndex] = useState(0);
  // Saved bytes panel state
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // Track content source info from API (unused in new curated model, kept for API compat)
  const [, setIsCommunityContent] = useState(true);
  const [, setHasUserSubscriptions] = useState(false);
  // Track if using mock data (offline fallback)
  const usingMockData = useRef(false);

  // Format category for display (capitalize first letter)
  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get category color class
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      wisdom: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      productivity: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      business: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      tech: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      life: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      creativity: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      leadership: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      finance: 'bg-green-500/20 text-green-300 border-green-500/30',
      health: 'bg-red-500/20 text-red-300 border-red-500/30',
      general: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    };
    return colors[category] || colors.general;
  };

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group bytes by category
  const groupedSavedBytes = savedBytes.reduce((acc, byte) => {
    const cat = byte.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(byte);
    return acc;
  }, {} as Record<string, ContentByte[]>);

  // Handle unsave byte (reusable function)
  const handleUnsaveByte = async (byte: ContentByte) => {
    // Optimistic update
    setSavedBytes(prev => prev.filter(b => b.id !== byte.id));
    if (currentByte?.id === byte.id) {
      setCurrentByte({
        ...currentByte,
        userEngagement: {
          ...currentByte.userEngagement,
          vote: currentByte.userEngagement?.vote || 0,
          isSaved: false,
        },
      });
    }

    // Call API to unsave (if online)
    if (!usingMockData.current) {
      try {
        await toggleSaveByte(byte.id);
      } catch (error) {
        console.error('Failed to unsave byte:', error);
        // Revert on failure
        setSavedBytes(prev => [byte, ...prev]);
        if (currentByte?.id === byte.id) {
          setCurrentByte({
            ...currentByte,
            userEngagement: {
              ...currentByte.userEngagement,
              vote: currentByte.userEngagement?.vote || 0,
              isSaved: true,
            },
          });
        }
      }
    }
  };

  // Helper to load byte and saved bytes from API
  async function loadFromApi(): Promise<{
    byte: ContentByte | null;
    queueSize: number;
    saved: ContentByte[];
    hasUserSubscriptions: boolean;
    isCommunityContent: boolean;
  }> {
    try {
      const [nextByteResult, savedResult] = await Promise.all([
        fetchNextByte(),
        fetchSavedBytes(),
      ]);
      usingMockData.current = false;
      return {
        byte: nextByteResult.byte,
        queueSize: nextByteResult.queueSize,
        saved: savedResult,
        hasUserSubscriptions: nextByteResult.hasUserSubscriptions,
        isCommunityContent: nextByteResult.isCommunityContent,
      };
    } catch (error) {
      console.log('API fetch failed, falling back to mock data:', error);
      usingMockData.current = true;
      return {
        byte: getNextMockByte(),
        queueSize: SAMPLE_BYTES.length,
        saved: [],
        hasUserSubscriptions: false,
        isCommunityContent: true,
      };
    }
  }

  // Load initial data with auto-login
  useEffect(() => {
    async function loadData() {
      try {
        // Try to restore authenticated session
        const authState = await initializeAuth();

        if (authState.isAuthenticated && authState.user) {
          // User is authenticated - convert to profile and use
          const userProfile = userToProfile(authState.user);
          await saveUserProfile(userProfile);
          setProfile(userProfile);

          // Load bytes and saved bytes from API
          const result = await loadFromApi();
          setCurrentByte(result.byte);
          setQueueSize(result.queueSize);
          setSavedBytes(result.saved);
          setHasUserSubscriptions(result.hasUserSubscriptions);
          setIsCommunityContent(result.isCommunityContent);
          return;
        }

        // Not authenticated - check if we have Chrome Identity
        const chromeIdentity = await getChromeIdentity();
        if (chromeIdentity) {
          // Try to silently authenticate to check if user exists
          try {
            const { user, isNewUser } = await authenticateWithGoogle(
              chromeIdentity.email,
              chromeIdentity.id
            );

            if (!isNewUser && user.birthDate) {
              // Existing user with completed onboarding - auto-login
              const userProfile = userToProfile(user);
              await saveUserProfile(userProfile);
              setProfile(userProfile);

              // Load bytes and saved bytes from API
              const result = await loadFromApi();
              setCurrentByte(result.byte);
              setQueueSize(result.queueSize);
              setSavedBytes(result.saved);
              setHasUserSubscriptions(result.hasUserSubscriptions);
              setIsCommunityContent(result.isCommunityContent);
              return;
            }
            // New user or incomplete onboarding - show onboarding
          } catch (err) {
            console.log('Silent auth failed, falling back to local:', err);
          }
        }

        // Fall back to local profile (legacy/offline mode)
        const savedProfile = await getUserProfile();
        setProfile(savedProfile);

        if (savedProfile) {
          // Use mock data for offline/demo mode
          usingMockData.current = true;
          const byte = getNextMockByte();
          setCurrentByte(byte);
          setQueueSize(SAMPLE_BYTES.length);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    await saveUserProfile(newProfile);
    setProfile(newProfile);

    // Try to load from API, fallback to mock
    const result = await loadFromApi();
    setCurrentByte(result.byte);
    setQueueSize(result.queueSize);
    setSavedBytes(result.saved);
    setHasUserSubscriptions(result.hasUserSubscriptions);
    setIsCommunityContent(result.isCommunityContent);
  };

  // Handle vote
  const handleVote = useCallback(async (byteId: string, vote: VoteValue) => {
    if (!currentByte || currentByte.id !== byteId) return;

    const prevVote = currentByte.userEngagement?.vote || 0;

    // Optimistic update
    setCurrentByte({
      ...currentByte,
      userEngagement: {
        vote,
        isSaved: currentByte.userEngagement?.isSaved || false,
      },
      engagement: {
        ...currentByte.engagement,
        upvotes: currentByte.engagement.upvotes + (vote === 1 ? 1 : 0) - (prevVote === 1 ? 1 : 0),
        downvotes: currentByte.engagement.downvotes + (vote === -1 ? 1 : 0) - (prevVote === -1 ? 1 : 0),
      },
    });

    // Send to API (if online)
    if (!usingMockData.current) {
      try {
        await voteByte(byteId, vote);
      } catch (error) {
        console.error('Failed to sync vote:', error);
        // Revert on failure
        setCurrentByte({
          ...currentByte,
          userEngagement: { vote: prevVote, isSaved: currentByte.userEngagement?.isSaved || false },
        });
      }
    }
  }, [currentByte]);

  // Handle save
  const handleSave = useCallback(async (byteId: string) => {
    if (!currentByte || currentByte.id !== byteId) return;

    const wasSaved = currentByte.userEngagement?.isSaved || false;
    const nowSaved = !wasSaved;

    // Optimistic update
    setCurrentByte({
      ...currentByte,
      userEngagement: {
        vote: currentByte.userEngagement?.vote || 0,
        isSaved: nowSaved,
      },
    });

    if (nowSaved) {
      setSavedBytes(prev => [{ ...currentByte, userEngagement: { vote: currentByte.userEngagement?.vote || 0, isSaved: true } }, ...prev.filter(b => b.id !== byteId)]);
    } else {
      setSavedBytes(prev => prev.filter(b => b.id !== byteId));
    }

    // Send to API (if online)
    if (!usingMockData.current) {
      try {
        const result = await toggleSaveByte(byteId);
        // Sync with actual server state
        if (result.isSaved !== nowSaved) {
          setCurrentByte(prev => prev ? { ...prev, userEngagement: { vote: prev.userEngagement?.vote || 0, isSaved: result.isSaved } } : null);
          if (result.isSaved) {
            setSavedBytes(prev => [currentByte, ...prev.filter(b => b.id !== byteId)]);
          } else {
            setSavedBytes(prev => prev.filter(b => b.id !== byteId));
          }
        }
      } catch (error) {
        console.error('Failed to sync save:', error);
        // Revert on failure
        setCurrentByte({
          ...currentByte,
          userEngagement: { vote: currentByte.userEngagement?.vote || 0, isSaved: wasSaved },
        });
        if (wasSaved) {
          setSavedBytes(prev => [currentByte, ...prev.filter(b => b.id !== byteId)]);
        } else {
          setSavedBytes(prev => prev.filter(b => b.id !== byteId));
        }
      }
    }
  }, [currentByte]);

  // Handle share
  const handleShare = useCallback((byteId: string) => {
    console.log('Share:', byteId);
    // TODO: Implement share tracking on backend
  }, []);

  // Handle view tracking with read status
  const handleView = useCallback(async (byteId: string, dwellTimeMs: number, isRead: boolean) => {
    // Only track views if using the API
    if (!usingMockData.current) {
      try {
        await trackByteView(byteId, dwellTimeMs, isRead);
      } catch (error) {
        console.error('Failed to track view:', error);
      }
    }
  }, []);

  // Handle next byte - instant UI response with background fetch
  const handleNext = useCallback(async () => {
    // Set loading state IMMEDIATELY for instant feedback
    setIsFetchingNext(true);

    // If showing community bytes, cycle through them
    if (showingCommunityBytes && communityBytes.length > 0) {
      const nextIndex = (communityByteIndex + 1) % communityBytes.length;
      setCommunityByteIndex(nextIndex);
      setCurrentByte(communityBytes[nextIndex]);
      setQueueSize(communityBytes.length - nextIndex - 1);
      setIsCommunityContent(true);
      setIsFetchingNext(false);
      return;
    }

    if (usingMockData.current) {
      // Offline/demo mode - use mock data (instant)
      const byte = getNextMockByte();
      setCurrentByte(byte);
      setQueueSize(prev => Math.max(0, prev - 1));
      setIsCommunityContent(true);
      setIsFetchingNext(false);
    } else {
      // Fetch from API in background
      try {
        const result = await fetchNextByte();
        if (result.byte) {
          setCurrentByte(result.byte);
          setQueueSize(result.queueSize);
          setIsCommunityContent(result.isCommunityContent);
          setHasUserSubscriptions(result.hasUserSubscriptions);
        } else {
          // No more bytes from API, fall back to mock
          usingMockData.current = true;
          const mockByte = getNextMockByte();
          setCurrentByte(mockByte);
          setQueueSize(SAMPLE_BYTES.length);
          setIsCommunityContent(true);
        }
      } catch (error) {
        console.error('Failed to fetch next byte:', error);
        // Fall back to mock on error
        usingMockData.current = true;
        const byte = getNextMockByte();
        setCurrentByte(byte);
        setQueueSize(SAMPLE_BYTES.length);
        setIsCommunityContent(true);
      } finally {
        setIsFetchingNext(false);
      }
    }
  }, [showingCommunityBytes, communityBytes, communityByteIndex]);

  // Update profile
  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    // Save locally first
    await saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    // Sync with backend API
    if (!usingMockData.current) {
      try {
        const auth = await getStoredAuth();
        if (auth?.token) {
          await updateProfile(auth.token, {
            name: updatedProfile.name,
            birthDate: updatedProfile.birthDate,
            lifeExpectancy: updatedProfile.lifeExpectancy,
            enableRecommendations: updatedProfile.enableRecommendations,
          });

          // Reload feed after enableRecommendations change
          const result = await loadFromApi();
          setCurrentByte(result.byte);
          setQueueSize(result.queueSize);
          setHasUserSubscriptions(result.hasUserSubscriptions);
          setIsCommunityContent(result.isCommunityContent);
        }
      } catch (error) {
        console.error('Failed to sync profile to backend:', error);
      }
    }
  };

  // Reset all data
  const handleReset = async () => {
    // Clear auth state
    await clearAuth();

    const keys = [
      'focustab_user_profile',
      'focustab_newsletters',
      'focustab_inspirations',
      'focustab_shown_inspirations',
      'focustab_bytes',
      'byteletters_saved_bytes',
      'byteletters_byte_votes',
      'byteletters_shown_bytes',
      'byteletters_last_byte',
    ];
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromeRef = (window as any).chrome;
      if (chromeRef?.storage?.local?.clear) {
        await chromeRef.storage.local.clear();
      }
    } catch {
      // Ignore if chrome is not available
    }

    // Reset state
    usingMockData.current = false;
    setProfile(null);
    setCurrentByte(null);
    setSavedBytes([]);
    setQueueSize(0);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="w-8 h-8 border-2 border-life border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Onboarding
  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Calculate life stats
  const sundaysRemaining = calculateSundaysRemaining(profile.birthDate, profile.lifeExpectancy);
  const percentLived = calculatePercentLived(profile.birthDate, profile.lifeExpectancy);

  return (
    <div className="min-h-screen bg-void relative overflow-hidden">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-void via-void to-obsidian pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-life/5 to-transparent pointer-events-none" />

      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center px-6 py-4 z-50">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <img src={ByteLettersLogo} alt="ByteLetters" className="w-8 h-8" />
          <span className="font-display text-lg text-pearl/80 hidden sm:block">ByteLetters</span>
        </div>

        {/* Right side buttons */}
        <div className="flex gap-2">
          {/* Saved bytes button */}
          <button
            onClick={() => setShowSaved(true)}
            className="p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors relative"
            title="Saved bytes"
          >
            <Bookmark className="w-5 h-5 text-smoke" />
            {savedBytes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-life text-void text-xs font-medium rounded-full flex items-center justify-center">
                {savedBytes.length}
              </span>
            )}
          </button>

          {/* Sources button */}
          <button
            onClick={() => setShowSources(true)}
            className="p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors"
            title="Newsletter Sources"
          >
            <Library className="w-5 h-5 text-smoke" />
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5 text-smoke" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Mortality Bar - Connects to Content */}
          <MortalityBar
            name={profile.name}
            sundaysRemaining={sundaysRemaining}
            percentLived={percentLived}
          />

          {/* Content Byte */}
          {currentByte ? (
            <ByteCard
              byte={currentByte}
              onVote={handleVote}
              onSave={handleSave}
              onShare={handleShare}
              onNext={handleNext}
              onView={handleView}
              queueSize={queueSize}
              isLoadingNext={isFetchingNext}
            />
          ) : (
            <div className="text-center py-16 bg-obsidian/80 backdrop-blur-sm rounded-2xl p-8 border border-ash/30">
              <Library className="w-12 h-12 text-life/50 mx-auto mb-4" />
              <p className="text-pearl text-lg mb-2">All caught up!</p>
              <p className="text-smoke/60 text-sm mb-6">
                Subscribe to more newsletters in Sources to see more insights.
              </p>

              <button
                onClick={() => setShowSources(true)}
                className="px-6 py-3 bg-life hover:bg-life/90 text-void rounded-lg transition-colors font-medium flex items-center gap-2 mx-auto"
              >
                <Library className="w-5 h-5" />
                Browse Sources
              </button>
            </div>
          )}
        </div>

      </main>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdate={handleUpdateProfile}
          onReset={handleReset}
        />
      )}

      {/* Sources Modal */}
      {showSources && (
        <Sources onClose={() => setShowSources(false)} />
      )}

      {/* Saved Bytes Slide Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-obsidian border-l border-ash shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          showSaved ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ash">
          <div className="flex items-center gap-3">
            <Bookmark className="w-5 h-5 text-life" />
            <h2 className="font-display text-xl text-pearl">Saved Bytes</h2>
            <span className="text-sm text-smoke">({savedBytes.length})</span>
          </div>
          <button
            onClick={() => setShowSaved(false)}
            className="p-2 rounded-lg hover:bg-ash transition-colors text-smoke"
          >
            ✕
          </button>
        </div>

        {/* Group by Category Toggle */}
        {savedBytes.length > 0 && (
          <div className="px-6 py-3 border-b border-ash/50">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-smoke group-hover:text-pearl transition-colors">
                Group by Category
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate rounded-full peer peer-checked:bg-life/30 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-smoke rounded-full peer-checked:translate-x-5 peer-checked:bg-life transition-all"></div>
              </div>
            </label>
          </div>
        )}

        {/* Content */}
        <div className={`overflow-y-auto p-4 ${savedBytes.length > 0 ? 'h-[calc(100%-128px)]' : 'h-[calc(100%-80px)]'}`}>
          {savedBytes.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-ash mx-auto mb-4" />
              <p className="text-smoke">No saved bytes yet</p>
              <p className="text-smoke/50 text-sm mt-1">
                Tap the bookmark icon on any byte to save it here
              </p>
            </div>
          ) : groupByCategory ? (
            /* Grouped View */
            <div className="space-y-4">
              {Object.entries(groupedSavedBytes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, bytes]) => (
                  <div key={category} className="border border-ash/50 rounded-xl overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-4 bg-slate/50 hover:bg-slate/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collapsedCategories.has(category) ? (
                          <ChevronRight className="w-4 h-4 text-smoke" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-smoke" />
                        )}
                        <span className={`px-2 py-1 text-xs rounded-md border ${getCategoryColor(category)}`}>
                          {formatCategory(category)}
                        </span>
                        <span className="text-sm text-smoke">
                          {bytes.length} byte{bytes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>

                    {/* Category Bytes */}
                    {!collapsedCategories.has(category) && (
                      <div className="p-3 space-y-3 bg-void/30">
                        {bytes.map((byte) => (
                          <div
                            key={byte.id}
                            className="p-4 bg-slate border border-ash rounded-xl hover:border-ash/80 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <span className="text-xs text-smoke/60 capitalize">{byte.type}</span>
                              <span className="text-xs text-life">{byte.source.name}</span>
                            </div>
                            <p className="text-pearl text-sm leading-relaxed mb-2">
                              "{byte.content}"
                            </p>
                            {byte.author && (
                              <p className="text-smoke/60 text-xs mb-3">— {byte.author}</p>
                            )}
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleUnsaveByte(byte)}
                                className="p-2 rounded-lg hover:bg-ash/50 transition-colors group"
                                title="Remove from saved"
                              >
                                <BookmarkCheck className="w-4 h-4 text-life group-hover:text-smoke transition-colors" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            /* Flat List View */
            <div className="space-y-3">
              {savedBytes.map((byte) => (
                <div
                  key={byte.id}
                  className="p-4 bg-slate border border-ash rounded-xl hover:border-ash/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-smoke/60 capitalize">{byte.type}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-md border ${getCategoryColor(byte.category)}`}>
                        {formatCategory(byte.category)}
                      </span>
                    </div>
                    <span className="text-xs text-life">{byte.source.name}</span>
                  </div>
                  <p className="text-pearl text-sm leading-relaxed mb-2">
                    "{byte.content}"
                  </p>
                  {byte.author && (
                    <p className="text-smoke/60 text-xs mb-3">— {byte.author}</p>
                  )}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleUnsaveByte(byte)}
                      className="p-2 rounded-lg hover:bg-ash/50 transition-colors group"
                      title="Remove from saved"
                    >
                      <BookmarkCheck className="w-4 h-4 text-life group-hover:text-smoke transition-colors" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for slide panel */}
      {showSaved && (
        <div
          className="fixed inset-0 bg-void/60 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setShowSaved(false)}
        />
      )}
    </div>
  );
}

export default App;
