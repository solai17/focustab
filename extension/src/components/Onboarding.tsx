import { useState, useEffect } from 'react';
import { ArrowRight, Calendar, User, Mail, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
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
          console.log('Chrome Identity found:', identity.email);
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
      // If we have Chrome Identity, authenticate with backend
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

        // Use inbox email from server
        setInboxEmail(user.inboxEmail);
      } else {
        // Demo mode: generate a placeholder email
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
        const random = Math.random().toString(36).substring(2, 8);
        setInboxEmail(`${slug}-${random}@inbox.byteletters.app`);
      }

      setStep(4);
    } catch (err) {
      console.error('Account creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="font-display text-4xl text-pearl mb-2">ByteLetters</h1>
          <p className="text-smoke">Life is short. Make it count.</p>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <form onSubmit={handleNameSubmit} className="animate-slide-up">
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm text-smoke mb-3">
                <User className="w-4 h-4" />
                What should I call you?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full px-4 py-3 bg-slate border border-ash rounded-xl text-pearl placeholder:text-smoke/50 focus:outline-none focus:border-life/50 focus:ring-1 focus:ring-life/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Birth Date */}
        {step === 2 && (
          <form onSubmit={handleDateSubmit} className="animate-slide-up">
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm text-smoke mb-3">
                <Calendar className="w-4 h-4" />
                When were you born, {name.split(' ')[0]}?
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-slate border border-ash rounded-xl text-pearl focus:outline-none focus:border-life/50 focus:ring-1 focus:ring-life/20 transition-all"
              />
              <p className="text-xs text-smoke/60 mt-2">
                This helps calculate your remaining Sundays. We assume 80 years—you can adjust later.
              </p>
            </div>
            <button
              type="submit"
              disabled={!birthDate}
              className="w-full py-3 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 3: Recommendations Toggle */}
        {step === 3 && (
          <div className="animate-slide-up">
            <div className="mb-8">
              <div className="flex items-center gap-2 text-sm text-smoke mb-4">
                <Sparkles className="w-4 h-4" />
                Discover new content
              </div>

              <div className="p-6 bg-slate border border-ash rounded-xl mb-4">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setEnableRecommendations(!enableRecommendations)}
                    disabled={isCreatingAccount}
                    className={`w-12 h-7 rounded-full transition-all flex items-center px-1 flex-shrink-0 ${
                      enableRecommendations ? 'bg-life' : 'bg-ash'
                    } ${isCreatingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        enableRecommendations ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <div>
                    <h3 className="text-pearl font-medium mb-1">
                      Enable Recommendations
                    </h3>
                    <p className="text-sm text-smoke leading-relaxed">
                      Discover popular content from newsletters you don't follow yet.
                      We'll show you what's resonating with the community.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-smoke">
                <p>
                  {enableRecommendations ? (
                    <>
                      <span className="text-life">Great choice!</span> You'll see a mix of content
                      from your newsletters and popular bytes from the community.
                    </>
                  ) : (
                    <>
                      No problem! You'll only see content from newsletters you forward.
                      You can enable this anytime in settings.
                    </>
                  )}
                </p>
              </div>

              {/* Chrome Identity indicator */}
              {chromeIdentity && (
                <div className="mt-4 p-3 bg-life/10 border border-life/20 rounded-lg">
                  <p className="text-xs text-life">
                    Signed in as {chromeIdentity.email}
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleRecommendationsSubmit}
              disabled={isCreatingAccount}
              className="w-full py-3 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isCreatingAccount ? (
                <>
                  <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                  Creating account...
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

        {/* Step 4: Inbox Email */}
        {step === 4 && (
          <div className="animate-slide-up">
            <div className="mb-8">
              <div className="flex items-center gap-2 text-sm text-smoke mb-3">
                <Mail className="w-4 h-4" />
                Your personal newsletter inbox
              </div>

              <div className="p-4 bg-slate border border-ash rounded-xl mb-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-life text-sm break-all">{inboxEmail}</code>
                  <button
                    onClick={copyEmail}
                    className="p-2 rounded-lg hover:bg-ash transition-colors flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-life" />
                    ) : (
                      <Copy className="w-4 h-4 text-smoke" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm text-smoke">
                <p>
                  <span className="text-pearl font-medium">Forward your newsletters</span> to this
                  address. We'll extract bite-sized wisdom from them.
                </p>
                {enableRecommendations && (
                  <p className="text-xs text-smoke/60">
                    While you wait for your newsletters, you'll see popular content from the community.
                  </p>
                )}
                {!chromeIdentity && (
                  <p className="text-xs text-smoke/60">
                    Note: Sign in to Chrome to sync your account across devices.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3 px-4 bg-life text-void font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-life/90 transition-all"
            >
              Start my journey
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                s === step ? 'bg-life w-6' : s < step ? 'bg-life/50' : 'bg-ash'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
