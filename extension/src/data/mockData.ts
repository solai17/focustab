import type { Inspiration, Newsletter, ContentByte } from '../types';

// =============================================================================
// v2.0 CONTENT BYTES - "Reels for Text"
// =============================================================================

export const SAMPLE_BYTES: ContentByte[] = [
  {
    id: 'byte-1',
    content: "The best time to plant a tree was 20 years ago. The second best time is now.",
    type: 'quote',
    author: 'Chinese Proverb',
    context: 'on taking action',
    category: 'wisdom',
    source: {
      id: 'src-1',
      name: "James Clear's 3-2-1",
      isVerified: true,
    },
    engagement: { upvotes: 847, downvotes: 12, viewCount: 15420 },
    isSponsored: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'byte-2',
    content: "We do not rise to the level of our goals. We fall to the level of our systems.",
    type: 'insight',
    author: 'James Clear',
    context: 'on habits',
    category: 'productivity',
    source: {
      id: 'src-2',
      name: 'Atomic Habits Newsletter',
      isVerified: true,
    },
    engagement: { upvotes: 1243, downvotes: 23, viewCount: 28540 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'byte-3',
    content: "The obstacle is the way.",
    type: 'quote',
    author: 'Marcus Aurelius',
    context: 'on challenges',
    category: 'wisdom',
    source: {
      id: 'src-3',
      name: 'Daily Stoic',
      isVerified: true,
    },
    engagement: { upvotes: 2156, downvotes: 34, viewCount: 45230 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'byte-4',
    content: "Every yes is a no to something else. Make your nos intentional.",
    type: 'takeaway',
    author: null,
    context: 'on prioritization',
    category: 'productivity',
    source: {
      id: 'src-4',
      name: "Lenny's Newsletter",
      isVerified: true,
    },
    engagement: { upvotes: 567, downvotes: 8, viewCount: 12340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'byte-5',
    content: "Companies that win in AI will be those that have unique data, not those that have the best models.",
    type: 'insight',
    author: 'Ben Thompson',
    context: 'on AI strategy',
    category: 'tech',
    source: {
      id: 'src-5',
      name: 'Stratechery',
      isVerified: true,
    },
    engagement: { upvotes: 892, downvotes: 45, viewCount: 19870 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'byte-6',
    content: "The goal isn't to remember everything—it's to forget safely.",
    type: 'insight',
    author: 'Tiago Forte',
    context: 'on knowledge management',
    category: 'productivity',
    source: {
      id: 'src-6',
      name: 'Forte Labs',
      isVerified: true,
    },
    engagement: { upvotes: 723, downvotes: 15, viewCount: 16540 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: 'byte-7',
    content: "90% of startups fail because they build something nobody wants, not because they build it wrong.",
    type: 'statistic',
    author: null,
    context: 'on product-market fit',
    category: 'business',
    source: {
      id: 'src-7',
      name: 'First Round Review',
      isVerified: true,
    },
    engagement: { upvotes: 1456, downvotes: 67, viewCount: 34560 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'byte-8',
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
    engagement: { upvotes: 934, downvotes: 28, viewCount: 21340 },
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
    content: "The most dangerous risk of all – the risk of spending your life not doing what you want on the bet you can buy yourself the freedom to do it later.",
    type: 'quote',
    author: 'Randy Komisar',
    context: 'on life choices',
    category: 'life',
    source: {
      id: 'src-4',
      name: "Lenny's Newsletter",
      isVerified: true,
    },
    engagement: { upvotes: 2341, downvotes: 18, viewCount: 52340 },
    isSponsored: false,
    createdAt: new Date(Date.now() - 777600000).toISOString(),
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
