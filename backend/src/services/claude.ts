import Anthropic from '@anthropic-ai/sdk';
import { ProcessedEdition, ExtractedByte, ByteType, ByteCategory } from '../types';
import { parseAIResponse, validateBytes } from '../utils/jsonParser';

// Extended result type that includes newsletter info and model tracking
export interface ProcessedEditionWithSourceInfo extends ProcessedEdition {
  newsletterInfo?: NewsletterInfo;
  modelUsed?: string; // Track which AI model processed this
}

export interface NewsletterInfo {
  name: string;
  website: string | null;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// v3.0 CONTENT BYTE EXTRACTION (Anthropic Only)
// =============================================================================

const BYTE_EXTRACTION_PROMPT = `You are a master curator extracting transformative insights from newsletters. Your mission: find the ONE idea that could change how someone thinks or acts today.

Think like the reader is opening a new tab, has 5 seconds, and needs something that:
- Makes them pause and reflect
- Challenges a belief they hold
- Gives them a new lens to see the world
- Inspires immediate action

Return a JSON object:

{
  "summary": "A compelling 2-3 sentence summary capturing the newsletter's core value",
  "readTimeMinutes": 5,
  "bytes": [
    {
      "content": "The insight, rewritten to be punchy and memorable (1-4 sentences, max 100 words, readable in 20-30 seconds)",
      "type": "quote|insight|statistic|action|takeaway|mental_model|counterintuitive",
      "author": "Original author if this is a direct quote, otherwise null",
      "context": "Brief context (5-8 words) e.g., 'on decision-making' or 'about creative work'",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health|general",
      "qualityScore": 0.85
    }
  ]
}

BYTE TYPES (pick the most fitting):
- quote: A memorable statement worth remembering (requires author)
- insight: A non-obvious truth that shifts perspective
- statistic: A number that changes how you see something
- action: A specific thing you can do TODAY
- takeaway: A key lesson or principle
- mental_model: A framework for thinking about problems
- counterintuitive: Something that goes against common wisdom

WHAT MAKES A GREAT BYTE:
✓ "The best time to plant a tree was 20 years ago. The second best time is now."
✓ "You don't rise to the level of your goals; you fall to the level of your systems."
✓ "1% better every day = 37x better in a year"
✓ "Ask 'What would this look like if it were easy?'"
✗ "The author discusses various productivity techniques" (too vague)
✗ "There are many ways to improve your life" (no substance)
✗ "Click here to learn more about..." (promotional)

EXTRACTION RULES:
1. Quality over quantity: 2-5 EXCEPTIONAL bytes beat 10 mediocre ones
2. REWRITE for impact: Don't just copy-paste. Distill the essence into memorable form
3. TIMELESS over timely: Skip news, dates, "this week", "recently"
4. STANDALONE: If it needs the article to make sense, skip it
5. ACTIONABLE preferred: "Do X" beats "X is important"
6. SPECIFIC beats generic: "Walk 10 mins after meals" beats "Exercise more"
7. SKIP promotional content, CTAs, and self-references to the newsletter

SCORING:
- 0.95+: Life-changing insight, universally applicable, memorable phrasing
- 0.85-0.94: Excellent insight, most people would save/share this
- 0.75-0.84: Good insight, valuable to interested readers
- 0.65-0.74: Decent but needs more context or is somewhat niche
- Below 0.65: Don't include

Return ONLY valid JSON, no markdown or explanation.`;

/**
 * Process newsletter edition with Claude Sonnet 4
 */
export async function processEditionWithClaude(
  subject: string,
  textContent: string,
  sourceName: string,
  extractSourceInfo: boolean = false
): Promise<ProcessedEditionWithSourceInfo> {
  try {
    console.log(`[AI] Using Claude Sonnet 4 for: ${sourceName}`);
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

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON using robust parser
    const parsed = parseAIResponse<{ bytes?: any[]; summary?: string; readTimeMinutes?: number }>(responseText);

    if (!parsed) {
      throw new Error('Could not parse JSON from Claude response');
    }

    // Validate bytes using utility, then apply type/category validation
    const validBytes: ExtractedByte[] = validateBytes(parsed.bytes || []).map((byte) => ({
      ...byte,
      type: validateByteType(byte.type),
      category: validateByteCategory(byte.category),
    }));

    return {
      summary: parsed.summary || 'Newsletter content processed.',
      readTimeMinutes:
        parsed.readTimeMinutes || Math.ceil(textContent.split(/\s+/).length / 200),
      bytes: validBytes,
      modelUsed: 'claude-sonnet-4',
    };
  } catch (error) {
    console.error('Error processing edition with Claude:', error);
    throw new Error(`Failed to process with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateByteType(type: string): ByteType {
  const validTypes: ByteType[] = ['quote', 'insight', 'statistic', 'action', 'takeaway', 'mental_model', 'counterintuitive'];
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
