/**
 * Gemini AI Service for ByteLetters
 *
 * Uses Google Gemini 3 Flash for highest quality byte extraction
 * FREE tier: 20 requests/day for gemini-3-flash-preview
 *
 * Setup:
 *   1. Get free API key: https://aistudio.google.com/apikey
 *   2. Add to .env: GEMINI_API_KEY=your_key
 */

import { GoogleGenAI } from '@google/genai';
import { prisma } from './db';

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY;
const gemini = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Daily request limit for Gemini 3 Flash
const GEMINI_DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT || '20', 10);

export interface ExtractedByte {
  content: string;
  type: 'quote' | 'insight' | 'statistic' | 'action' | 'takeaway' | 'mental_model' | 'counterintuitive';
  author: string | null;
  context: string | null;
  category: string;
  qualityScore: number;
}

export interface NewsletterInfo {
  name: string;       // Clean newsletter name (e.g., "James Clear" not "newsletter@jamesclear.com")
  website: string | null;  // Newsletter subscription URL (null if not found)
}

export interface ExtractionResult {
  bytes: ExtractedByte[];
  newsletterInfo?: NewsletterInfo;
  modelUsed?: string; // Track which model processed this
  quotaExceeded?: boolean; // True if daily quota was exceeded
}

// In-memory daily counter (resets on server restart)
// For production, this should be stored in Redis or database
let dailyRequestCount = 0;
let lastResetDate = new Date().toDateString();

/**
 * Check and update daily request counter
 * Returns true if we can make a request, false if quota exceeded
 */
function checkAndIncrementQuota(): boolean {
  const today = new Date().toDateString();

  // Reset counter if it's a new day
  if (today !== lastResetDate) {
    dailyRequestCount = 0;
    lastResetDate = today;
    console.log('[Gemini] Daily quota reset');
  }

  // Check if we're under the limit
  if (dailyRequestCount >= GEMINI_DAILY_LIMIT) {
    console.log(`[Gemini] Daily quota exceeded (${dailyRequestCount}/${GEMINI_DAILY_LIMIT})`);
    return false;
  }

  // Increment counter
  dailyRequestCount++;
  console.log(`[Gemini] Request ${dailyRequestCount}/${GEMINI_DAILY_LIMIT} for today`);
  return true;
}

/**
 * Get current quota status
 */
export function getGeminiQuotaStatus(): { used: number; limit: number; remaining: number } {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    return { used: 0, limit: GEMINI_DAILY_LIMIT, remaining: GEMINI_DAILY_LIMIT };
  }
  return {
    used: dailyRequestCount,
    limit: GEMINI_DAILY_LIMIT,
    remaining: Math.max(0, GEMINI_DAILY_LIMIT - dailyRequestCount),
  };
}

/**
 * Check if Gemini is available (has API key AND quota remaining)
 */
export function isGeminiAvailable(): boolean {
  if (!gemini) return false;

  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    return true; // New day, quota reset
  }

  return dailyRequestCount < GEMINI_DAILY_LIMIT;
}

// Base prompt for byte extraction only
const BYTE_EXTRACTION_PROMPT = `You are a master curator extracting transformative insights from newsletters.

Extract 3-7 "bytes" - bite-sized pieces of wisdom that make someone stop and think.

BYTE TYPES (pick the most fitting):
- quote: A memorable statement worth remembering (requires KNOWN author like "Marcus Aurelius", "Warren Buffett")
- insight: A non-obvious truth that shifts perspective
- statistic: A number that changes how you see something
- action: A specific thing you can do TODAY
- takeaway: A key lesson or principle
- mental_model: A framework for thinking about problems
- counterintuitive: Something that goes against common wisdom

REQUIREMENTS:
- Each byte: 1-4 sentences, max 100 words (readable in 20-30 seconds)
- Must be self-contained (understandable without the full newsletter)
- Focus on timeless wisdom, not dated news/facts
- Quality over quantity - only extract truly valuable insights

AUTHOR ATTRIBUTION RULES (VERY IMPORTANT):
- For direct quotes from KNOWN people (authors, philosophers, business leaders), use their full name
- NEVER use vague terms as author: "somebody", "someone", "a friend", "my mentor", "a wise person", etc.
- If the original author is unknown or vague, set author to null
- For the newsletter author's own insights, set author to null (not the newsletter name)
- When in doubt, use null - we will attribute to the newsletter source automatically

Return ONLY valid JSON (no markdown, no code blocks):
{
  "bytes": [
    {
      "content": "The actual insight text...",
      "type": "insight",
      "author": "Full Name of Known Person or null",
      "context": "Brief context (2-4 words)",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health|general",
      "qualityScore": 0.85
    }
  ]
}

NEWSLETTER CONTENT:
`;

