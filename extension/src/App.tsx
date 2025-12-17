import { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon, Bookmark } from 'lucide-react';
import type { UserProfile, ContentByte, VoteValue } from './types';
import {
  getUserProfile,
  saveUserProfile,
  calculateSundaysRemaining,
  calculatePercentLived,
  saveByteToCollection,
  removeByteFromCollection,
  isByteSaved,
  setByteVote,
  getByteVote,
  getSavedBytes,
} from './utils/storage';
import {
  initializeAuth,
  getChromeIdentity,
  authenticateWithGoogle,
  clearAuth,
  type AuthUser,
} from './services/auth';
import { SAMPLE_BYTES, getNextByte } from './data/mockData';
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

// Load engagement state for a byte
async function loadByteWithEngagement(byte: ContentByte): Promise<ContentByte> {
  const [saved, vote] = await Promise.all([
    isByteSaved(byte.id),
    getByteVote(byte.id),
  ]);

  return {
    ...byte,
    userEngagement: {
      vote: vote as -1 | 0 | 1,
      isSaved: saved,
    },
  };
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentByte, setCurrentByte] = useState<ContentByte | null>(null);
  const [savedBytes, setSavedBytes] = useState<ContentByte[]>([]);
  const [queueSize, setQueueSize] = useState(SAMPLE_BYTES.length);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  // Track seen bytes for deduplication (used when fetching from API)
  const [, setSeenByteIds] = useState<Set<string>>(new Set());

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

          // Get first byte with engagement state
          const byte = getNextByte();
          const byteWithEngagement = await loadByteWithEngagement(byte);
          setCurrentByte(byteWithEngagement);
          setSeenByteIds(new Set([byte.id]));

          // Load saved bytes
          const saved = await getSavedBytes();
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

              // Get first byte with engagement state
              const byte = getNextByte();
              const byteWithEngagement = await loadByteWithEngagement(byte);
              setCurrentByte(byteWithEngagement);
              setSeenByteIds(new Set([byte.id]));

              // Load saved bytes
              const saved = await getSavedBytes();
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
          // Get first byte with engagement state
          const byte = getNextByte();
          const byteWithEngagement = await loadByteWithEngagement(byte);
          setCurrentByte(byteWithEngagement);
          setSeenByteIds(new Set([byte.id]));

          // Load saved bytes
          const saved = await getSavedBytes();
          setSavedBytes(saved);
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

    // Get first byte with engagement state
    const byte = getNextByte();
    const byteWithEngagement = await loadByteWithEngagement(byte);
    setCurrentByte(byteWithEngagement);
    setSeenByteIds(new Set([byte.id]));
  };

  // Handle vote
  const handleVote = useCallback(async (byteId: string, vote: VoteValue) => {
    // Persist vote to storage
    await setByteVote(byteId, vote as -1 | 0 | 1);

    if (currentByte && currentByte.id === byteId) {
      const prevVote = currentByte.userEngagement?.vote || 0;
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
    }
  }, [currentByte]);

  // Handle save
  const handleSave = useCallback(async (byteId: string) => {
    if (currentByte && currentByte.id === byteId) {
      const wasSaved = currentByte.userEngagement?.isSaved || false;
      const nowSaved = !wasSaved;

      // Persist to storage
      if (nowSaved) {
        await saveByteToCollection(currentByte);
        setSavedBytes(prev => [currentByte, ...prev.filter(b => b.id !== byteId)]);
      } else {
        await removeByteFromCollection(byteId);
        setSavedBytes(prev => prev.filter(b => b.id !== byteId));
      }

      setCurrentByte({
        ...currentByte,
        userEngagement: {
          vote: currentByte.userEngagement?.vote || 0,
          isSaved: nowSaved,
        },
      });
    }
  }, [currentByte]);

  // Handle share
  const handleShare = useCallback((byteId: string) => {
    console.log('Share:', byteId);
    // In production, this would track the share
  }, []);

  // Handle view tracking
  const handleView = useCallback((byteId: string, dwellTimeMs: number) => {
    console.log('View:', byteId, 'Dwell time:', dwellTimeMs, 'ms');
    // In production, this would call the API
  }, []);

  // Handle next byte
  const handleNext = useCallback(async () => {
    const byte = getNextByte();
    const byteWithEngagement = await loadByteWithEngagement(byte);
    setCurrentByte(byteWithEngagement);
    setSeenByteIds(prev => new Set([...prev, byte.id]));
    setQueueSize(prev => Math.max(0, prev - 1));
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
    setProfile(null);
    setCurrentByte(null);
    setSavedBytes([]);
    setSeenByteIds(new Set());
    setQueueSize(SAMPLE_BYTES.length);
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
                          await removeByteFromCollection(byte.id);
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
