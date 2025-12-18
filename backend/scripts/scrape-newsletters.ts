/**
 * Newsletter Scraper - Fetch content from public newsletter archives
 *
 * Scrapes popular newsletter archives (Substack, etc.) and extracts
 * quality bytes using Claude.
 *
 * Usage: npx ts-node scripts/scrape-newsletters.ts [--source=substack-url]
 *
 * Note: Only scrape publicly available content. Respect robots.txt.
 */

import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const anthropic = new Anthropic();

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

Return JSON:
{
  "bytes": [
    {
      "content": "The actual insight...",
      "type": "insight|quote|statistic|action|takeaway|mental_model|counterintuitive",
      "author": "Name or null",
      "context": "Brief context (2-4 words)",
      "category": "wisdom|productivity|business|tech|life|creativity|leadership|finance|health",
      "qualityScore": 0.0-1.0
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

async function extractBytesWithClaude(
  content: string,
  sourceName: string
): Promise<any[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: BYTE_EXTRACTION_PROMPT + content.substring(0, 8000),
        },
      ],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('  ❌ Could not find JSON in Claude response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.bytes || [];
  } catch (error) {
    console.error(`  ❌ Claude extraction error:`, error);
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

  // 4. Extract bytes with Claude
  console.log(`   🤖 Extracting bytes with Claude...`);
  const bytes = await extractBytesWithClaude(content, name);
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
  console.log('🕷️  ByteLetters Newsletter Scraper\n');
  console.log('='.repeat(50));

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
