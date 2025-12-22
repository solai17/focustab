import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/db';
import { generateToken, authenticateToken } from '../middleware/auth';
import { generateInboxEmail } from '../services/utils';
import { SignupInput, LoginInput, AuthenticatedRequest } from '../types';
import { rateLimits } from '../middleware/security';

const router = Router();

// Apply rate limiting to all auth routes
router.use(rateLimits.auth);

/**
 * POST /auth/google
 * Authenticate or create user via Google/Chrome identity
 * This is the primary auth method for the Chrome extension
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { googleEmail, googleId, name, birthDate, lifeExpectancy, enableRecommendations } = req.body;

    // Validate required fields
    if (!googleEmail || !googleId) {
      res.status(400).json({ error: 'Google email and ID are required' });
      return;
    }

    // Check if user exists by Google ID or email
    let user = await prisma.user.findUnique({
      where: { email: googleEmail.toLowerCase() },
    });

    if (user) {
      // Existing user - update Google ID if not set
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      // Update profile if new data provided
      // Always update name if provided during onboarding (fixes email prefix issue)
      if (name || birthDate || lifeExpectancy !== undefined || enableRecommendations !== undefined) {
        const updateData: Record<string, unknown> = {};
        // Always update name if provided - user's name takes precedence over email prefix
        if (name) updateData.name = name;
        if (birthDate && !user.birthDate) updateData.birthDate = new Date(birthDate);
        if (lifeExpectancy !== undefined) updateData.lifeExpectancy = lifeExpectancy;
        if (enableRecommendations !== undefined) updateData.enableRecommendations = enableRecommendations;

        if (Object.keys(updateData).length > 0) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }
      }
    } else {
      // New user - create account
      const inboxEmail = generateInboxEmail(name || googleEmail.split('@')[0]);

      user = await prisma.user.create({
        data: {
          email: googleEmail.toLowerCase(),
          googleId,
          passwordHash: '', // No password for Google auth
          name: name || googleEmail.split('@')[0],
          birthDate: birthDate ? new Date(birthDate) : null,
          lifeExpectancy: lifeExpectancy || 80,
          enableRecommendations: enableRecommendations ?? true,
          inboxEmail,
          onboardingCompleted: !!(name && birthDate),
        },
      });
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
        enableRecommendations: user.enableRecommendations,
        onboardingCompleted: user.onboardingCompleted,
      },
      isNewUser: !user.onboardingCompleted,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /auth/signup
 * Create a new user account (email/password method)
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
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

    // Hash password with high cost factor
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
        onboardingCompleted: true,
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
        enableRecommendations: user.enableRecommendations,
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
      // Use same error message to prevent email enumeration
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user has password (might be Google-only account)
    if (!user.passwordHash) {
      res.status(401).json({ error: 'Please sign in with Google' });
      return;
    }

    // Verify password with timing-safe comparison
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
        enableRecommendations: user.enableRecommendations,
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
        enableRecommendations: true,
        onboardingCompleted: true,
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
    const { name, birthDate, lifeExpectancy, enableRecommendations } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (birthDate !== undefined) updateData.birthDate = new Date(birthDate);
    if (lifeExpectancy !== undefined) updateData.lifeExpectancy = parseInt(lifeExpectancy);
    if (enableRecommendations !== undefined) updateData.enableRecommendations = enableRecommendations;

    // Mark onboarding complete if name and birthDate are set
    if (name && birthDate) {
      updateData.onboardingCompleted = true;
    }

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
        enableRecommendations: true,
        onboardingCompleted: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /auth/logout
 * Logout user (primarily for token invalidation tracking)
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // In a production system, you might want to:
  // 1. Add the token to a blacklist (Redis)
  // 2. Track logout events for security
  // For now, we just acknowledge the logout
  res.json({ message: 'Logged out successfully' });
});

export default router;
