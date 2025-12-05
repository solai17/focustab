// =============================================================================
// USER TYPES
// =============================================================================

export interface UserProfile {
  name: string;
  birthDate: string; // ISO date string
  lifeExpectancy: number;
  inboxEmail?: string;
  enableRecommendations: boolean;
  createdAt: string;
}

// =============================================================================
// CONTENT BYTE TYPES (v2.0 - "Reels for Text")
// =============================================================================

export type ByteType = 'quote' | 'insight' | 'statistic' | 'action' | 'takeaway';

export type ByteCategory =
  | 'wisdom'
  | 'productivity'
  | 'business'
  | 'tech'
  | 'life'
  | 'creativity'
  | 'leadership'
  | 'finance'
  | 'health'
  | 'general';

export interface ContentByte {
  id: string;
  content: string;
  type: ByteType;
  author: string | null;
  context: string | null;
  category: ByteCategory;
  source: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  engagement: {
    upvotes: number;
    downvotes: number;
    viewCount: number;
  };
  userEngagement?: {
    vote: number; // -1, 0, +1
    isSaved: boolean;
  };
  isSponsored: boolean;
  createdAt: string;
}

export interface FeedResponse {
  bytes: ContentByte[];
  nextCursor: string | null;
  hasMore: boolean;
}

// =============================================================================
// ENGAGEMENT TYPES
// =============================================================================

export type VoteValue = -1 | 0 | 1;

export interface EngagementAction {
  byteId: string;
  action: 'upvote' | 'downvote' | 'save' | 'view';
  value?: number; // For dwell time
}

// =============================================================================
// MORTALITY STATS
// =============================================================================

export interface MortalityStats {
  sundaysRemaining: number;
  percentLived: number;
  age: number;
  message: string; // Contextual message
}

// =============================================================================
// APP STATE
// =============================================================================

export interface AppSettings {
  showMortalityBar: boolean;
  lifeExpectancy: number;
  theme: 'dark' | 'light';
  enableRecommendations: boolean;
  feedType: 'personalized' | 'popular' | 'trending' | 'subscribed';
}

// =============================================================================
// LEGACY TYPES (for backward compatibility)
// =============================================================================

export interface Inspiration {
  id: string;
  quote: string;
  author: string;
  source: string;
  category: 'wisdom' | 'motivation' | 'reflection';
}

export interface Newsletter {
  id: string;
  title: string;
  source: string;
  summary: string;
  keyInsight: string;
  readTimeMinutes: number;
  receivedAt: string;
  isRead: boolean;
  originalUrl?: string;
  fullContent?: string;
}

export interface DailyContent {
  inspiration: Inspiration;
  newsletters: Newsletter[];
  sundaysRemaining: number;
  percentLived: number;
}

// =============================================================================
// NEWSLETTER SOURCE TYPES
// =============================================================================

export interface NewsletterSource {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subscriberCount: number;
  isVerified: boolean;
  isSubscribed?: boolean;
}
