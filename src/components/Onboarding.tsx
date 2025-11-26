import { useState } from 'react';
import { ArrowRight, Calendar, User, Mail, Copy, Check } from 'lucide-react';
import type { UserProfile } from '../types';
import { generateInboxEmail } from '../utils/storage';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inboxEmail, setInboxEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      const email = generateInboxEmail(name);
      setInboxEmail(email);
      setStep(2);
    }
  };

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (birthDate) {
      setStep(3);
    }
  };

  const handleComplete = () => {
    const profile: UserProfile = {
      name: name.trim(),
      birthDate,
      lifeExpectancy: 80,
      inboxEmail,
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
          <h1 className="font-display text-4xl text-pearl mb-2">FocusTab</h1>
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

        {/* Step 3: Inbox Email */}
        {step === 3 && (
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
                  <span className="text-pearl font-medium">Forward your newsletters</span> to this address.
                  We'll extract wisdom and reading recommendations from them.
                </p>
                <p className="text-xs text-smoke/60">
                  Note: In this demo version, we use sample content. The full version will process real emails.
                </p>
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
          {[1, 2, 3].map((s) => (
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
