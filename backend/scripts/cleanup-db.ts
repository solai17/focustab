/**
 * Database Cleanup Script
 * Removes all test/dummy data from production database
 *
 * Usage: npx ts-node scripts/cleanup-db.ts
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function getStats() {
  const [
    users,
    sources,
    editions,
    bytes,
    engagements,
    history,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.newsletterSource.count(),
    prisma.edition.count(),
    prisma.contentByte.count(),
    prisma.userEngagement.count(),
    prisma.contentHistory.count(),
  ]);

  return { users, sources, editions, bytes, engagements, history };
}

async function cleanupDatabase(keepUsers: boolean = false) {
  console.log('\n📊 Current database stats:');
  const beforeStats = await getStats();
  console.table(beforeStats);

  const confirmed = await confirmAction(
    '\n⚠️  This will DELETE all content data. Are you sure?'
  );

  if (!confirmed) {
    console.log('❌ Cleanup cancelled.');
    return;
  }

  console.log('\n🧹 Cleaning up database...\n');

  // Delete in correct order (respecting foreign keys)

  // 1. Delete user engagement data
  const deletedEngagements = await prisma.userEngagement.deleteMany();
  console.log(`  ✓ Deleted ${deletedEngagements.count} user engagements`);

  // 2. Delete content history
  const deletedHistory = await prisma.contentHistory.deleteMany();
  console.log(`  ✓ Deleted ${deletedHistory.count} content history records`);

  // 3. Delete user preferences
  const deletedPrefs = await prisma.userPreference.deleteMany();
  console.log(`  ✓ Deleted ${deletedPrefs.count} user preferences`);

  // 4. Delete user subscriptions
  const deletedSubs = await prisma.userSubscription.deleteMany();
  console.log(`  ✓ Deleted ${deletedSubs.count} user subscriptions`);

  // 5. Delete content bytes
  const deletedBytes = await prisma.contentByte.deleteMany();
  console.log(`  ✓ Deleted ${deletedBytes.count} content bytes`);

  // 6. Delete editions
  const deletedEditions = await prisma.edition.deleteMany();
  console.log(`  ✓ Deleted ${deletedEditions.count} editions`);

  // 7. Delete newsletter sources
  const deletedSources = await prisma.newsletterSource.deleteMany();
  console.log(`  ✓ Deleted ${deletedSources.count} newsletter sources`);

  // 8. Delete legacy data
  const deletedLegacyNewsletters = await prisma.newsletter.deleteMany();
  const deletedLegacyInspirations = await prisma.inspiration.deleteMany();
  console.log(`  ✓ Deleted ${deletedLegacyNewsletters.count} legacy newsletters`);
  console.log(`  ✓ Deleted ${deletedLegacyInspirations.count} legacy inspirations`);

  // 9. Optionally delete users
  if (!keepUsers) {
    const deleteUsers = await confirmAction('\n🔐 Delete all users too?');
    if (deleteUsers) {
      const deletedUsers = await prisma.user.deleteMany();
      console.log(`  ✓ Deleted ${deletedUsers.count} users`);
    }
  }

  console.log('\n✅ Database cleanup complete!\n');

  const afterStats = await getStats();
  console.log('📊 After cleanup:');
  console.table(afterStats);
}

// Run cleanup
cleanupDatabase(true)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
