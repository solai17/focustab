/**
 * Robust JSON Parser for AI Responses
 *
 * Handles common issues with AI-generated JSON:
 * - Markdown code blocks (```json ... ```)
 * - Missing closing backticks
 * - Extra whitespace
 * - Multiple JSON objects in response
 */

/**
 * Extract and parse JSON from AI response text
 * Handles markdown code blocks and various edge cases
 */
export function parseAIResponse<T = any>(responseText: string): T | null {
  if (!responseText || typeof responseText !== 'string') {
    console.error('[JSONParser] Empty or invalid response');
    return null;
  }

  let jsonStr = responseText.trim();

  // Strategy 1: Try to extract from markdown code block
  // Handle various code block formats: ```json, ```, ```JSON, etc.
  const codeBlockPatterns = [
    /```json\s*([\s\S]*?)```/i,           // ```json ... ```
    /```\s*([\s\S]*?)```/,                 // ``` ... ```
    /```json\s*([\s\S]*)$/i,               // ```json ... (no closing)
    /```\s*([\s\S]*)$/,                    // ``` ... (no closing)
  ];

  for (const pattern of codeBlockPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Verify it looks like JSON (starts with { or [)
      if (extracted.startsWith('{') || extracted.startsWith('[')) {
        jsonStr = extracted;
        break;
      }
    }
  }

  // Strategy 2: If still has backticks, strip them aggressively
  if (jsonStr.includes('```')) {
    jsonStr = jsonStr
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  // Strategy 3: Find the JSON object/array in the string
  // Look for the outermost { } or [ ]
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  const jsonArrayMatch = jsonStr.match(/\[[\s\S]*\]/);

  // Prefer object match if both exist and object comes first
  if (jsonObjectMatch && jsonArrayMatch) {
    const objectIndex = jsonStr.indexOf(jsonObjectMatch[0]);
    const arrayIndex = jsonStr.indexOf(jsonArrayMatch[0]);
    jsonStr = objectIndex <= arrayIndex ? jsonObjectMatch[0] : jsonArrayMatch[0];
  } else if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0];
  } else if (jsonArrayMatch) {
    jsonStr = jsonArrayMatch[0];
  }

  // Strategy 4: Clean up common issues
  jsonStr = jsonStr
    .replace(/,\s*}/g, '}')      // Remove trailing commas in objects
    .replace(/,\s*]/g, ']')      // Remove trailing commas in arrays
    .replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control characters

  // Try to parse
  try {
    return JSON.parse(jsonStr) as T;
  } catch (firstError) {
    // Strategy 5: Try to fix common JSON syntax errors
    try {
      // Sometimes AI adds comments - remove them
      const noComments = jsonStr
        .replace(/\/\/[^\n]*/g, '')  // Remove // comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments

      return JSON.parse(noComments) as T;
    } catch (secondError) {
      // Log detailed error for debugging
      console.error('[JSONParser] Failed to parse JSON');
      console.error('[JSONParser] Original length:', responseText.length);
      console.error('[JSONParser] Cleaned length:', jsonStr.length);
      console.error('[JSONParser] First 200 chars:', jsonStr.substring(0, 200));
      console.error('[JSONParser] Last 200 chars:', jsonStr.substring(jsonStr.length - 200));
      console.error('[JSONParser] Error:', secondError);

      return null;
    }
  }
}

/**
 * Validate extracted bytes from AI response
 */
export interface RawByte {
  content?: string;
  type?: string;
  author?: string | null;
  context?: string | null;
  category?: string;
  qualityScore?: number;
}

export interface ValidatedByte {
  content: string;
  type: string;
  author: string | null;
  context: string | null;
  category: string;
  qualityScore: number;
}

export function validateBytes(rawBytes: RawByte[]): ValidatedByte[] {
  if (!Array.isArray(rawBytes)) {
    return [];
  }

  return rawBytes
    .filter((byte): byte is RawByte & { content: string } => {
      if (!byte || typeof byte.content !== 'string') return false;
      const len = byte.content.length;
      const score = byte.qualityScore ?? 0.65;
      return len >= 30 && len <= 500 && score >= 0.65;
    })
    .map((byte) => ({
      content: byte.content.trim(),
      type: byte.type || 'insight',
      author: byte.author || null,
      context: byte.context || null,
      category: byte.category || 'general',
      qualityScore: Math.min(1, Math.max(0, byte.qualityScore || 0.7)),
    }));
}
