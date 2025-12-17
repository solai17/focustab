import type { Inspiration, Newsletter, ContentByte } from '../types';

// =============================================================================
// v2.0 CONTENT BYTES - "Reels for Text"
// =============================================================================

export const SAMPLE_BYTES: ContentByte[] = [
  // Time & Mortality themed bytes (shown first to new users)
  {
    id: 'byte-1',
    content: "You have about 4,000 weeks to live. How you spend this one matters.",
    type: 'insight',
    author: 'Oliver Burkeman',
    context: 'on time',
    category: 'life',
    source: {
      id: 'src-1',
      name: 'Four Thousand Weeks',
      isVerified: true,
    },
    engagement: { upvotes: 3247, downvotes: 12, viewCount: 65420 },
    isSponsored: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'byte-2',
    content: "The best time to plant a tree was 20 years ago. The second best time is now.",
    type: 'quote',
    author: 'Chinese Proverb',
    context: 'on taking action',
    category: 'wisdom',
    source: {
      id: 'src-2',
      name: "James Clear's 3-2-1",
      isVerified: true,
    },
    engagement: { upvotes: 2847, downvotes: 12, viewCount: 45420 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'byte-3',
    content: "Health is the first wealth. Without it, nothing else matters.",
    type: 'insight',
    author: 'Ralph Waldo Emerson',
    context: 'on priorities',
    category: 'health',
    source: {
      id: 'src-3',
      name: 'The Hustle',
      isVerified: true,
    },
    engagement: { upvotes: 1856, downvotes: 14, viewCount: 35230 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'byte-4',
    content: "We don't rise to the level of our goals. We fall to the level of our systems.",
    type: 'insight',
    author: 'James Clear',
    context: 'on habits',
    category: 'productivity',
    source: {
      id: 'src-4',
      name: 'Atomic Habits Newsletter',
      isVerified: true,
    },
    engagement: { upvotes: 2243, downvotes: 23, viewCount: 48540 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'byte-5',
    content: "The obstacle is the way.",
    type: 'quote',
    author: 'Marcus Aurelius',
    context: 'on challenges',
    category: 'wisdom',
    source: {
      id: 'src-5',
      name: 'Daily Stoic',
      isVerified: true,
    },
    engagement: { upvotes: 2956, downvotes: 34, viewCount: 55230 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'byte-6',
    content: "Ask yourself: 'Will this matter in 5 years?' If not, don't spend more than 5 minutes upset about it.",
    type: 'mental_model',
    author: null,
    context: 'on perspective',
    category: 'life',
    source: {
      id: 'src-6',
      name: 'Farnam Street',
      isVerified: true,
    },
    engagement: { upvotes: 1923, downvotes: 15, viewCount: 36540 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: 'byte-7',
    content: "Every yes is a no to something else. Make your nos intentional.",
    type: 'takeaway',
    author: null,
    context: 'on prioritization',
    category: 'productivity',
    source: {
      id: 'src-7',
      name: "Lenny's Newsletter",
      isVerified: true,
    },
    engagement: { upvotes: 1567, downvotes: 8, viewCount: 32340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'byte-8',
    content: "Your attention is your most precious resource. Guard it like your life depends on it—because your life is made of it.",
    type: 'insight',
    author: null,
    context: 'on focus',
    category: 'productivity',
    source: {
      id: 'src-8',
      name: 'Cal Newport',
      isVerified: true,
    },
    engagement: { upvotes: 1834, downvotes: 28, viewCount: 41340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: 'byte-9',
    content: "What I cannot create, I do not understand.",
    type: 'quote',
    author: 'Richard Feynman',
    context: 'on learning',
    category: 'wisdom',
    source: {
      id: 'src-9',
      name: 'Farnam Street',
      isVerified: true,
    },
    engagement: { upvotes: 1876, downvotes: 21, viewCount: 42180 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 691200000).toISOString(),
  },
  {
    id: 'byte-10',
    content: "The most dangerous risk: spending your life not doing what you want, betting you can buy freedom later.",
    type: 'counterintuitive',
    author: 'Randy Komisar',
    context: 'on life choices',
    category: 'life',
    source: {
      id: 'src-10',
      name: "Tim Ferriss Show",
      isVerified: true,
    },
    engagement: { upvotes: 2541, downvotes: 18, viewCount: 52340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 777600000).toISOString(),
  },
  {
    id: 'byte-11',
    content: "1% better every day = 37x better in a year. Small improvements compound.",
    type: 'statistic',
    author: 'James Clear',
    context: 'on growth',
    category: 'productivity',
    source: {
      id: 'src-4',
      name: 'Atomic Habits Newsletter',
      isVerified: true,
    },
    engagement: { upvotes: 2156, downvotes: 22, viewCount: 48760 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 864000000).toISOString(),
  },
  {
    id: 'byte-12',
    content: "Block 2 hours every morning for deep work. No meetings, no Slack, no email.",
    type: 'action',
    author: 'Cal Newport',
    context: 'on focus',
    category: 'productivity',
    source: {
      id: 'src-8',
      name: 'Deep Questions',
      isVerified: true,
    },
    engagement: { upvotes: 1734, downvotes: 28, viewCount: 31340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 950400000).toISOString(),
  },
];

// =============================================================================
// LEGACY DATA (for backward compatibility)
// =============================================================================

export const SAMPLE_INSPIRATIONS: Inspiration[] = [
  {
    id: '1',
    quote: "The best time to plant a tree was 20 years ago. The second best time is now.",
    author: "Chinese Proverb",
    source: "James Clear's 3-2-1",
    category: 'wisdom',
  },
  {
    id: '2',
    quote: "We do not rise to the level of our goals. We fall to the level of our systems.",
    author: "James Clear",
    source: "Atomic Habits Newsletter",
    category: 'motivation',
  },
  {
    id: '3',
    quote: "The purpose of life is not to be happy. It is to be useful, to be honorable, to be compassionate.",
    author: "Ralph Waldo Emerson",
    source: "Brain Pickings",
    category: 'reflection',
  },
  {
    id: '4',
    quote: "What I cannot create, I do not understand.",
    author: "Richard Feynman",
    source: "Farnam Street",
    category: 'wisdom',
  },
  {
    id: '5',
    quote: "The obstacle is the way.",
    author: "Marcus Aurelius",
    source: "Daily Stoic",
    category: 'motivation',
  },
  {
    id: '6',
    quote: "In the long run, we shape our lives, and we shape ourselves. The process never ends.",
    author: "Eleanor Roosevelt",
    source: "Tim Ferriss' 5-Bullet Friday",
    category: 'reflection',
  },
  {
    id: '7',
    quote: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
    source: "Dense Discovery",
    category: 'wisdom',
  },
  {
    id: '8',
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    source: "Morning Brew",
    category: 'motivation',
  },
];

export const SAMPLE_NEWSLETTERS: Newsletter[] = [
  {
    id: 'nl-1',
    title: "Why Cursor is eating the IDE market",
    source: "Stratechery",
    summary: "Ben Thompson analyzes how AI-native tools like Cursor are fundamentally reshaping developer workflows, challenging established players like VS Code and JetBrains.",
    keyInsight: "The future of developer tools is AI-first, not AI-added.",
    readTimeMinutes: 12,
    receivedAt: new Date().toISOString(),
    isRead: false,
  },
  {
    id: 'nl-2',
    title: "The Art of Saying No",
    source: "Lenny's Newsletter",
    summary: "Product leaders share frameworks for prioritization and how to decline requests without burning bridges. Includes templates for stakeholder communication.",
    keyInsight: "Every yes is a no to something else. Make your nos intentional.",
    readTimeMinutes: 8,
    receivedAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: false,
  },
  {
    id: 'nl-3',
    title: "Building a Second Brain: 2024 Update",
    source: "Forte Labs",
    summary: "Tiago Forte updates his personal knowledge management system with new tools and workflows, emphasizing capture friction and progressive summarization.",
    keyInsight: "The goal isn't to remember everything—it's to forget safely.",
    readTimeMinutes: 15,
    receivedAt: new Date(Date.now() - 172800000).toISOString(),
    isRead: true,
  },
];

export const DEFAULT_LIFE_EXPECTANCY = 80;

// =============================================================================
// BYTE TRACKING & SELECTION
// =============================================================================

const STORAGE_KEY = 'byteletters_shown_bytes';
const LAST_BYTE_KEY = 'byteletters_last_byte';

// Check if we're in Chrome extension context
declare const chrome: {
  storage?: {
    local: {
      get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, callback?: () => void) => void;
    };
  };
} | undefined;

const isExtension = typeof chrome !== 'undefined' && chrome?.storage;

/**
 * Get shown byte IDs from storage
 */
async function getShownByteIds(): Promise<string[]> {
  if (isExtension && chrome?.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve((result[STORAGE_KEY] as string[]) || []);
      });
    });
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Get last shown byte ID
 */
async function getLastByteId(): Promise<string | null> {
  if (isExtension && chrome?.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get([LAST_BYTE_KEY], (result) => {
        resolve((result[LAST_BYTE_KEY] as string) || null);
      });
    });
  }
  return localStorage.getItem(LAST_BYTE_KEY);
}

/**
 * Mark byte as shown
 */
async function markByteShown(byteId: string): Promise<void> {
  const shownIds = await getShownByteIds();

  // Add to shown list if not already there
  if (!shownIds.includes(byteId)) {
    shownIds.push(byteId);
  }

  // If all bytes have been shown, keep only the last few to allow recycling
  // but prevent immediate repetition
  const maxRecent = Math.min(5, Math.floor(SAMPLE_BYTES.length / 2));
  const idsToStore = shownIds.length >= SAMPLE_BYTES.length
    ? shownIds.slice(-maxRecent)
    : shownIds;

  if (isExtension && chrome?.storage) {
    chrome.storage.local.set({
      [STORAGE_KEY]: idsToStore,
      [LAST_BYTE_KEY]: byteId
    });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(idsToStore));
    localStorage.setItem(LAST_BYTE_KEY, byteId);
  }
}

/**
 * Get a random byte from the sample data
 */
export function getRandomByte(): ContentByte {
  const index = Math.floor(Math.random() * SAMPLE_BYTES.length);
  return SAMPLE_BYTES[index];
}

/**
 * Get the next byte - prioritizes unseen bytes, avoids repetition
 */
export async function getNextByteAsync(): Promise<ContentByte> {
  const shownIds = await getShownByteIds();
  const lastByteId = await getLastByteId();

  // Get unseen bytes (excluding the last shown one)
  const unseenBytes = SAMPLE_BYTES.filter(
    (b) => !shownIds.includes(b.id) && b.id !== lastByteId
  );

  let selectedByte: ContentByte;

  if (unseenBytes.length > 0) {
    // Pick a random unseen byte
    const index = Math.floor(Math.random() * unseenBytes.length);
    selectedByte = unseenBytes[index];
  } else {
    // All seen - pick any byte except the last one
    const availableBytes = SAMPLE_BYTES.filter((b) => b.id !== lastByteId);
    const index = Math.floor(Math.random() * availableBytes.length);
    selectedByte = availableBytes[index];
  }

  // Mark as shown
  await markByteShown(selectedByte.id);

  return selectedByte;
}

/**
 * Synchronous version for backward compatibility (uses cached state)
 */
let cachedShownIds: string[] = [];
let cachedLastByteId: string | null = null;
let cacheInitialized = false;

// Initialize cache on module load
(async () => {
  cachedShownIds = await getShownByteIds();
  cachedLastByteId = await getLastByteId();
  cacheInitialized = true;
})();

export function getNextByte(): ContentByte {
  // Get unseen bytes (excluding the last shown one)
  const unseenBytes = SAMPLE_BYTES.filter(
    (b) => !cachedShownIds.includes(b.id) && b.id !== cachedLastByteId
  );

  let selectedByte: ContentByte;

  if (unseenBytes.length > 0) {
    // Pick a random unseen byte
    const index = Math.floor(Math.random() * unseenBytes.length);
    selectedByte = unseenBytes[index];
  } else {
    // All seen - pick any byte except the last one, then reset tracking
    const availableBytes = SAMPLE_BYTES.filter((b) => b.id !== cachedLastByteId);
    const index = Math.floor(Math.random() * availableBytes.length);
    selectedByte = availableBytes[index];

    // Reset the shown list but keep last few to prevent immediate repeats
    const maxRecent = Math.min(3, Math.floor(SAMPLE_BYTES.length / 3));
    cachedShownIds = cachedShownIds.slice(-maxRecent);
  }

  // Update cache
  if (!cachedShownIds.includes(selectedByte.id)) {
    cachedShownIds.push(selectedByte.id);
  }
  cachedLastByteId = selectedByte.id;

  // Persist asynchronously (don't block)
  markByteShown(selectedByte.id);

  return selectedByte;
}

/**
 * Reset byte tracking (for testing)
 */
export function resetByteIndex(): void {
  cachedShownIds = [];
  cachedLastByteId = null;

  if (isExtension && chrome?.storage) {
    chrome.storage.local.set({
      [STORAGE_KEY]: [],
      [LAST_BYTE_KEY]: null
    });
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_BYTE_KEY);
  }
}
