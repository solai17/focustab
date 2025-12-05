/**
 * FocusTab API Client
 * 
 * This file should be added to your Chrome extension (Phase 1)
 * to connect it to the backend API (Phase 2).
 * 
 * Replace the existing storage-based approach with API calls.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Token storage
const TOKEN_KEY = 'focustab_auth_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'API request failed');
  }
  
  return response.json();
}

// ============================================
// AUTH API
// ============================================

export interface SignupData {
  email: string;
  password: string;
  name: string;
  birthDate: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    birthDate: string;
    lifeExpectancy: number;
    inboxEmail: string;
  };
}

export const authApi = {
  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(response.token);
    return response;
  },
  
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(response.token);
    return response;
  },
  
  async getProfile(): Promise<{ user: AuthResponse['user'] }> {
    return apiRequest('/auth/me');
  },
  
  async updateProfile(data: Partial<{ name: string; birthDate: string; lifeExpectancy: number }>): Promise<{ user: AuthResponse['user'] }> {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  logout(): void {
    clearToken();
  },
  
  isAuthenticated(): boolean {
    return !!getToken();
  },
};

// ============================================
// CONTENT API
// ============================================

export interface Inspiration {
  id: string;
  quote: string;
  author: string | null;
  source: string;
  category: string;
}

export interface Newsletter {
  id: string;
  subject: string;
  senderName: string | null;
  summary: string | null;
  keyInsight: string | null;
  readTimeMinutes: number | null;
  receivedAt: string;
  isRead: boolean;
}

export interface DailyContent {
  inspiration: Inspiration | null;
  newsletters: Newsletter[];
  stats: {
    sundaysRemaining: number;
    percentLived: number;
  };
}

export const contentApi = {
  async getDailyContent(): Promise<DailyContent> {
    return apiRequest('/content/today');
  },
  
  async refreshInspiration(): Promise<{ inspiration: Inspiration | null }> {
    return apiRequest('/content/inspiration/refresh');
  },
  
  async getNewsletters(unreadOnly = false): Promise<{ newsletters: Newsletter[] }> {
    const query = unreadOnly ? '?unreadOnly=true' : '';
    return apiRequest(`/content/newsletters${query}`);
  },
  
  async getNewsletter(id: string): Promise<{ newsletter: Newsletter & { rawContent: string; textContent: string } }> {
    return apiRequest(`/content/newsletter/${id}`);
  },
  
  async markAsRead(id: string): Promise<{ success: boolean }> {
    return apiRequest(`/content/newsletter/${id}/read`, { method: 'POST' });
  },
  
  async getStats(): Promise<{
    stats: {
      sundaysRemaining: number;
      percentLived: number;
      totalNewsletters: number;
      totalInspirations: number;
      unreadNewsletters: number;
    };
  }> {
    return apiRequest('/content/stats');
  },
};

// ============================================
// USAGE EXAMPLE
// ============================================

/*
// In your React component:

import { authApi, contentApi } from './api';

// Sign up
const { user } = await authApi.signup({
  email: 'user@example.com',
  password: 'password123',
  name: 'John',
  birthDate: '1990-01-15',
});
console.log('Inbox email:', user.inboxEmail);

// Login
await authApi.login({ email: 'user@example.com', password: 'password123' });

// Get daily content
const content = await contentApi.getDailyContent();
console.log('Sundays left:', content.stats.sundaysRemaining);
console.log('Today\'s inspiration:', content.inspiration?.quote);

// Refresh inspiration
const { inspiration } = await contentApi.refreshInspiration();

// Mark newsletter as read
await contentApi.markAsRead('newsletter-id');

// Logout
authApi.logout();
*/
