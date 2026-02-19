import { useState, useEffect } from 'react';
import { ArrowRight, Calendar, Library, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../types';
import { getChromeIdentity, authenticateWithGoogle, isExtensionWithIdentity } from '../services/auth';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Chrome Identity state
  const [chromeIdentity, setChromeIdentity] = useState<{ email: string; id: string } | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Chrome Identity on mount
  useEffect(() => {
    async function fetchChromeIdentity() {
      if (isExtensionWithIdentity()) {
        const identity = await getChromeIdentity();
        if (identity) {
          setChromeIdentity(identity);
        }
      }
    }
    fetchChromeIdentity();
  }, []);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setStep(2);
    }
  };

  const handleDateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate) return;

    setError(null);
    setIsCreatingAccount(true);

    try {
      if (chromeIdentity) {
        // Create account with Google identity
        // Backend auto-subscribes to all curated newsletters
        await authenticateWithGoogle(
          chromeIdentity.email,
          chromeIdentity.id,
          {
            name: name.trim(),
            birthDate,
            lifeExpectancy: 80,
            enableRecommendations: true,
          }
        );
      }
      setStep(3);
    } catch (err) {
      console.error('Account creation error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleComplete = () => {
    const profile: UserProfile = {
      name: name.trim(),
      birthDate,
      lifeExpectancy: 80,
      enableRecommendations: true,
      createdAt: new Date().toISOString(),
    };
    onComplete(profile);
  };

  const firstName = name.split(' ')[0];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-void">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="font-display text-4xl text-pearl mb-3">ByteLetters</h1>
          <p className="text-smoke text-lg">Wisdom, one byte at a time.</p>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <form onSubmit={handleNameSubmit} className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl text-pearl font-medium mb-2">Let's get started</h2>
              <p className="text-smoke">What should we call you?</p>
            </div>
            <div className="mb-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full px-4 py-4 bg-slate border border-ash rounded-xl text-pearl text-center text-lg placeholder:text-smoke/50 focus:outline-none focus:border-life/50 focus:ring-1 focus:ring-life/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3.5 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Birth Date */}
        {step === 2 && (
          <form onSubmit={handleDateSubmit} className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl text-pearl font-medium mb-2">
                Hi, {firstName}
              </h2>
              <p className="text-smoke">
                When were you born? This helps us remind you<br />
                to make every moment count.
              </p>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 text-smoke/60 text-sm mb-3">
                <Calendar className="w-4 h-4" />
                Birth date
              </div>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-4 bg-slate border border-ash rounded-xl text-pearl text-center focus:outline-none focus:border-life/50 focus:ring-1 focus:ring-life/20 transition-all"
              />
              <p className="text-xs text-smoke/50 mt-3 text-center">
                We'll calculate your remaining Sundays. You can adjust this anytime.
              </p>
            </div>

            {/* Chrome Identity indicator */}
            {chromeIdentity && (
              <div className="mb-6 p-3 bg-life/10 border border-life/20 rounded-lg text-center">
                <p className="text-xs text-life">
                  Syncing as {chromeIdentity.email}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!birthDate || isCreatingAccount}
              className="w-full py-3.5 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isCreatingAccount ? (
                <>
                  <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 3: Welcome - Ready to go */}
        {step === 3 && (
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl text-pearl font-medium mb-2">
                You're all set, {firstName}!
              </h2>
              <p className="text-smoke">
                We've subscribed you to our curated newsletters.
              </p>
            </div>

            <div className="p-5 bg-slate border border-ash rounded-xl mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Library className="w-5 h-5 text-life" />
                <div>
                  <h3 className="text-pearl font-medium">Curated wisdom awaits</h3>
                  <p className="text-sm text-smoke">
                    Insights from the world's best newsletters
                  </p>
                </div>
              </div>
              <p className="text-sm text-smoke/70">
                Every new tab shows a bite-sized insight from newsletters like
                Naval Ravikant, James Clear, Tim Ferriss, and more.
              </p>
            </div>

            <div className="text-center mb-8">
              <p className="text-sm text-smoke">
                Use the <span className="text-life">Sources</span> button to customize<br />
                which newsletters you see.
              </p>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3.5 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 transition-all"
            >
              Start exploring
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Progress - now 3 steps */}
        <div className="flex justify-center gap-2 mt-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? 'bg-life w-8' : s < step ? 'bg-life/40 w-1.5' : 'bg-ash w-1.5'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
