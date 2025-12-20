import { Request } from 'express';

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  birthDate: string;
  enableRecommendations?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

export interface MailgunWebhookPayload {
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  'body-plain': string;
  'body-html': string;
  'stripped-text': string;
  'stripped-html': string;
  timestamp: string;
  token: string;
  signature: string;
}

// =============================================================================
// CONTENT BYTE TYPES (v2.0)
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

export interface ContentByteResponse {
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
    website: string | null; // Newsletter subscription URL (extracted by AI)
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
  createdAt: Date;
}

export interface FeedResponse {
  bytes: ContentByteResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type FeedType = 'personalized' | 'popular' | 'trending' | 'subscribed' | 'new';

// =============================================================================
// ENGAGEMENT TYPES
// =============================================================================

export interface VoteInput {
  vote: -1 | 0 | 1;
}

export interface ViewInput {
  dwellTimeMs: number;
}

export interface EngagementStats {
  totalUpvotes: number;
  totalDownvotes: number;
  totalViews: number;
  totalSaves: number;
  engagementRate: number;
}

// =============================================================================
// PROCESSING TYPES (Claude AI)
// =============================================================================

export interface ExtractedByte {
  content: string;
  type: ByteType;
  author?: string;
  context?: string;
  category: ByteCategory;
  qualityScore: number; // 0-1 AI confidence
}

export interface ProcessedEdition {
  summary: string;
  readTimeMinutes: number;
  bytes: ExtractedByte[];
}

// =============================================================================
// DISCOVERY TYPES
// =============================================================================

export interface NewsletterSourceResponse {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subscriberCount: number;
  avgEngagementScore: number;
  isVerified: boolean;
  isSubscribed?: boolean;
}

export interface TrendingResponse {
  bytes: ContentByteResponse[];
  timeframe: '1h' | '24h' | '7d';
}

// =============================================================================
// PERSONALIZATION TYPES
// =============================================================================

export interface UserPreferenceResponse {
  category: ByteCategory;
  weight: number;
}

export interface PersonalizationProfile {
  preferences: UserPreferenceResponse[];
  topCategories: ByteCategory[];
  engagementHistory: {
    totalVotes: number;
    upvoteRatio: number;
    favoriteCategories: ByteCategory[];
  };
}

// =============================================================================
// DAILY CONTENT (v2.0)
// =============================================================================

export interface DailyContentV2 {
  byte: ContentByteResponse | null;
  mortalityStats: {
    sundaysRemaining: number;
    percentLived: number;
    message: string; // Contextual message connecting mortality to content
  };
  queueSize: number; // How many bytes available
}

// Legacy type for backward compatibility
export interface DailyContent {
  inspiration: {
    id: string;
    quote: string;
    author: string | null;
    source: string;
    category: string;
  } | null;
  newsletters: Array<{
    id: string;
    subject: string;
    senderName: string | null;
    summary: string | null;
    keyInsight: string | null;
    readTimeMinutes: number | null;
    receivedAt: Date;
    isRead: boolean;
  }>;
  stats: {
    sundaysRemaining: number;
    percentLived: number;
  };
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}
