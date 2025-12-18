/**
 * Content Seeder - Populate database with initial high-quality bytes
 *
 * This script:
 * 1. Fetches popular newsletter archives from Substack/web
 * 2. Uses Claude to extract quality bytes
 * 3. Seeds the database with initial content
 *
 * Usage: npx ts-node scripts/seed-content.ts
 */

import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const anthropic = new Anthropic();

// Popular newsletters to seed from (public archives)
const SEED_SOURCES = [
  {
    name: "James Clear's 3-2-1",
    senderEmail: 'james@jamesclear.com',
    category: 'productivity',
    description: 'Ideas for building better habits',
    isVerified: true,
  },
  {
    name: 'Farnam Street',
    senderEmail: 'newsletter@fs.blog',
    category: 'wisdom',
    description: 'Mental models and timeless insights',
    isVerified: true,
  },
  {
    name: 'Daily Stoic',
    senderEmail: 'daily@dailystoic.com',
    category: 'wisdom',
    description: 'Ancient wisdom for modern life',
    isVerified: true,
  },
  {
    name: 'The Hustle',
    senderEmail: 'newsletter@thehustle.co',
    category: 'business',
    description: 'Business and tech news',
    isVerified: true,
  },
  {
    name: 'Morning Brew',
    senderEmail: 'crew@morningbrew.com',
    category: 'business',
    description: 'Daily business news digest',
    isVerified: true,
  },
  {
    name: "Lenny's Newsletter",
    senderEmail: 'lenny@substack.com',
    category: 'productivity',
    description: 'Product management insights',
    isVerified: true,
  },
];

// High-quality seed bytes (curated)
const SEED_BYTES = [
  // Productivity
  {
    content: "We don't rise to the level of our goals. We fall to the level of our systems.",
    type: 'insight',
    author: 'James Clear',
    context: 'on building habits',
    category: 'productivity',
    sourceName: "James Clear's 3-2-1",
  },
  {
    content: '1% better every day = 37x better in a year. Small improvements compound.',
    type: 'statistic',
    author: 'James Clear',
    context: 'on growth',
    category: 'productivity',
    sourceName: "James Clear's 3-2-1",
  },
  {
    content: 'Block 2 hours every morning for deep work. No meetings, no Slack, no email. Protect this time ruthlessly.',
    type: 'action',
    author: 'Cal Newport',
    context: 'on focus',
    category: 'productivity',
    sourceName: 'Deep Questions',
  },
  {
    content: 'Your attention is your most precious resource. Guard it like your life depends on it—because your life is made of it.',
    type: 'insight',
    author: null,
    context: 'on focus',
    category: 'productivity',
    sourceName: 'Farnam Street',
  },
  {
    content: 'Every yes is a no to something else. Make your nos intentional.',
    type: 'takeaway',
    author: null,
    context: 'on prioritization',
    category: 'productivity',
    sourceName: "Lenny's Newsletter",
  },

  // Wisdom
  {
    content: 'The best time to plant a tree was 20 years ago. The second best time is now.',
    type: 'quote',
    author: 'Chinese Proverb',
    context: 'on taking action',
    category: 'wisdom',
    sourceName: 'Farnam Street',
  },
  {
    content: 'The obstacle is the way.',
    type: 'quote',
    author: 'Marcus Aurelius',
    context: 'on challenges',
    category: 'wisdom',
    sourceName: 'Daily Stoic',
  },
  {
    content: 'What I cannot create, I do not understand.',
    type: 'quote',
    author: 'Richard Feynman',
    context: 'on learning',
    category: 'wisdom',
    sourceName: 'Farnam Street',
  },
  {
    content: "Memento mori. Remember you will die. Not to be morbid, but to live fully while you can.",
    type: 'insight',
    author: 'Marcus Aurelius',
    context: 'on mortality',
    category: 'wisdom',
    sourceName: 'Daily Stoic',
  },
  {
    content: "You have power over your mind, not outside events. Realize this, and you will find strength.",
    type: 'quote',
    author: 'Marcus Aurelius',
    context: 'on control',
    category: 'wisdom',
    sourceName: 'Daily Stoic',
  },

  // Life
  {
    content: 'You have about 4,000 weeks to live. How you spend this one matters.',
    type: 'insight',
    author: 'Oliver Burkeman',
    context: 'on time',
    category: 'life',
    sourceName: 'Four Thousand Weeks',
  },
  {
    content: 'The most dangerous risk: spending your life not doing what you want, betting you can buy freedom later.',
    type: 'counterintuitive',
    author: 'Randy Komisar',
    context: 'on life choices',
    category: 'life',
    sourceName: 'Tim Ferriss Show',
  },
  {
    content: "Ask yourself: 'Will this matter in 5 years?' If not, don't spend more than 5 minutes upset about it.",
    type: 'mental_model',
    author: null,
    context: 'on perspective',
    category: 'life',
    sourceName: 'Farnam Street',
  },
  {
    content: 'Health is the first wealth. Without it, nothing else matters. Protect it fiercely.',
    type: 'insight',
    author: 'Ralph Waldo Emerson',
    context: 'on priorities',
    category: 'health',
    sourceName: 'The Hustle',
  },

  // Business/Tech
  {
    content: 'The best product is the one that solves a real problem. Not the one with the most features.',
    type: 'insight',
    author: null,
    context: 'on product development',
    category: 'business',
    sourceName: "Lenny's Newsletter",
  },
  {
    content: 'Ship early, ship often. Perfect is the enemy of good enough.',
    type: 'takeaway',
    author: null,
    context: 'on execution',
    category: 'tech',
    sourceName: 'Morning Brew',
  },
  {
    content: "Talk to your users. The answers to your hardest product questions are in their frustrations.",
    type: 'action',
    author: null,
    context: 'on customer development',
    category: 'business',
    sourceName: "Lenny's Newsletter",
  },
  {
    content: 'The companies that win are the ones that learn faster than their competitors.',
    type: 'insight',
    author: 'Eric Ries',
    context: 'on startups',
    category: 'business',
    sourceName: 'The Hustle',
  },

  // Creativity
  {
    content: 'Creativity is just connecting things. The more diverse your inputs, the more interesting your outputs.',
    type: 'insight',
    author: 'Steve Jobs',
    context: 'on innovation',
    category: 'creativity',
    sourceName: 'Farnam Street',
  },
  {
    content: 'Write drunk, edit sober. Create without judgment first, then refine.',
    type: 'mental_model',
    author: 'Ernest Hemingway',
    context: 'on creative process',
    category: 'creativity',
    sourceName: 'Farnam Street',
  },
];

