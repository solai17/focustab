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
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  inboxEmail: string;
  birthDate?: string;
  lifeExpectancy?: number;
  enableRecommendations?: boolean;
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
): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
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
    const error = await response.json();
    throw new Error(error.error || 'Authentication failed');
  }

  const data = await response.json();

  // Store credentials
  await storage.set(AUTH_KEYS.ACCESS_TOKEN, data.token);
  await storage.set(AUTH_KEYS.USER_ID, data.user.id);
  await storage.set(AUTH_KEYS.USER_EMAIL, data.user.email);

  return data;
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
 * Verify token is still valid with backend
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Update user profile on backend
 */
export async function updateProfile(
  token: string,
  updates: { name?: string; birthDate?: string; lifeExpectancy?: number; enableRecommendations?: boolean }
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
      const user = await verifyToken(storedAuth.token);
      if (user) {
        return {
          isAuthenticated: true,
          user,
          token: storedAuth.token,
          isLoading: false,
          error: null,
        };
      }
      // Token invalid, clear it
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
