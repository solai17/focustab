import { X, User, Calendar, Mail, Copy, Check, Trash2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile } from '../types';

interface SettingsProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (profile: UserProfile) => void;
  onReset: () => void;
}

export function Settings({ profile, onClose, onUpdate, onReset }: SettingsProps) {
  const [name, setName] = useState(profile.name);
  const [birthDate, setBirthDate] = useState(profile.birthDate);
  const [lifeExpectancy, setLifeExpectancy] = useState(profile.lifeExpectancy);
  const [enableRecommendations, setEnableRecommendations] = useState(
    profile.enableRecommendations ?? true
  );
  const [copied, setCopied] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = () => {
    onUpdate({
      ...profile,
      name,
      birthDate,
      lifeExpectancy,
      enableRecommendations,
    });
    onClose();
  };

  const copyEmail = async () => {
    if (profile.inboxEmail) {
      await navigator.clipboard.writeText(profile.inboxEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-md bg-obsidian border border-ash rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ash sticky top-0 bg-obsidian z-10">
          <h2 className="font-display text-xl text-pearl">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ash transition-colors"
          >
            <X className="w-5 h-5 text-smoke" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm text-smoke mb-2">
              <User className="w-4 h-4" />
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate border border-ash rounded-lg text-pearl placeholder:text-smoke/50 focus:outline-none focus:border-life/50 transition-all"
            />
          </div>

          {/* Birth Date */}
          <div>
            <label className="flex items-center gap-2 text-sm text-smoke mb-2">
              <Calendar className="w-4 h-4" />
              Birth Date
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 bg-slate border border-ash rounded-lg text-pearl focus:outline-none focus:border-life/50 transition-all"
            />
          </div>

          {/* Life Expectancy */}
          <div>
            <label className="flex items-center gap-2 text-sm text-smoke mb-2">
              Life Expectancy
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="100"
                value={lifeExpectancy}
                onChange={(e) => setLifeExpectancy(Number(e.target.value))}
                className="flex-1 h-2 bg-ash rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-life [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className="text-pearl font-mono text-sm w-12 text-right">
                {lifeExpectancy} yrs
              </span>
            </div>
          </div>

          {/* Recommendations Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm text-smoke mb-3">
              <Sparkles className="w-4 h-4" />
              Discovery
            </label>
            <div className="flex items-start gap-4 p-4 bg-slate border border-ash rounded-lg">
              <button
                onClick={() => setEnableRecommendations(!enableRecommendations)}
                className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 flex-shrink-0 ${
                  enableRecommendations ? 'bg-life' : 'bg-ash'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    enableRecommendations ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex-1">
                <h3 className="text-pearl text-sm font-medium mb-1">
                  Community picks
                </h3>
                <p className="text-xs text-smoke leading-relaxed">
                  {enableRecommendations
                    ? "See curated content from the community."
                    : "Only show content from your newsletters."}
                </p>
              </div>
            </div>
          </div>

          {/* Inbox Email */}
          {profile.inboxEmail && (
            <div>
              <label className="flex items-center gap-2 text-sm text-smoke mb-2">
                <Mail className="w-4 h-4" />
                Newsletter Inbox
              </label>
              <div className="flex items-center gap-2 p-3 bg-slate border border-ash rounded-lg">
                <code className="text-life text-sm flex-1 break-all">
                  {profile.inboxEmail}
                </code>
                <button
                  onClick={copyEmail}
                  className="p-1.5 rounded hover:bg-ash transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-life" />
                  ) : (
                    <Copy className="w-4 h-4 text-smoke" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="pt-4 border-t border-ash">
            {showConfirmReset ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-rose">Are you sure?</span>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-sm bg-rose/10 text-rose rounded-lg hover:bg-rose/20 transition-colors"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-3 py-1.5 text-sm text-smoke hover:text-pearl transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="flex items-center gap-2 text-sm text-smoke hover:text-rose transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset all data
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-ash sticky bottom-0 bg-obsidian">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-smoke hover:text-pearl border border-ash rounded-lg hover:border-smoke transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 bg-life text-void font-medium rounded-lg hover:bg-life/90 transition-all"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
