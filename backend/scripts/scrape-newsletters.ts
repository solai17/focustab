/**
 * Newsletter Scraper - Fetch content from public newsletter archives
 *
 * Uses Google Gemini Flash 2.0 (FREE: 1,500 requests/day)
 * Falls back to Claude if Gemini fails
 *
 * Usage: npx ts-node scripts/scrape-newsletters.ts [--source=url]
 *
 * Setup:
 *   1. Get free API key: https://aistudio.google.com/apikey
 *   2. Add to .env: GEMINI_API_KEY=your_key
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Initialize Gemini client
const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Public newsletter archives to scrape
const PUBLIC_ARCHIVES = [
  {
    name: 'James Clear',
    archiveUrl: 'https://jamesclear.com/3-2-1',
    type: 'blog',
    category: 'productivity',
  },
  {
    name: 'Sahil Bloom',
    archiveUrl: 'https://www.sahilbloom.com/newsletter',
    type: 'substack',
    category: 'life',
  },
  {
    name: 'Paul Graham Essays',
    archiveUrl: 'https://paulgraham.com/articles.html',
    type: 'blog',
    category: 'business',
  },
];

const BYTE_EXTRACTION_PROMPT = `You are a master curator extracting transformative insights from this content.

Extract 3-5 "bytes" - bite-sized pieces of wisdom that make someone stop and think.

BYTE TYPES:
- quote: A memorable statement (requires author)
- insight: A non-obvious truth that shifts perspective
- statistic: A number that changes how you see something
- action: A specific thing you can do TODAY
- takeaway: A key lesson or principle
- mental_model: A framework for thinking about problems
- counterintuitive: Something that goes against common wisdom

REQUIREMENTS:
- Each byte: 1-4 sentences, max 100 words
- Must be self-contained (understandable without context)
- Focus on timeless wisdom, not dated facts
- Quality over quantity

Return ONLY valid JSON (no markdown, no code blocks):
{
  "bytes": [
    {
      "content": "The actual insight...",
      "type": "insight",
      "author": "Name or null",
      "context": "Brief context (2-4 words)",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health",
      "qualityScore": 0.85
    }
  ]
}

CONTENT TO ANALYZE:
`;

async function fetchContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ByteLetters/1.0 (Content Curation Bot)',
      },
    });

    if (!response.ok) {
      console.error(`  ❌ Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Basic HTML to text conversion
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 10000); // Limit to 10k chars
  } catch (error) {
    console.error(`  ❌ Error fetching ${url}:`, error);
    return null;
  }
}

async function extractBytesWithGemini(
  content: string,
  sourceName: string
): Promise<any[]> {
  if (!gemini) {
    console.error('  ❌ Gemini API key not configured. Set GEMINI_API_KEY in .env');
    return [];
  }

  try {
    console.log('  🤖 Using Gemini Flash 2.0 (FREE tier)...');

    // Use configurable model (default: gemini-2.0-flash-001)
    // Set GEMINI_MODEL=gemini-3-flash for best quality
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';

    const response = await gemini.models.generateContent({
      model,
      contents: BYTE_EXTRACTION_PROMPT + content.substring(0, 8000),
    });

    const responseText = response.text || '';

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      console.error('  ❌ Could not find JSON in Gemini response');
      console.log('  Response:', responseText.substring(0, 200));
      return [];
    }

    const parsed = JSON.parse(objectMatch[0]);
    return parsed.bytes || [];
  } catch (error) {
    console.error(`  ❌ Gemini extraction error:`, error);
    return [];
  }
}

function generateContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 32);
}

async function scrapeAndProcess(
  name: string,
  url: string,
  category: string
): Promise<number> {
  console.log(`\n📰 Scraping: ${name}`);
  console.log(`   URL: ${url}`);

  // 1. Fetch content
  const content = await fetchContent(url);
  if (!content) return 0;

  console.log(`   ✓ Fetched ${content.length} chars`);

  // 2. Find or create source
  const senderEmail = `scraper@${new URL(url).hostname}`;
  let source = await prisma.newsletterSource.findUnique({
    where: { senderEmail },
  });

  if (!source) {
    source = await prisma.newsletterSource.create({
      data: {
        name,
        senderEmail,
        senderDomain: new URL(url).hostname,
        category,
        description: `Content scraped from ${name}`,
        isVerified: false,
      },
    });
    console.log(`   ✓ Created source`);
  }

  // 3. Create edition
  const contentHash = generateContentHash(url + Date.now());
  const edition = await prisma.edition.create({
    data: {
      sourceId: source.id,
      subject: `Scraped: ${name} - ${new Date().toLocaleDateString()}`,
      contentHash,
      rawContent: content.substring(0, 5000),
      textContent: content.substring(0, 5000),
      isProcessed: true,
      processedAt: new Date(),
    },
  });
  console.log(`   ✓ Created edition`);

  // 4. Extract bytes with Gemini (FREE!)
  const bytes = await extractBytesWithGemini(content, name);
  console.log(`   ✓ Extracted ${bytes.length} bytes`);

  // 5. Save bytes to database
  let saved = 0;
  for (const byte of bytes) {
    // Skip low quality
    if ((byte.qualityScore || 0) < 0.6) continue;

    // Check for duplicates
    const existing = await prisma.contentByte.findFirst({
      where: { content: byte.content },
    });
    if (existing) continue;

    await prisma.contentByte.create({
      data: {
        editionId: edition.id,
        content: byte.content,
        type: byte.type || 'insight',
        author: byte.author || null,
        context: byte.context || null,
        category: byte.category || category,
        qualityScore: byte.qualityScore || 0.7,
      },
    });
    saved++;
  }

  console.log(`   ✓ Saved ${saved} bytes to database`);
  return saved;
}

async function main() {
  console.log('🕷️  ByteLetters Newsletter Scraper');
  console.log('   Using: Gemini Flash 2.0 (FREE: 1,500 req/day)\n');
  console.log('='.repeat(50));

  if (!geminiApiKey) {
    console.error('\n❌ GEMINI_API_KEY not set!');
    console.log('\nTo get a FREE API key:');
    console.log('  1. Go to: https://aistudio.google.com/apikey');
    console.log('  2. Create a key');
    console.log('  3. Add to .env: GEMINI_API_KEY=your_key\n');
    process.exit(1);
  }

  // Check for command line URL
  const customUrl = process.argv.find((arg) => arg.startsWith('--source='));
  if (customUrl) {
    const url = customUrl.split('=')[1];
    await scrapeAndProcess('Custom Source', url, 'general');
  } else {
    // Scrape default archives
    let totalBytes = 0;
    for (const archive of PUBLIC_ARCHIVES) {
      const count = await scrapeAndProcess(
        archive.name,
        archive.archiveUrl,
        archive.category
      );
      totalBytes += count;

      // Small delay to respect rate limits (10 RPM = 1 per 6 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Scraping complete! Total bytes added: ${totalBytes}`);
  }

  // Show database stats
  const totalBytes = await prisma.contentByte.count();
  const totalSources = await prisma.newsletterSource.count();
  console.log(`\n📊 Database stats:`);
  console.log(`   Total bytes: ${totalBytes}`);
  console.log(`   Total sources: ${totalSources}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
