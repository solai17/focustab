import Anthropic from '@anthropic-ai/sdk';
import { ProcessedNewsletter, ProcessedEdition, ExtractedByte, ByteType, ByteCategory } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// v2.0 CONTENT BYTE EXTRACTION
// =============================================================================

const BYTE_EXTRACTION_PROMPT = `You are a content curator extracting bite-sized wisdom from newsletters. Your goal is to find the "gold nuggets" - pieces that would make someone stop scrolling and think.

Analyze the newsletter and extract multiple ContentBytes. Return a JSON object:

{
  "summary": "A compelling 2-3 sentence summary of the newsletter",
  "readTimeMinutes": 5,
  "bytes": [
    {
      "content": "The actual quote, insight, or takeaway (1-3 sentences max)",
      "type": "quote|insight|statistic|action|takeaway",
      "author": "Original author if quoted, otherwise null",
      "context": "Brief context (10 words max) e.g., 'on productivity' or 'about startup hiring'",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health|general",
      "qualityScore": 0.85
    }
  ]
}

BYTE TYPES:
- quote: A quotable passage from someone (needs author)
- insight: A non-obvious observation or idea
- statistic: A surprising data point or number
- action: A specific actionable tip
- takeaway: A key lesson or conclusion

QUALITY GUIDELINES:
- qualityScore 0.9+: Would go viral on Twitter, universally valuable
- qualityScore 0.7-0.9: Great content, valuable to most readers
- qualityScore 0.5-0.7: Good but niche or requires context
- qualityScore <0.5: Skip these, not worth extracting

EXTRACTION RULES:
1. Extract 3-8 bytes per newsletter (quality over quantity)
2. Each byte must stand ALONE without needing the full article
3. Prefer timeless wisdom over time-sensitive news
4. Include attribution when quoting others
5. Make content snappy - if it needs too much context, skip it
6. Vary the types - don't just extract quotes

Return ONLY valid JSON, no markdown or explanation.`;

export async function processEditionWithClaude(
  subject: string,
  textContent: string,
  sourceName: string
): Promise<ProcessedEdition> {
  try {
    // Truncate content if too long
    const truncatedContent = textContent.slice(0, 20000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `${BYTE_EXTRACTION_PROMPT}

Newsletter: ${sourceName}
Subject: ${subject}

Content:
${truncatedContent}`,
        },
      ],
    });

    // Extract text content from response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    // Validate and clean up bytes
    const validBytes: ExtractedByte[] = (parsed.bytes || [])
      .filter((byte: any) => {
        // Must have content and reasonable quality
        return byte.content && byte.content.length > 20 && (byte.qualityScore || 0.5) >= 0.5;
      })
      .map((byte: any) => ({
        content: byte.content.trim(),
        type: validateByteType(byte.type),
        author: byte.author || null,
        context: byte.context || null,
        category: validateByteCategory(byte.category),
        qualityScore: Math.min(1, Math.max(0, byte.qualityScore || 0.5)),
      }));

    return {
      summary: parsed.summary || 'Newsletter content processed.',
      readTimeMinutes:
        parsed.readTimeMinutes || Math.ceil(textContent.split(/\s+/).length / 200),
      bytes: validBytes,
    };
  } catch (error) {
    console.error('Error processing edition with Claude:', error);

    // Return minimal defaults on error
    return {
      summary: 'Failed to process newsletter content.',
      readTimeMinutes: Math.ceil(textContent.split(/\s+/).length / 200),
      bytes: [],
    };
  }
}

function validateByteType(type: string): ByteType {
  const validTypes: ByteType[] = ['quote', 'insight', 'statistic', 'action', 'takeaway'];
  return validTypes.includes(type as ByteType) ? (type as ByteType) : 'insight';
}

function validateByteCategory(category: string): ByteCategory {
  const validCategories: ByteCategory[] = [
    'wisdom',
    'productivity',
    'business',
    'tech',
    'life',
    'creativity',
    'leadership',
    'finance',
    'health',
    'general',
  ];
  return validCategories.includes(category as ByteCategory)
    ? (category as ByteCategory)
    : 'general';
}

