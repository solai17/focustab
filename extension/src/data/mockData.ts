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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a random byte from the sample data
 */
export function getRandomByte(): ContentByte {
  const index = Math.floor(Math.random() * SAMPLE_BYTES.length);
  return SAMPLE_BYTES[index];
}

/**
 * Get the next byte (simulating a feed)
 */
let currentByteIndex = 0;
export function getNextByte(): ContentByte {
  const byte = SAMPLE_BYTES[currentByteIndex];
  currentByteIndex = (currentByteIndex + 1) % SAMPLE_BYTES.length;
  return byte;
}

/**
 * Reset the byte index (for testing)
 */
export function resetByteIndex(): void {
  currentByteIndex = 0;
}
