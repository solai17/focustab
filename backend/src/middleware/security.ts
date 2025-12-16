/**
 * Security Middleware for Production
 * Rate limiting, request validation, and security headers
 */

import { Request, Response, NextFunction } from 'express';

// In-memory rate limiting store (use Redis in production for horizontal scaling)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  message?: string;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getClientIdentifier(req);
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // New window
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      setRateLimitHeaders(res, maxRequests, maxRequests - 1, Math.ceil(windowMs / 1000));
      next();
      return;
    }

    if (record.count >= maxRequests) {
      // Rate limited
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      setRateLimitHeaders(res, maxRequests, 0, retryAfter);
      res.status(429).json({
        error: message,
        retryAfter,
      });
      return;
    }

    // Increment count
    record.count++;
    rateLimitStore.set(key, record);
    setRateLimitHeaders(res, maxRequests, maxRequests - record.count, Math.ceil((record.resetTime - now) / 1000));
    next();
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: Request): string {
  // Try to get user ID from auth
  const userId = (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim()
    : req.ip || req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
}

/**
 * Set rate limit headers
 */
function setRateLimitHeaders(res: Response, limit: number, remaining: number, reset: number): void {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('X-RateLimit-Reset', reset);
}

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Request validation middleware
 */
export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  // Check content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      res.status(415).json({ error: 'Unsupported Media Type' });
      return;
    }
  }

  // Sanitize common attack patterns in query params
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      // Check for SQL injection patterns
      if (/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i.test(value)) {
        res.status(400).json({ error: 'Invalid query parameter' });
        return;
      }
      // Check for script injection
      if (/<script|javascript:/i.test(value)) {
        res.status(400).json({ error: 'Invalid query parameter' });
        return;
      }
    }
  }

  next();
}

/**
 * Security headers middleware (supplements Helmet)
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Log format: [timestamp] METHOD /path STATUS duration ms - IP
    console.log(
      `[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms - ${ip}`
    );
  });

  next();
}

// Predefined rate limit configurations
export const rateLimits = {
  // General API: 100 requests per minute
  general: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests, please try again in a minute',
  }),

  // Auth endpoints: 10 requests per minute (prevent brute force)
  auth: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Too many authentication attempts, please try again later',
  }),

  // Feed/content: 200 requests per minute (high traffic)
  feed: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 200,
    message: 'Rate limit exceeded for feed requests',
  }),

  // Engagement actions: 60 requests per minute
  engagement: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'Too many engagement actions, please slow down',
  }),
};
