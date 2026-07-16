import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Never run production with a guessable signing key - anyone who knows
    // the fallback could forge admin tokens
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  console.warn('[Auth] WARNING: JWT_SECRET not set - using insecure dev-only fallback');
}

const SIGNING_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, SIGNING_SECRET) as JWTPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, SIGNING_SECRET, { expiresIn: '30d' });
}
