import { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { UserProfile, Newsletter, Inspiration } from './types';
import { 
  getUserProfile, 
  saveUserProfile, 
  getNewsletters, 
  saveNewsletters,
  getInspirations,
  saveInspirations,
  getRandomInspiration,
  markNewsletterRead,
  calculateSundaysRemaining,
  calculatePercentLived,
} from './utils/storage';
import { SAMPLE_INSPIRATIONS, SAMPLE_NEWSLETTERS } from './data/mockData';
import { MortalityBar } from './components/MortalityBar';
import { InspirationCard } from './components/InspirationCard';
import { ReadingList } from './components/ReadingList';
import { Onboarding } from './components/Onboarding';
import { Settings } from './components/Settings';
import { NewsletterReader } from './components/NewsletterReader';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentInspiration, setCurrentInspiration] = useState<Inspiration | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [readingNewsletter, setReadingNewsletter] = useState<Newsletter | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const savedProfile = await getUserProfile();
        setProfile(savedProfile);

        if (savedProfile) {
          // Load newsletters
          let savedNewsletters = await getNewsletters();
          if (savedNewsletters.length === 0) {
            // Initialize with sample data for demo
            await saveNewsletters(SAMPLE_NEWSLETTERS);
            savedNewsletters = SAMPLE_NEWSLETTERS;
          }
          setNewsletters(savedNewsletters);

          // Load inspirations
          let savedInspirations = await getInspirations();
          if (savedInspirations.length === 0) {
            await saveInspirations(SAMPLE_INSPIRATIONS);
            savedInspirations = SAMPLE_INSPIRATIONS;
          }

          // Get random inspiration
          const inspiration = await getRandomInspiration();
          setCurrentInspiration(inspiration);
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
    await saveNewsletters(SAMPLE_NEWSLETTERS);
    await saveInspirations(SAMPLE_INSPIRATIONS);
    
    setProfile(newProfile);
    setNewsletters(SAMPLE_NEWSLETTERS);
    
    const inspiration = await getRandomInspiration();
    setCurrentInspiration(inspiration);
  };

  // Refresh inspiration
  const handleRefreshInspiration = useCallback(async () => {
    const inspiration = await getRandomInspiration();
    setCurrentInspiration(inspiration);
  }, []);

  // Handle newsletter read
  const handleReadNewsletter = useCallback((newsletter: Newsletter) => {
    setReadingNewsletter(newsletter);
  }, []);

  // Mark newsletter as read
  const handleMarkRead = useCallback(async () => {
    if (readingNewsletter) {
      await markNewsletterRead(readingNewsletter.id);
      setNewsletters(prev => 
        prev.map(n => n.id === readingNewsletter.id ? { ...n, isRead: true } : n)
      );
    }
  }, [readingNewsletter]);

  // Update profile
  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    await saveUserProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  // Reset all data
  const handleReset = async () => {
    // Clear all storage using our storage abstraction
    const keys = [
      'focustab_user_profile',
      'focustab_newsletters', 
      'focustab_inspirations',
      'focustab_shown_inspirations'
    ];
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    // Also try chrome storage if available
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
    setNewsletters([]);
    setCurrentInspiration(null);
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
        className="fixed top-6 right-6 p-3 rounded-xl bg-slate/50 border border-ash/50 hover:bg-ash transition-colors z-10"
        title="Settings"
      >
        <SettingsIcon className="w-5 h-5 text-smoke" />
      </button>

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl space-y-12">
          {/* Mortality Bar */}
          <MortalityBar
            name={profile.name}
            sundaysRemaining={sundaysRemaining}
            percentLived={percentLived}
          />

          {/* Divider */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-ash to-transparent mx-auto opacity-0 animate-fade-in stagger-1" />

          {/* Inspiration */}
          {currentInspiration && (
            <InspirationCard
              inspiration={currentInspiration}
              onRefresh={handleRefreshInspiration}
            />
          )}

          {/* Divider */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-ash to-transparent mx-auto opacity-0 animate-fade-in stagger-2" />

          {/* Reading List */}
          <ReadingList
            newsletters={newsletters}
            onRead={handleReadNewsletter}
          />
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center opacity-0 animate-fade-in stagger-5">
          <p className="text-xs text-smoke/40">
            {profile.inboxEmail && (
              <>
                Forward newsletters to{' '}
                <code className="text-life/60">{profile.inboxEmail}</code>
              </>
            )}
          </p>
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

      {/* Newsletter Reader Modal */}
      {readingNewsletter && (
        <NewsletterReader
          newsletter={readingNewsletter}
          onClose={() => setReadingNewsletter(null)}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}

export default App;
