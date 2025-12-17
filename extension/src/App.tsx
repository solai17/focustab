import { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { UserProfile, ContentByte, VoteValue } from './types';
import {
  getUserProfile,
  saveUserProfile,
  calculateSundaysRemaining,
  calculatePercentLived,
} from './utils/storage';
import { SAMPLE_BYTES, getNextByte } from './data/mockData';
import { MortalityBar } from './components/MortalityBar';
import { ByteCard } from './components/ByteCard';
import { Onboarding } from './components/Onboarding';
import { Settings } from './components/Settings';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentByte, setCurrentByte] = useState<ContentByte | null>(null);
  const [queueSize, setQueueSize] = useState(SAMPLE_BYTES.length);
  const [showSettings, setShowSettings] = useState(false);
  // Track seen bytes for deduplication (used when fetching from API)
  const [, setSeenByteIds] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const savedProfile = await getUserProfile();
        setProfile(savedProfile);

        if (savedProfile) {
          // Get first byte
          const byte = getNextByte();
          setCurrentByte(byte);
          setSeenByteIds(new Set([byte.id]));
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

    // Get first byte
    const byte = getNextByte();
    setCurrentByte(byte);
    setSeenByteIds(new Set([byte.id]));
  };

  // Handle vote
  const handleVote = useCallback((byteId: string, vote: VoteValue) => {
    console.log('Vote:', byteId, vote);
    // In demo mode, just update local state
    // In production, this would call the API
    if (currentByte && currentByte.id === byteId) {
      setCurrentByte({
        ...currentByte,
        userEngagement: {
          vote,
          isSaved: currentByte.userEngagement?.isSaved || false,
        },
        engagement: {
          ...currentByte.engagement,
          upvotes: currentByte.engagement.upvotes + (vote === 1 ? 1 : 0),
          downvotes: currentByte.engagement.downvotes + (vote === -1 ? 1 : 0),
        },
      });
    }
  }, [currentByte]);

  // Handle save
  const handleSave = useCallback((byteId: string) => {
    console.log('Save:', byteId);
    if (currentByte && currentByte.id === byteId) {
      setCurrentByte({
        ...currentByte,
        userEngagement: {
          vote: currentByte.userEngagement?.vote || 0,
          isSaved: !currentByte.userEngagement?.isSaved,
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
  const handleNext = useCallback(() => {
    const byte = getNextByte();
    setCurrentByte(byte);
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
    const keys = [
      'focustab_user_profile',
      'focustab_newsletters',
      'focustab_inspirations',
      'focustab_shown_inspirations',
      'focustab_bytes',
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

      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed top-6 right-6 p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors z-50"
        title="Settings"
      >
        <SettingsIcon className="w-5 h-5 text-smoke" />
      </button>

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Mortality Bar - Connects to Content */}
          <MortalityBar
            name={profile.name}
            sundaysRemaining={sundaysRemaining}
            percentLived={percentLived}
          />

          {/* Content Byte - "Reels for Text" */}
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
            <div className="text-center py-12">
              <p className="text-smoke">No content available yet.</p>
              <p className="text-smoke/60 text-sm mt-2">
                Forward newsletters to your inbox to get started.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center opacity-0 animate-fade-in animation-delay-500">
          {profile.inboxEmail && (
            <p className="text-xs text-smoke/40">
              Forward newsletters to{' '}
              <code className="text-life/60">{profile.inboxEmail}</code>
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
    </div>
  );
}

export default App;
