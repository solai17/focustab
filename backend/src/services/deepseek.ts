/**
 * DeepSeek AI Service for ByteLetters
 *
 * Uses DeepSeek V3 as secondary model after Gemini quota is exhausted.
 * FREE tier: 5 million tokens for new users (valid 30 days), no rate limits
 *
 * Setup:
 *   1. Get API key: https://platform.deepseek.com/
 *   2. Add to .env: DEEPSEEK_API_KEY=your_key
 *
 * Pricing (very cheap):
 *   - Input: $0.028 per million tokens (cache hit)
 *   - Output: $0.42 per million tokens
 */

import { ExtractedByte } from './gemini';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const apiKey = process.env.DEEPSEEK_API_KEY;

export interface DeepSeekExtractionResult {
  bytes: ExtractedByte[];
  modelUsed: string;
}

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
}`;

/**
 * Check if DeepSeek is available
 */
export function isDeepSeekAvailable(): boolean {
  return !!apiKey;
}

/**
 * Extract bytes using DeepSeek V3
 */
export async function extractBytesWithDeepSeek(
  content: string,
  newsletterSource: string
): Promise<DeepSeekExtractionResult> {
  if (!apiKey) {
    console.warn('[DeepSeek] API key not configured, skipping');
    return { bytes: [], modelUsed: 'deepseek-unavailable' };
  }

  try {
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    console.log(`[DeepSeek] Processing: ${newsletterSource} using ${model}`);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: BYTE_EXTRACTION_PROMPT,
          },
          {
            role: 'user',
            content: `Newsletter: ${newsletterSource}\n\nContent:\n${content.substring(0, 15000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

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
      console.error('[DeepSeek] Could not parse JSON from response');
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

    console.log(`[DeepSeek] Extracted ${validBytes.length} bytes from ${newsletterSource}`);

    return { bytes: validBytes, modelUsed: model };
  } catch (error) {
    console.error('[DeepSeek] Extraction error:', error);
    return { bytes: [], modelUsed: 'deepseek-error' };
  }
}
