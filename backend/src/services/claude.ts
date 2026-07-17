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

const BYTE_EXTRACTION_PROMPT = `You are the curator behind ByteLetters, a product with one promise: every new browser tab leaves you a little wiser than the tab before.

THE MOMENT YOU ARE CURATING FOR:
Someone just opened a new tab between tasks. They will give the byte 10-30 seconds of genuine attention before moving on. In that window, a great byte does one of these:
- Makes them pause and reflect on how they live or work
- Challenges a belief they hold
- Hands them a lens they'll reuse for years
- Gives them one specific thing to do differently today

They did NOT open the tab for news, summaries of the newsletter, or motivation-poster filler. One real idea, standing entirely on its own, beats everything else.

Return a JSON object:

{
  "summary": "A compelling 2-3 sentence summary capturing the newsletter's core value",
  "readTimeMinutes": 5,
  "bytes": [
    {
      "content": "The insight, rewritten to be punchy and memorable (1-4 sentences, max 100 words, readable in 20-30 seconds)",
      "type": "quote|insight|statistic|action|takeaway|mental_model|counterintuitive",
      "author": "The ORIGINAL thinker this idea belongs to (see attribution rules), otherwise null",
      "context": "Brief context (5-8 words) e.g., 'on decision-making' or 'from Deep Work'",
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

ATTRIBUTION RULES (credit the original thinker):
- Direct quote from a person -> author = that person
- Idea from a cited book or thinker (even paraphrased) -> author = the original author, context = the book or origin (e.g., 'from Atomic Habits')
- The newsletter writer's own idea -> author = null (the newsletter is already shown as the source)
- Never present someone else's idea as unattributed wisdom

WHAT MAKES A GREAT BYTE:
- "The best time to plant a tree was 20 years ago. The second best time is now."
- "You don't rise to the level of your goals; you fall to the level of your systems."
- "1% better every day = 37x better in a year"
- "Ask 'What would this look like if it were easy?'"

WHAT TO REJECT:
- "The author discusses various productivity techniques" (about the article, not an idea)
- "There are many ways to improve your life" (no substance)
- "Believe in yourself and anything is possible" (motivational filler - sounds wise, changes nothing)
- "Click here to learn more..." / "In this week's issue..." (promotional or meta)
- Anything tied to a date, event, product launch, or "recently" (dies with the news cycle)

EXTRACTION RULES:
1. Quality over quantity: 2-5 EXCEPTIONAL bytes beat 10 mediocre ones. Zero is acceptable for a weak edition.
2. REWRITE for impact: Don't copy-paste. Distill the essence into its most memorable form - but never distort the meaning or manufacture a claim the text doesn't support.
3. TIMELESS over timely: If it won't be worth reading in five years, skip it.
4. STANDALONE: The reader has NOT read the newsletter. If the byte needs the article to make sense, skip it.
5. ACTIONABLE preferred: "Do X" beats "X is important."
6. SPECIFIC beats generic: "Walk 10 mins after meals" beats "Exercise more."
7. VARIETY: Across the bytes you pick, vary the types - don't return five near-identical takeaways.

SCORING (be honest - low-quality bytes get audited out later anyway):
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
    console.log(`[AI] Using Claude Sonnet 5 for: ${sourceName}`);
    const truncatedContent = textContent.slice(0, 20000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3072, // headroom for Sonnet 5's tokenizer (~30% more tokens)
      thinking: { type: 'disabled' }, // content[0] must be the text block
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
      modelUsed: 'claude-sonnet-5',
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
      model: 'claude-sonnet-5',
      max_tokens: 384, // headroom for Sonnet 5's tokenizer
      thinking: { type: 'disabled' }, // content[0] must be the text block
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
      model: 'claude-sonnet-5',
      max_tokens: 16,
      thinking: { type: 'disabled' }, // single-word answer, no thinking spend
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
      model: 'claude-sonnet-5',
      max_tokens: 16,
      thinking: { type: 'disabled' }, // single-word answer, no thinking spend
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
