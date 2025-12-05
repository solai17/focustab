import Anthropic from '@anthropic-ai/sdk';
import { ProcessedNewsletter } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PROCESSING_PROMPT = `You are processing a newsletter email to extract valuable content. Analyze the newsletter and return a JSON object with the following structure:

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
    // Truncate content if too long (Claude has context limits)
    const truncatedContent = textContent.slice(0, 15000);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${PROCESSING_PROMPT}

Newsletter Subject: ${subject}
From: ${senderName}

Newsletter Content:
${truncatedContent}`,
        },
      ],
    });

    // Extract text content from response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    // Parse JSON response
    const parsed = JSON.parse(responseText) as ProcessedNewsletter;

    // Validate and provide defaults
    return {
      inspirations: parsed.inspirations || [],
      summary: parsed.summary || 'No summary available.',
      keyInsight: parsed.keyInsight || 'No key insight extracted.',
      readTimeMinutes: parsed.readTimeMinutes || Math.ceil(textContent.split(/\s+/).length / 200),
    };
  } catch (error) {
    console.error('Error processing newsletter with Claude:', error);
    
    // Return defaults on error
    return {
      inspirations: [],
      summary: 'Failed to process newsletter.',
      keyInsight: 'Processing error occurred.',
      readTimeMinutes: Math.ceil(textContent.split(/\s+/).length / 200),
    };
  }
}

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