// Extended prompt that also extracts newsletter info (used only for NEW sources)
const BYTE_EXTRACTION_WITH_SOURCE_INFO_PROMPT = `You are a master curator extracting transformative insights from newsletters.

TASK 1: Extract 3-7 "bytes" - bite-sized pieces of wisdom that make someone stop and think.

BYTE TYPES:
- quote: A memorable statement worth remembering (requires KNOWN author like "Marcus Aurelius", "Warren Buffett")
- insight: A non-obvious truth that shifts perspective
- statistic: A number that changes how you see something
- action: A specific thing you can do TODAY
- takeaway: A key lesson or principle
- mental_model: A framework for thinking about problems
- counterintuitive: Something that goes against common wisdom

BYTE REQUIREMENTS:
- Each byte: 1-4 sentences, max 100 words (readable in 20-30 seconds)
- Must be self-contained (understandable without the full newsletter)
- Focus on timeless wisdom, not dated news/facts
- Quality over quantity - only extract truly valuable insights

AUTHOR ATTRIBUTION RULES (VERY IMPORTANT):
- For direct quotes from KNOWN people (authors, philosophers, business leaders), use their full name
- NEVER use vague terms as author: "somebody", "someone", "a friend", "my mentor", "a wise person", etc.
- If the original author is unknown or vague, set author to null
- For the newsletter author's own insights, set author to null (not the newsletter name)
- When in doubt, use null - we will attribute to the newsletter source automatically

TASK 2: Identify the newsletter source information.

NEWSLETTER INFO REQUIREMENTS:
- name: The clean, human-readable newsletter name (e.g., "James Clear", "Morning Brew", "Lenny's Newsletter")
  - NOT the email address or domain
  - Look for branding, headers, author name, or signature
- website: The URL where people can subscribe to this newsletter (e.g., "https://jamesclear.com/newsletter")
  - Look for links in the email header, footer, or signature
  - Common patterns: "Subscribe at...", "Visit...", links with the author/brand name
  - If hosted on Substack, use the Substack URL (e.g., "https://lenny.substack.com")
  - Return null if you cannot find a reliable URL

Return ONLY valid JSON (no markdown, no code blocks):
{
  "newsletterInfo": {
    "name": "Newsletter Name",
    "website": "https://example.com/subscribe" or null
  },
  "bytes": [
    {
      "content": "The actual insight text...",
      "type": "insight",
      "author": "Full Name of Known Person or null",
      "context": "Brief context (2-4 words)",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health|general",
      "qualityScore": 0.85
    }
  ]
}

NEWSLETTER CONTENT:
`;

/**
 * Extract bytes from newsletter content using Gemini
 * @param content - The newsletter content
 * @param newsletterSource - The name of the newsletter source
 * @param extractSourceInfo - If true, also extracts newsletter name and website (use for NEW sources only)
 */
export async function extractBytesWithGemini(
  content: string,
  newsletterSource: string,
  extractSourceInfo: boolean = false
): Promise<ExtractionResult> {
  if (!gemini) {
    console.warn('[Gemini] API key not configured, skipping');
    return { bytes: [], quotaExceeded: false };
  }

  // Check daily quota before making request
  if (!checkAndIncrementQuota()) {
    return { bytes: [], quotaExceeded: true, modelUsed: 'gemini-quota-exceeded' };
  }

  try {
    // Use Gemini 3 Flash Preview for highest quality
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

    // Use extended prompt if we need to extract source info
    const prompt = extractSourceInfo
      ? BYTE_EXTRACTION_WITH_SOURCE_INFO_PROMPT
      : BYTE_EXTRACTION_PROMPT;

    const response = await gemini.models.generateContent({
      model,
      contents: prompt + content.substring(0, 15000),
    });

    const responseText = response.text || '';

    // Parse JSON from response
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // Find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      console.error('[Gemini] Could not parse JSON from response');
      return { bytes: [], modelUsed: model };
    }

    const parsed = JSON.parse(objectMatch[0]);

    // Validate and filter bytes
    const validBytes: ExtractedByte[] = (parsed.bytes || [])
      .filter((byte: any) => {
        const len = byte.content?.length || 0;
        return (
          byte.content &&
          len >= 30 &&
          len <= 500 &&
          (byte.qualityScore || 0.65) >= 0.65
        );
      })
      .map((byte: any) => ({
        content: byte.content.trim(),
        type: byte.type || 'insight',
        author: byte.author || null,
        context: byte.context || null,
        category: byte.category || 'general',
        qualityScore: Math.min(1, Math.max(0, byte.qualityScore || 0.7)),
      }));

    console.log(`[Gemini] Extracted ${validBytes.length} bytes from ${newsletterSource} using ${model}`);

    // Build result with model tracking
    const result: ExtractionResult = { bytes: validBytes, modelUsed: model };

    // Add newsletter info if extracted
    if (extractSourceInfo && parsed.newsletterInfo) {
      result.newsletterInfo = {
        name: parsed.newsletterInfo.name || newsletterSource,
        website: parsed.newsletterInfo.website || null,
      };
      console.log(`[Gemini] Extracted source info: ${result.newsletterInfo.name}, website: ${result.newsletterInfo.website || 'not found'}`);
    }

    return result;
  } catch (error: any) {
    // Check if it's a rate limit error
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.error('[Gemini] Rate limit hit, marking quota as exceeded');
      // Set daily count to max to prevent further attempts today
      dailyRequestCount = GEMINI_DAILY_LIMIT;
      return { bytes: [], quotaExceeded: true, modelUsed: 'gemini-rate-limited' };
    }

    console.error('[Gemini] Extraction error:', error);
    return { bytes: [], modelUsed: 'gemini-error' };
  }
}

/**
 * Generate newsletter summary using Gemini
 */
export async function summarizeWithGemini(
  content: string,
  maxLength: number = 200
): Promise<string | null> {
  if (!gemini || !isGeminiAvailable()) {
    return null;
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

    const response = await gemini.models.generateContent({
      model,
      contents: `Summarize this newsletter in ${maxLength} characters or less. Focus on the main insights and takeaways. Be concise but informative.\n\nContent:\n${content.substring(0, 10000)}`,
    });

    return response.text?.substring(0, maxLength) || null;
  } catch (error) {
    console.error('[Gemini] Summary error:', error);
    return null;
  }
}
