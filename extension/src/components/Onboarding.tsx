import { useState, useEffect } from 'react';
import { ArrowRight, Calendar, Mail, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../types';
import { getChromeIdentity, authenticateWithGoogle, isExtensionWithIdentity } from '../services/auth';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inboxEmail, setInboxEmail] = useState('');
  const [enableRecommendations, setEnableRecommendations] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (birthDate) {
      setStep(3);
    }
  };

  const handleRecommendationsSubmit = async () => {
    setError(null);
    setIsCreatingAccount(true);

    try {
      if (chromeIdentity) {
        const { user } = await authenticateWithGoogle(
          chromeIdentity.email,
          chromeIdentity.id,
          {
            name: name.trim(),
            birthDate,
            lifeExpectancy: 80,
            enableRecommendations,
          }
        );
        setInboxEmail(user.inboxEmail);
      } else {
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
        const random = Math.random().toString(36).substring(2, 8);
        setInboxEmail(`${slug}-${random}@inbox.byteletters.app`);
      }
      setStep(4);
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
      inboxEmail,
      enableRecommendations,
      createdAt: new Date().toISOString(),
    };
    onComplete(profile);
  };

  const copyEmail = async () => {
    await navigator.clipboard.writeText(inboxEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <button
              type="submit"
              disabled={!birthDate}
              className="w-full py-3.5 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 3: Discovery */}
        {step === 3 && (
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl text-pearl font-medium mb-2">
                Expand your horizons?
              </h2>
              <p className="text-smoke">
                Discover wisdom beyond your own newsletters.
              </p>
            </div>

            <div className="p-5 bg-slate border border-ash rounded-xl mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-life" />
                  <div>
                    <h3 className="text-pearl font-medium">Community picks</h3>
                    <p className="text-sm text-smoke">
                      See what resonates with others
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnableRecommendations(!enableRecommendations)}
                  disabled={isCreatingAccount}
                  className={`w-12 h-7 rounded-full transition-all flex items-center px-1 flex-shrink-0 ${
                    enableRecommendations ? 'bg-life' : 'bg-ash'
                  } ${isCreatingAccount ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      enableRecommendations ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-sm text-smoke/70 text-center mb-6">
              {enableRecommendations
                ? "You'll see curated content alongside your newsletters."
                : "You'll only see content from your newsletters."}
            </p>

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
              onClick={handleRecommendationsSubmit}
              disabled={isCreatingAccount}
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
          </div>
        )}

        {/* Step 4: Your Inbox */}
        {step === 4 && (
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl text-pearl font-medium mb-2">
                You're all set
              </h2>
              <p className="text-smoke">
                Forward newsletters to your personal inbox.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 text-smoke/60 text-sm mb-3">
                <Mail className="w-4 h-4" />
                Your inbox address
              </div>
              <div className="p-4 bg-slate border border-ash rounded-xl">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-life text-sm break-all flex-1">{inboxEmail}</code>
                  <button
                    onClick={copyEmail}
                    className="p-2 rounded-lg hover:bg-ash transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-life" />
                    ) : (
                      <Copy className="w-4 h-4 text-smoke" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <p className="text-sm text-smoke">
                We'll distill your newsletters into<br />
                bite-sized wisdom for every new tab.
              </p>
              {!chromeIdentity && (
                <p className="text-xs text-smoke/50 mt-3">
                  Sign in to Chrome to sync across devices.
                </p>
              )}
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3.5 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 transition-all"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Progress */}
        <div className="flex justify-center gap-2 mt-10">
          {[1, 2, 3, 4].map((s) => (
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
