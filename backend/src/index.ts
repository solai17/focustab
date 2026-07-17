import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import feedRoutes from './routes/feed';
import discoverRoutes from './routes/discover';
import testFeedRoutes from './routes/testFeed';
import internalRoutes from './routes/internal';
import adminRoutes from './routes/admin';
import newslettersRoutes from './routes/newsletters';
import publicRoutes from './routes/public';
import { isMockDb } from './services/db';
import { startScrapeScheduler } from './services/scrapeScheduler';
import { securityHeaders, validateRequest, rateLimits, requestLogger } from './middleware/security';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(securityHeaders);  // Additional security headers
app.use(requestLogger);     // Log all requests

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://byteletters.app',  // Admin portal on Cloudflare Pages
  'chrome-extension://*',
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Check allowed origins
    if (allowedOrigins.some(allowed => origin === allowed || allowed === '*')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting and validation
app.use('/feed', rateLimits.feed);
app.use('/discover', rateLimits.feed);
app.use('/test-feed', rateLimits.general);
app.use(validateRequest);  // Validate all requests for injection attacks

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
// NOTE: Email-forwarding webhooks removed in the curated-content pivot -
// content now comes exclusively from scraping curated newsletter archives
app.use('/auth', authRoutes);
app.use('/feed', feedRoutes);           // Content feed with engagement
app.use('/discover', discoverRoutes);   // Content discovery
app.use('/newsletters', newslettersRoutes); // Curated newsletter sources
app.use('/test-feed', testFeedRoutes);  // Test routes (no auth, works with mock db)
app.use('/internal', internalRoutes);   // Cron/admin endpoints (protected)
app.use('/admin', adminRoutes);         // Admin dashboard endpoints
app.use('/public', rateLimits.general, publicRoutes); // Unauthenticated landing-page endpoints

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Scheduled scraping (daily/weekly per source, honors scrapeFrequency)
if (!isMockDb) {
  startScrapeScheduler();
}

// Start server
app.listen(PORT, () => {
  const dbMode = isMockDb ? '🧪 MOCK DATABASE' : '🗄️  PostgreSQL';
  console.log(`
  🚀 ByteLetters API Server running!

  📍 Local:    http://localhost:${PORT}
  🔒 Health:   http://localhost:${PORT}/health
  💾 Database: ${dbMode}

  🔑 Auth:     POST /auth/signup, /auth/login

  📰 Feed:     GET  /feed, /feed/next
  👍 Engage:   POST /feed/bytes/:id/vote, /view, /save
  🔍 Discover: GET  /discover/sources, /trending, /popular
  🎯 Onboard:  GET  /discover/onboarding

  🧪 Test Endpoints (no auth, works with mock db):
  📰 Feed:     GET  /test-feed, /test-feed/next
  👍 Vote:     POST /test-feed/bytes/:id/vote
  📊 Sources:  GET  /test-feed/sources
  📈 Stats:    GET  /test-feed/stats

  ⚙️  Internal Endpoints (cron/admin):
  🔄 Queue:    POST /internal/process-queue
  📊 Stats:    GET  /internal/queue-stats
  🔁 Retry:    POST /internal/reset-failed
  `);
});

export default app;
