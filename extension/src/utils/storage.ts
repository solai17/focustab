import type { UserProfile } from '../types';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'focustab_user_profile',
} as const;

// Check if we're in Chrome extension context
declare const chrome: {
  storage: {
    local: {
      get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, callback?: () => void) => void;
      remove: (keys: string[], callback?: () => void) => void;
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

// User profile management
export async function getUserProfile(): Promise<UserProfile | null> {
  const profile = await storage.get<UserProfile>(STORAGE_KEYS.USER_PROFILE);

  // Add default values for new fields (backwards compatibility)
  if (profile) {
    return {
      ...profile,
      enableRecommendations: profile.enableRecommendations ?? true,
    };
  }

  return null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await storage.set(STORAGE_KEYS.USER_PROFILE, profile);
}

// Life calculations
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