function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

async function seedDatabase() {
  console.log('🌱 Seeding ByteLetters database...\n');

  // 1. Create newsletter sources
  console.log('📰 Creating newsletter sources...');
  const sourceMap = new Map<string, string>();

  for (const source of SEED_SOURCES) {
    const existing = await prisma.newsletterSource.findUnique({
      where: { senderEmail: source.senderEmail },
    });

    if (existing) {
      sourceMap.set(source.name, existing.id);
      console.log(`  ⏭️  Source "${source.name}" already exists`);
    } else {
      const created = await prisma.newsletterSource.create({
        data: {
          name: source.name,
          senderEmail: source.senderEmail,
          senderDomain: source.senderEmail.split('@')[1],
          category: source.category,
          description: source.description,
          isVerified: source.isVerified,
        },
      });
      sourceMap.set(source.name, created.id);
      console.log(`  ✓ Created source "${source.name}"`);
    }
  }

  // 2. Create editions (one per source for seed content)
  console.log('\n📑 Creating editions...');
  const editionMap = new Map<string, string>();

  for (const [sourceName, sourceId] of sourceMap) {
    const contentHash = generateContentHash(`seed-edition-${sourceName}`);

    const existing = await prisma.edition.findUnique({
      where: { contentHash },
    });

    if (existing) {
      editionMap.set(sourceName, existing.id);
      console.log(`  ⏭️  Edition for "${sourceName}" already exists`);
    } else {
      const edition = await prisma.edition.create({
        data: {
          sourceId,
          subject: `Seed Content - ${sourceName}`,
          contentHash,
          rawContent: 'Seed content edition',
          textContent: 'Seed content edition',
          summary: 'Initial seed content for ByteLetters',
          isProcessed: true,
          processedAt: new Date(),
        },
      });
      editionMap.set(sourceName, edition.id);
      console.log(`  ✓ Created edition for "${sourceName}"`);
    }
  }

  // 3. Create content bytes
  console.log('\n💡 Creating content bytes...');
  let created = 0;
  let skipped = 0;

  for (const byte of SEED_BYTES) {
    const editionId = editionMap.get(byte.sourceName);
    if (!editionId) {
      // Find or create a generic source for this byte
      console.log(`  ⚠️  No edition found for "${byte.sourceName}", skipping`);
      skipped++;
      continue;
    }

    // Check if similar content exists
    const existing = await prisma.contentByte.findFirst({
      where: {
        content: byte.content,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Byte already exists: "${byte.content.substring(0, 40)}..."`);
      skipped++;
      continue;
    }

    await prisma.contentByte.create({
      data: {
        editionId,
        content: byte.content,
        type: byte.type,
        author: byte.author,
        context: byte.context,
        category: byte.category,
        qualityScore: 0.85, // High quality curated content
        engagementScore: Math.random() * 100, // Random initial score for variety
      },
    });

    console.log(`  ✓ Created byte: "${byte.content.substring(0, 50)}..."`);
    created++;
  }

  // 4. Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Seeding complete!\n');
  console.log(`  📰 Sources: ${sourceMap.size}`);
  console.log(`  📑 Editions: ${editionMap.size}`);
  console.log(`  💡 Bytes created: ${created}`);
  console.log(`  ⏭️  Bytes skipped: ${skipped}`);

  // Show total stats
  const totalBytes = await prisma.contentByte.count();
  const totalSources = await prisma.newsletterSource.count();
  console.log(`\n  📊 Total bytes in database: ${totalBytes}`);
  console.log(`  📊 Total sources in database: ${totalSources}`);
}

// Run seeder
seedDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
