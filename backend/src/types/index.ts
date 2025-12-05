import { Request } from 'express';

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
}

export interface LoginInput {
  email: string;
  password: string;
}

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

export interface ProcessedNewsletter {
  inspirations: Array<{
    quote: string;
    author: string;
  }>;
  summary: string;
  keyInsight: string;
  readTimeMinutes: number;
}

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
