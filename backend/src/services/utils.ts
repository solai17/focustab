import prisma from './db';

const INBOX_DOMAIN = process.env.INBOX_DOMAIN || 'inbox.byteletters.app';

/**
 * Generate a short alphanumeric code (e.g., "7k", "42", "x3")
 */
function generateShortCode(length: number = 2): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // Removed confusing chars: 0,1,i,l,o
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Sanitize username for email: lowercase, alphanumeric, max 15 chars
 */
function sanitizeUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15) || 'user';
}

/**
 * Generate a unique inbox email address for a user
 * Format: username-shortcode@inbox.byteletters.app
 * Examples: james-7k@inbox.byteletters.app, solai-42@inbox.byteletters.app
 */
export async function generateInboxEmail(name: string): Promise<string> {
  const username = sanitizeUsername(name);
  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // First attempt: try just username (cleanest)
    // Subsequent attempts: add progressively longer codes
    let email: string;

    if (attempt === 0) {
      // Try just username first (e.g., "james@inbox.byteletters.app")
      email = `${username}@${INBOX_DOMAIN}`;
    } else if (attempt <= 3) {
      // Try with 2-char code (e.g., "james-7k@inbox.byteletters.app")
      const code = generateShortCode(2);
      email = `${username}-${code}@${INBOX_DOMAIN}`;
    } else {
      // Try with 3-char code for more uniqueness (e.g., "james-x7k@inbox.byteletters.app")
      const code = generateShortCode(3);
      email = `${username}-${code}@${INBOX_DOMAIN}`;
    }

    // Check if email already exists
    const existing = await prisma.user.findFirst({
      where: { inboxEmail: email }
    });

    if (!existing) {
      return email;
    }
  }

  // Final fallback: username + timestamp suffix
  const timestamp = Date.now().toString(36).slice(-4);
  return `${username}-${timestamp}@${INBOX_DOMAIN}`;
}

/**
 * Synchronous version for backwards compatibility (uses random, no collision check)
 * @deprecated Use generateInboxEmail instead
 */
export function generateInboxEmailSync(name: string): string {
  const username = sanitizeUsername(name);
  const code = generateShortCode(2);
  return `${username}-${code}@${INBOX_DOMAIN}`;
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
