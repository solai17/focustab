// =============================================================================
// USER TYPES
// =============================================================================

export interface UserProfile {
  name: string;
  birthDate: string; // ISO date string
  lifeExpectancy: number;
  enableRecommendations: boolean;
  createdAt: string;
  // True only once the user has explicitly finished onboarding (entered their
  // name + birth date). Bytes are never shown until this is true. Optional for
  // backwards-compat with profiles stored before this field existed.
  onboardingCompleted?: boolean;
}

// =============================================================================
// CONTENT BYTE TYPES (v2.0 - "Reels for Text")
// =============================================================================

export type ByteType = 'quote' | 'insight' | 'statistic' | 'action' | 'takeaway' | 'mental_model' | 'counterintuitive';

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
    website?: string | null; // Newsletter subscription URL
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
