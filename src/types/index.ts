export interface UserProfile {
  name: string;
  birthDate: string; // ISO date string
  lifeExpectancy: number;
  inboxEmail?: string;
  createdAt: string;
}

export interface Inspiration {
  id: string;
  quote: string;
  author: string;
  source: string; // newsletter name
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

export interface AppSettings {
  showMortalityBar: boolean;
  lifeExpectancy: number;
  theme: 'dark' | 'light';
}
