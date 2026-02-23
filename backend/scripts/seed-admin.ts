/**
 * Seed Admin User Script
 *
 * Creates or updates the admin user with a securely hashed password.
 * Run with: npx ts-node scripts/seed-admin.ts
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Admin credentials - change these as needed
const ADMIN_EMAIL = 's.solaiyappan17@gmail.com';
const ADMIN_PASSWORD = 'Solai@5099';
const ADMIN_NAME = 'Solaiyappan';

async function seedAdmin() {
  console.log('='.repeat(50));
  console.log('SEEDING ADMIN USER');
  console.log('='.repeat(50));
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log('');

  try {
    // Hash password with high cost factor (12 rounds)
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    console.log('✓ Password hashed securely (bcrypt, 12 rounds)');

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL.toLowerCase() },
    });

    if (existingUser) {
      // Update existing user to be admin with new password
      await prisma.user.update({
        where: { email: ADMIN_EMAIL.toLowerCase() },
        data: {
          passwordHash,
          isAdmin: true,
          name: ADMIN_NAME,
        },
      });
      console.log('✓ Updated existing user to admin');
    } else {
      // Create new admin user
      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL.toLowerCase(),
          passwordHash,
          name: ADMIN_NAME,
          isAdmin: true,
          onboardingCompleted: true,
          lifeExpectancy: 80,
        },
      });
      console.log('✓ Created new admin user');
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('ADMIN USER READY');
    console.log('='.repeat(50));
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log('Password: [set as configured]');
    console.log('isAdmin: true');
    console.log('');
    console.log('You can now log in at /admin.html');

  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
