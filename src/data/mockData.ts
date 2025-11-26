import type { Inspiration, Newsletter } from '../types';

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
