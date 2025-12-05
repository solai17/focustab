import { v4 as uuidv4 } from 'uuid';

const INBOX_DOMAIN = process.env.INBOX_DOMAIN || 'focustab.app';

/**
 * Generate a unique inbox email address for a user
 */
export function generateInboxEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  const random = uuidv4().split('-')[0]; // First segment of UUID
  return `${slug}-${random}@${INBOX_DOMAIN}`;
}

/**
 * Calculate the number of Sundays remaining in a person's life
 */
export function calculateSundaysRemaining(
  birthDate: Date,
  lifeExpectancy: number = 80
): number {
  const now = new Date();
  const deathDate = new Date(birthDate);
  deathDate.setFullYear(deathDate.getFullYear() + lifeExpectancy);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((deathDate.getTime() - now.getTime()) / msPerWeek));
}

/**
 * Calculate the percentage of life already lived
 */
export function calculatePercentLived(
  birthDate: Date,
  lifeExpectancy: number = 80
): number {
  const now = new Date();
  const deathDate = new Date(birthDate);
  deathDate.setFullYear(deathDate.getFullYear() + lifeExpectancy);

  const totalLife = deathDate.getTime() - birthDate.getTime();
  const lived = now.getTime() - birthDate.getTime();

  return Math.min(100, Math.max(0, (lived / totalLife) * 100));
}

/**
 * Extract plain text from HTML content
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Verify Mailgun webhook signature
 */
export function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string
): boolean {
  const crypto = require('crypto');
  const encodedToken = crypto
    .createHmac('sha256', signingKey)
    .update(timestamp + token)
    .digest('hex');
  return encodedToken === signature;
}

/**
 * Extract sender name from email "From" header
 */
export function extractSenderName(from: string): string {
  // Format: "Name <email@domain.com>" or just "email@domain.com"
  const match = from.match(/^"?([^"<]+)"?\s*<?/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return from.split('@')[0];
}