// =============================================================================
// NEWSLETTER SOURCE CATEGORIZATION
// =============================================================================

const CATEGORIZE_SOURCE_PROMPT = `Analyze this newsletter and provide a brief categorization. Return JSON:

{
  "description": "A 1-sentence description of what this newsletter covers",
  "category": "tech|business|productivity|wisdom|life|creativity|leadership|finance|health|general",
  "tags": ["tag1", "tag2", "tag3"]
}

Be concise. Tags should be 1-2 words each. Return ONLY JSON.`;

export async function categorizeNewsletterSource(
  name: string,
  sampleContent: string
): Promise<{ description: string; category: ByteCategory; tags: string[] }> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `${CATEGORIZE_SOURCE_PROMPT}

Newsletter Name: ${name}
Sample Content (first 2000 chars):
${sampleContent.slice(0, 2000)}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(responseText);

    return {
      description: parsed.description || `Newsletter from ${name}`,
      category: validateByteCategory(parsed.category),
      tags: (parsed.tags || []).slice(0, 5),
    };
  } catch (error) {
    console.error('Error categorizing source:', error);
    return {
      description: `Newsletter from ${name}`,
      category: 'general',
      tags: [],
    };
  }
}

// =============================================================================
// LEGACY SUPPORT (for backward compatibility)
// =============================================================================

const LEGACY_PROCESSING_PROMPT = `You are processing a newsletter email to extract valuable content. Analyze the newsletter and return a JSON object with the following structure:

{
  "inspirations": [
    {
      "quote": "An insightful, quotable passage from the newsletter (1-3 sentences max)",
      "author": "The author's name or 'Unknown' if not clear"
    }
  ],
  "summary": "A 2-3 sentence summary of the main content and themes",
  "keyInsight": "The single most valuable takeaway from this newsletter (1 sentence)",
  "readTimeMinutes": 5
}

Guidelines:
- Extract 1-3 inspirational quotes that are genuinely insightful or motivational
- The summary should capture what the newsletter is about without spoiling everything
- The key insight should be actionable or thought-provoking
- Estimate read time based on content length (roughly 200 words per minute)
- If the content is too short or not a real newsletter, still provide sensible defaults

Return ONLY valid JSON, no markdown formatting or explanation.`;

export async function processNewsletterWithClaude(
  subject: string,
  textContent: string,
  senderName: string
): Promise<ProcessedNewsletter> {
  try {
    const truncatedContent = textContent.slice(0, 15000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${LEGACY_PROCESSING_PROMPT}

Newsletter Subject: ${subject}
From: ${senderName}

Newsletter Content:
${truncatedContent}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(responseText) as ProcessedNewsletter;

    return {
      inspirations: parsed.inspirations || [],
      summary: parsed.summary || 'No summary available.',
      keyInsight: parsed.keyInsight || 'No key insight extracted.',
      readTimeMinutes:
        parsed.readTimeMinutes || Math.ceil(textContent.split(/\s+/).length / 200),
    };
  } catch (error) {
    console.error('Error processing newsletter with Claude:', error);

    return {
      inspirations: [],
      summary: 'Failed to process newsletter.',
      keyInsight: 'Processing error occurred.',
      readTimeMinutes: Math.ceil(textContent.split(/\s+/).length / 200),
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export async function testClaudeConnection(): Promise<boolean> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    });
    return message.content.length > 0;
  } catch (error) {
    console.error('Claude connection test failed:', error);
    return false;
  }
}

/**
 * Assess quality of a piece of content (used for moderation/filtering)
 */
export async function assessContentQuality(content: string): Promise<number> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: `Rate this content's quality from 0-100 (just the number):
"${content.slice(0, 500)}"`,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '50';
    const score = parseInt(responseText.trim(), 10);
    return isNaN(score) ? 0.5 : score / 100;
  } catch (error) {
    return 0.5; // Default mid-range score on error
  }
}
