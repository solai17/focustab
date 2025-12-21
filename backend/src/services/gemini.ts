/**
 * Gemini AI Service for ByteLetters
 *
 * Uses Google Gemini Flash 2.0 for byte extraction
 * FREE tier: 1,500 requests/day, 10 RPM
 *
 * Setup:
 *   1. Get free API key: https://aistudio.google.com/apikey
 *   2. Add to .env: GEMINI_API_KEY=your_key
 */

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY;
const gemini = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
}

// Base prompt for byte extraction only
const BYTE_EXTRACTION_PROMPT = `You are a master curator extracting transformative insights from newsletters.

Extract 3-7 "bytes" - bite-sized pieces of wisdom that make someone stop and think.

BYTE TYPES (pick the most fitting):
- quote: A memorable statement worth remembering (requires author)
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

Return ONLY valid JSON (no markdown, no code blocks):
{
  "bytes": [
    {
      "content": "The actual insight text...",
      "type": "insight",
      "author": "Author Name or null",
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
- quote: A memorable statement worth remembering (requires author)
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
      "author": "Author Name or null",
      "context": "Brief context (2-4 words)",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health|general",
      "qualityScore": 0.85
    }
  ]
}

NEWSLETTER CONTENT:
`;

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
  return gemini !== null;
}

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
    return { bytes: [] };
  }

  try {
    // Use Gemini 3 Flash for best quality (outperforms 2.5 Pro!)
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash';

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
      return { bytes: [] };
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

    console.log(`[Gemini] Extracted ${validBytes.length} bytes from ${newsletterSource}`);

    // Build result
    const result: ExtractionResult = { bytes: validBytes };

    // Add newsletter info if extracted
    if (extractSourceInfo && parsed.newsletterInfo) {
      result.newsletterInfo = {
        name: parsed.newsletterInfo.name || newsletterSource,
        website: parsed.newsletterInfo.website || null,
      };
      console.log(`[Gemini] Extracted source info: ${result.newsletterInfo.name}, website: ${result.newsletterInfo.website || 'not found'}`);
    }

    return result;
  } catch (error) {
    console.error('[Gemini] Extraction error:', error);
    return { bytes: [] };
  }
}

/**
 * Generate newsletter summary using Gemini
 */
export async function summarizeWithGemini(
  content: string,
  maxLength: number = 200
): Promise<string | null> {
  if (!gemini) {
    return null;
  }

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Summarize this newsletter in ${maxLength} characters or less. Focus on the main insights and takeaways. Be concise but informative.\n\nContent:\n${content.substring(0, 10000)}`,
    });

    return response.text?.substring(0, maxLength) || null;
  } catch (error) {
    console.error('[Gemini] Summary error:', error);
    return null;
  }
}
