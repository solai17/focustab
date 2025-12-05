import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/db';
import { generateToken, authenticateToken } from '../middleware/auth';
import { generateInboxEmail } from '../services/utils';
import { SignupInput, LoginInput, AuthenticatedRequest } from '../types';

const router = Router();

/**
 * POST /auth/signup
 * Create a new user account
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name, birthDate } = req.body as SignupInput;

    // Validate input
    if (!email || !password || !name || !birthDate) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique inbox email
    const inboxEmail = generateInboxEmail(name);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        birthDate: new Date(birthDate),
        inboxEmail,
      },
    });

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        birthDate: user.birthDate,
        lifeExpectancy: user.lifeExpectancy,
        inboxEmail: user.inboxEmail,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginInput;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        birthDate: user.birthDate,
        lifeExpectancy: user.lifeExpectancy,
        inboxEmail: user.inboxEmail,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        birthDate: true,
        lifeExpectancy: true,
        inboxEmail: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, birthDate, lifeExpectancy } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (birthDate) updateData.birthDate = new Date(birthDate);
    if (lifeExpectancy) updateData.lifeExpectancy = parseInt(lifeExpectancy);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        birthDate: true,
        lifeExpectancy: true,
        inboxEmail: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
