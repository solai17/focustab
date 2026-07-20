import type { UserProfile } from '../types';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'focustab_user_profile',
} as const;

// Check if we're in Chrome extension context
type StorageChange = { newValue?: unknown; oldValue?: unknown };
declare const chrome: {
  storage: {
    local: {
      get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, callback?: () => void) => void;
      remove: (keys: string[], callback?: () => void) => void;
    };
    onChanged?: {
      addListener: (cb: (changes: Record<string, StorageChange>, area: string) => void) => void;
      removeListener: (cb: (changes: Record<string, StorageChange>, area: string) => void) => void;
    };
  };
} | undefined;

const isExtension = typeof chrome !== 'undefined' && chrome?.storage;

// Storage abstraction (works in both extension and web contexts)
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    if (isExtension && chrome) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result: Record<string, unknown>) => {
          resolve((result[key] as T) || null);
        });
      });
    }
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },

  async set(key: string, value: unknown): Promise<void> {
    if (isExtension && chrome) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    }
    localStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    if (isExtension && chrome) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], resolve);
      });
    }
    localStorage.removeItem(key);
  },
};

/**
 * Subscribe to changes of a storage key across ALL open tabs.
 * chrome.storage.onChanged fires in every context (including the writer),
 * which makes storage the shared source of truth for things like the
 * byte streak - every open new tab stays in sync live.
 * Returns an unsubscribe function.
 */
export function subscribeToKey<T>(key: string, callback: (value: T | null) => void): () => void {
  if (isExtension && chrome?.storage?.onChanged) {
    const listener = (changes: Record<string, StorageChange>, area: string) => {
      if (area === 'local' && key in changes) {
        callback((changes[key].newValue as T) ?? null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged?.removeListener(listener);
  }

  // Web/dev fallback: the storage event (fires in other tabs only)
  const listener = (e: StorageEvent) => {
    if (e.key === key) {
      callback(e.newValue ? (JSON.parse(e.newValue) as T) : null);
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

// User profile management
export async function getUserProfile(): Promise<UserProfile | null> {
  const profile = await storage.get<UserProfile>(STORAGE_KEYS.USER_PROFILE);

  // Add default values for new fields (backwards compatibility)
  if (profile) {
    // Legacy profiles (saved before onboardingCompleted existed) don't carry the
    // flag. Infer it: a real onboarded profile has a birth date that isn't the
    // "today" placeholder the old silent-auth bug fabricated. Missing birthDate
    // or birthDate === today means onboarding was never genuinely completed.
    const today = new Date().toISOString().split('T')[0];
    const looksOnboarded = !!profile.birthDate && profile.birthDate !== today;

    return {
      ...profile,
      enableRecommendations: profile.enableRecommendations ?? true,
      onboardingCompleted: profile.onboardingCompleted ?? looksOnboarded,
    };
  }

  return null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await storage.set(STORAGE_KEYS.USER_PROFILE, profile);
}

// Life calculations

/** Which week of your life this is (1-indexed): week #1,897 etc. */
export function calculateWeekNumber(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((now.getTime() - birth.getTime()) / msPerWeek) + 1);
}

export function calculateSundaysRemaining(birthDate: string, lifeExpectancy: number = 80): number {
  const birth = new Date(birthDate);
  const deathDate = new Date(birth);
  deathDate.setFullYear(deathDate.getFullYear() + lifeExpectancy);

  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor((deathDate.getTime() - now.getTime()) / msPerWeek));
}

export function calculatePercentLived(birthDate: string, lifeExpectancy: number = 80): number {
  const birth = new Date(birthDate);
  const deathDate = new Date(birth);
  deathDate.setFullYear(deathDate.getFullYear() + lifeExpectancy);

  const now = new Date();
  const totalLife = deathDate.getTime() - birth.getTime();
  const lived = now.getTime() - birth.getTime();

  return Math.min(100, Math.max(0, (lived / totalLife) * 100));
}
