import type { UserProfile, Newsletter, Inspiration } from '../types';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'focustab_user_profile',
  NEWSLETTERS: 'focustab_newsletters',
  INSPIRATIONS: 'focustab_inspirations',
  SHOWN_INSPIRATIONS: 'focustab_shown_inspirations',
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
  return storage.get<UserProfile>(STORAGE_KEYS.USER_PROFILE);
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

export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Newsletter management
export async function getNewsletters(): Promise<Newsletter[]> {
  const newsletters = await storage.get<Newsletter[]>(STORAGE_KEYS.NEWSLETTERS);
  return newsletters || [];
}

export async function saveNewsletters(newsletters: Newsletter[]): Promise<void> {
  await storage.set(STORAGE_KEYS.NEWSLETTERS, newsletters);
}

export async function markNewsletterRead(id: string): Promise<void> {
  const newsletters = await getNewsletters();
  const updated = newsletters.map(n => 
    n.id === id ? { ...n, isRead: true } : n
  );
  await saveNewsletters(updated);
}

// Inspiration management
export async function getInspirations(): Promise<Inspiration[]> {
  const inspirations = await storage.get<Inspiration[]>(STORAGE_KEYS.INSPIRATIONS);
  return inspirations || [];
}

export async function saveInspirations(inspirations: Inspiration[]): Promise<void> {
  await storage.set(STORAGE_KEYS.INSPIRATIONS, inspirations);
}

export async function getRandomInspiration(): Promise<Inspiration | null> {
  const inspirations = await getInspirations();
  const shownIds = await storage.get<string[]>(STORAGE_KEYS.SHOWN_INSPIRATIONS) || [];
  
  // Filter out recently shown
  const unshown = inspirations.filter(i => !shownIds.includes(i.id));
  const pool = unshown.length > 0 ? unshown : inspirations;
  
  if (pool.length === 0) return null;
  
  const selected = pool[Math.floor(Math.random() * pool.length)];
  
  // Track shown (keep last 10)
  const newShown = [...shownIds, selected.id].slice(-10);
  await storage.set(STORAGE_KEYS.SHOWN_INSPIRATIONS, newShown);
  
  return selected;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format date for display
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

// Generate inbox email (mock - in production this would come from backend)
export function generateInboxEmail(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.random().toString(36).substr(2, 6);
  return `${slug}-${random}@focustab.app`;
}
