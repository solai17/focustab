import { useEffect, useState, useCallback, useRef } from 'react';
import { Settings as SettingsIcon, Bookmark } from 'lucide-react';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentByte, setCurrentByte] = useState<ContentByte | null>(null);
  const [savedBytes, setSavedBytes] = useState<ContentByte[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  // Track if using mock data (offline fallback)
  const usingMockData = useRef(false);

  // Helper to load byte and saved bytes from API
  async function loadFromApi(): Promise<{ byte: ContentByte | null; queueSize: number; saved: ContentByte[] }> {
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
      };
    } catch (error) {
      console.log('API fetch failed, falling back to mock data:', error);
      usingMockData.current = true;
      return {
        byte: getNextMockByte(),
        queueSize: SAMPLE_BYTES.length,
        saved: [],
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
          const { byte, queueSize: size, saved } = await loadFromApi();
          setCurrentByte(byte);
          setQueueSize(size);
          setSavedBytes(saved);
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
              const { byte, queueSize: size, saved } = await loadFromApi();
              setCurrentByte(byte);
              setQueueSize(size);
              setSavedBytes(saved);
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
    const { byte, queueSize: size, saved } = await loadFromApi();
    setCurrentByte(byte);
    setQueueSize(size);
    setSavedBytes(saved);
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

  // Handle view tracking
  const handleView = useCallback(async (byteId: string, dwellTimeMs: number) => {
    // Only track views if using the API
    if (!usingMockData.current) {
      try {
        await trackByteView(byteId, dwellTimeMs);
      } catch (error) {
        console.error('Failed to track view:', error);
      }
    }
  }, []);

  // Handle next byte
  const handleNext = useCallback(async () => {
    if (usingMockData.current) {
      // Offline/demo mode - use mock data
      const byte = getNextMockByte();
      setCurrentByte(byte);
      setQueueSize(prev => Math.max(0, prev - 1));
    } else {
      // Fetch from API
      try {
        const { byte, queueSize: size } = await fetchNextByte();
        if (byte) {
          setCurrentByte(byte);
          setQueueSize(size);
        } else {
          // No more bytes from API, fall back to mock
          usingMockData.current = true;
          const mockByte = getNextMockByte();
          setCurrentByte(mockByte);
          setQueueSize(SAMPLE_BYTES.length);
        }
      } catch (error) {
        console.error('Failed to fetch next byte:', error);
        // Fall back to mock on error
        usingMockData.current = true;
        const byte = getNextMockByte();
        setCurrentByte(byte);
        setQueueSize(SAMPLE_BYTES.length);
      }
    }
  }, []);

  // Update profile
  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    await saveUserProfile(updatedProfile);
    setProfile(updatedProfile);
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

      {/* Top buttons */}
      <div className="fixed top-6 right-6 flex gap-2 z-50">
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

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-5 h-5 text-smoke" />
        </button>
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
            />
          ) : (
            <div className="text-center py-16">
              <p className="text-pearl text-lg mb-2">Your feed is empty</p>
              <p className="text-smoke/60 text-sm">
                Forward newsletters to start receiving bytes.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center opacity-0 animate-fade-in animation-delay-500">
          {profile.inboxEmail && (
            <p className="text-xs text-smoke/40">
              <code className="text-life/50">{profile.inboxEmail}</code>
            </p>
          )}
        </footer>
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

      {/* Saved Bytes Modal */}
      {showSaved && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-obsidian border border-ash rounded-2xl shadow-2xl animate-slide-up max-h-[80vh] overflow-hidden flex flex-col">
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {savedBytes.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="w-12 h-12 text-ash mx-auto mb-4" />
                  <p className="text-smoke">No saved bytes yet</p>
                  <p className="text-smoke/50 text-sm mt-1">
                    Tap the bookmark icon on any byte to save it here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedBytes.map((byte) => (
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
                        <p className="text-smoke/60 text-xs">— {byte.author}</p>
                      )}
                      <button
                        onClick={async () => {
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
                        }}
                        className="mt-3 text-xs text-smoke/50 hover:text-rose transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
