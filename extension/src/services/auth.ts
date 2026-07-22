/**
 * Authentication Service for FocusTab
 * Uses Chrome Identity API for cross-device authentication
 * Falls back to anonymous mode for web development
 */

import { storage } from '../utils/storage';

// Chrome Identity API types
declare const chrome: {
  identity?: {
    getProfileUserInfo: (
      details: { accountStatus?: 'ANY' | 'SYNC' },
      callback: (userInfo: { email: string; id: string }) => void
    ) => void;
    getAuthToken: (
      details: { interactive: boolean },
      callback: (token: string | undefined) => void
    ) => void;
  };
  runtime?: {
    lastError?: { message: string };
  };
  storage?: unknown;
} | undefined;

// API Configuration
// Production builds ALWAYS use the production API. A stray local .env
// (VITE_API_URL=http://localhost:3000) must never leak into a store build -
// that would make every install fail with "failed to fetch". VITE_API_URL
// is honored only in dev mode (npm run dev).
const PRODUCTION_API_URL = 'https://api.byteletters.app';
const API_BASE_URL = import.meta.env.PROD
  ? PRODUCTION_API_URL
  : (import.meta.env.VITE_API_URL || PRODUCTION_API_URL);
const API_TIMEOUT_MS = 10000; // 10 second timeout for regular API calls
// Render's free tier sleeps after ~15 min idle and can take 30-60s to wake.
// Calls that happen at "first request" time (account creation) need a longer
// budget and a retry, or a cold start hard-fails onboarding with "Failed to fetch".
const COLD_START_TIMEOUT_MS = 30000;

// Helper to fetch with a per-call timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Like fetchWithTimeout, but retries on transient failures (network errors,
 * timeouts, and 5xx / 502-503 cold-start responses from Render). Used for the
 * account-creation call, which is often the very first request that has to wake
 * a sleeping free-tier backend.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { attempts = 3, timeoutMs = COLD_START_TIMEOUT_MS }: { attempts?: number; timeoutMs?: number } = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      // 502/503/504 are classic "backend still waking" responses - retry them.
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        lastError = new Error(`Server waking (HTTP ${response.status})`);
      } else {
        return response;
      }
    } catch (error) {
      // TypeError "Failed to fetch" or an AbortError (timeout) - both retryable.
      lastError = error;
    }

    // Backoff before the next attempt (skip the wait after the final attempt).
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

// Storage keys
const AUTH_KEYS = {
  ACCESS_TOKEN: 'focustab_access_token',
  USER_ID: 'focustab_user_id',
  USER_EMAIL: 'focustab_user_email',
} as const;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  birthDate?: string;
  lifeExpectancy?: number;
  enableRecommendations?: boolean;
  onboardingCompleted?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Check if running in Chrome extension context with identity API
 */
export function isExtensionWithIdentity(): boolean {
  return typeof chrome !== 'undefined' &&
         chrome?.identity !== undefined &&
         typeof chrome.identity.getProfileUserInfo === 'function';
}

/**
 * Get Google account info from Chrome Identity API
 * Returns null if not in extension context or user not signed in
 */
export async function getChromeIdentity(): Promise<{ email: string; id: string } | null> {
  if (!isExtensionWithIdentity()) {
    console.log('Not in Chrome extension context with identity API');
    return null;
  }

  return new Promise((resolve) => {
    chrome!.identity!.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      if (chrome?.runtime?.lastError) {
        console.error('Chrome identity error:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      if (userInfo.email && userInfo.id) {
        resolve(userInfo);
      } else {
        console.log('No Chrome user signed in');
        resolve(null);
      }
    });
  });
}

/**
 * Authenticate with backend using Google identity
 * Creates account if doesn't exist, returns existing if it does
 */
export async function authenticateWithGoogle(
  googleEmail: string,
  googleId: string,
  profileData?: { name?: string; birthDate?: string; lifeExpectancy?: number; enableRecommendations?: boolean }
): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
  const response = await fetchWithRetry(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleEmail,
      googleId,
      ...profileData,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Authentication failed' }));
    throw new Error(error.error || 'Authentication failed');
  }

  const data = await response.json();

  // Store credentials
  await storage.set(AUTH_KEYS.ACCESS_TOKEN, data.token);
  await storage.set(AUTH_KEYS.USER_ID, data.user.id);
  await storage.set(AUTH_KEYS.USER_EMAIL, data.user.email);

  return {
    user: data.user,
    token: data.token,
    isNewUser: data.isNewUser ?? false,
  };
}

/**
 * Get stored authentication state
 */
export async function getStoredAuth(): Promise<{ token: string; userId: string; email: string } | null> {
  const token = await storage.get<string>(AUTH_KEYS.ACCESS_TOKEN);
  const userId = await storage.get<string>(AUTH_KEYS.USER_ID);
  const email = await storage.get<string>(AUTH_KEYS.USER_EMAIL);

  if (token && userId && email) {
    return { token, userId, email };
  }
  return null;
}

/**
 * Clear stored authentication
 */
export async function clearAuth(): Promise<void> {
  await storage.remove(AUTH_KEYS.ACCESS_TOKEN);
  await storage.remove(AUTH_KEYS.USER_ID);
  await storage.remove(AUTH_KEYS.USER_EMAIL);
}

/**
 * Verify token is still valid with backend.
 * Distinguishes "server rejected the token" (invalid) from "couldn't reach
 * the server" (network error / cold start) - the caller must NOT log the
 * user out for a transient network failure.
 */
export type TokenVerification =
  | { status: 'valid'; user: AuthUser }
  | { status: 'invalid' }
  | { status: 'network-error' };

export async function verifyToken(token: string): Promise<TokenVerification> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { status: 'invalid' };
    }

    if (!response.ok) {
      // 5xx etc - server problem, not a bad token
      return { status: 'network-error' };
    }

    const data = await response.json();
    return { status: 'valid', user: data.user };
  } catch (error) {
    console.error('Token verification failed (network):', error);
    return { status: 'network-error' };
  }
}

/**
 * Update user profile on backend
 */
export async function updateProfile(
  token: string,
  updates: { name?: string; birthDate?: string; lifeExpectancy?: number; enableRecommendations?: boolean }
): Promise<AuthUser> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }

  const data = await response.json();
  return data.user;
}

/**
 * Make authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const storedAuth = await getStoredAuth();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (storedAuth?.token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${storedAuth.token}`;
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired, clear auth
    await clearAuth();
    throw new Error('Session expired, please sign in again');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

/**
 * Initialize authentication
 * Attempts to restore session or authenticate with Chrome identity
 */
export async function initializeAuth(): Promise<AuthState> {
  try {
    // Check for stored credentials
    const storedAuth = await getStoredAuth();

    if (storedAuth) {
      // Verify token is still valid
      const verification = await verifyToken(storedAuth.token);

      if (verification.status === 'valid') {
        return {
          isAuthenticated: true,
          user: verification.user,
          token: storedAuth.token,
          isLoading: false,
          error: null,
        };
      }

      if (verification.status === 'network-error') {
        // Server unreachable (e.g. cold start) - KEEP the token and let the
        // app run from local cache. Do not log the user out.
        return {
          isAuthenticated: false,
          user: null,
          token: storedAuth.token,
          isLoading: false,
          error: 'offline',
        };
      }

      // Token genuinely rejected by the server - clear it
      await clearAuth();
    }

    // Try Chrome identity
    const chromeIdentity = await getChromeIdentity();
    if (chromeIdentity) {
      // We have Chrome identity but no valid token
      // User needs to complete onboarding to create account
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: null,
      };
    }

    // Not authenticated
    return {
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}
