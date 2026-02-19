/**
 * API Service for ByteLetters
 * Connects extension to backend for bytes, engagement, and feed
 */

import { apiRequest, getStoredAuth } from './auth';
import type { ContentByte, VoteValue, ByteType, ByteCategory } from '../types';

// API Response types
export interface ByteResponse {
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
    vote: -1 | 0 | 1;
    isSaved: boolean;
  };
  isSponsored: boolean;
  createdAt: string;
}

export interface NextByteResponse {
  byte: ByteResponse | null;
  queueSize: number;
  hasUserSubscriptions?: boolean;
  isCommunityContent?: boolean;
}

export interface SavedBytesResponse {
  bytes: ByteResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface VoteResponse {
  success: boolean;
  vote: number;
  engagement: {
    upvotes: number;
    downvotes: number;
  };
}

export interface SaveResponse {
  success: boolean;
  isSaved: boolean;
}

// Convert API response to ContentByte type
function toContentByte(byte: ByteResponse): ContentByte {
  return {
    id: byte.id,
    content: byte.content,
    type: byte.type,
    author: byte.author,
    context: byte.context,
    category: byte.category,
    source: byte.source,
    engagement: byte.engagement,
    userEngagement: byte.userEngagement ? {
      vote: byte.userEngagement.vote,
      isSaved: byte.userEngagement.isSaved,
    } : undefined,
    isSponsored: byte.isSponsored,
    createdAt: byte.createdAt,
  };
}

/**
 * Check if user is authenticated (has valid token)
 */
export async function isAuthenticated(): Promise<boolean> {
  const auth = await getStoredAuth();
  return auth !== null && !!auth.token;
}

/**
 * Get the next byte for new tab experience
 */
export async function fetchNextByte(): Promise<{
  byte: ContentByte | null;
  queueSize: number;
  hasUserSubscriptions: boolean;
  isCommunityContent: boolean;
}> {
  const response = await apiRequest<NextByteResponse>('/feed/next');
  return {
    byte: response.byte ? toContentByte(response.byte) : null,
    queueSize: response.queueSize,
    hasUserSubscriptions: response.hasUserSubscriptions ?? false,
    isCommunityContent: response.isCommunityContent ?? true, // Default to community if not specified
  };
}

/**
 * Get user's saved bytes
 */
export async function fetchSavedBytes(limit: number = 50): Promise<ContentByte[]> {
  const response = await apiRequest<SavedBytesResponse>(`/feed/saved?limit=${limit}`);
  return response.bytes.map(toContentByte);
}

/**
 * Vote on a byte (upvote, downvote, or remove vote)
 */
export async function voteByte(byteId: string, vote: VoteValue): Promise<VoteResponse> {
  return apiRequest<VoteResponse>(`/feed/bytes/${byteId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

/**
 * Toggle save/unsave a byte
 */
export async function toggleSaveByte(byteId: string): Promise<SaveResponse> {
  return apiRequest<SaveResponse>(`/feed/bytes/${byteId}/save`, {
    method: 'POST',
  });
}

/**
 * Track view of a byte
 * @param isRead - true if user actually read the byte (tab was active 5+ seconds)
 */
export async function trackByteView(byteId: string, dwellTimeMs: number, isRead: boolean = false): Promise<void> {
  await apiRequest<{ success: boolean }>(`/feed/bytes/${byteId}/view`, {
    method: 'POST',
    body: JSON.stringify({ dwellTimeMs, isRead }),
  });
}

/**
 * Fetch popular bytes from the community (for empty feed)
 */
export async function fetchPopularBytes(limit: number = 10): Promise<ContentByte[]> {
  const response = await apiRequest<{ bytes: ByteResponse[]; nextCursor: string | null; hasMore: boolean }>(
    `/feed?type=popular&limit=${limit}`
  );
  return response.bytes.map(toContentByte);
}
