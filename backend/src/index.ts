import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import webhookRoutes from './routes/webhooks';
import feedRoutes from './routes/feed';
import discoverRoutes from './routes/discover';
import testFeedRoutes from './routes/testFeed';
import internalRoutes from './routes/internal';
import { isMockDb } from './services/db';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/feed', feedRoutes);        // v2.0 - Content feed with engagement
app.use('/discover', discoverRoutes); // v2.0 - Content discovery
app.use('/test-feed', testFeedRoutes); // Test routes (no auth, works with mock db)
app.use('/internal', internalRoutes); // Cron/admin endpoints (protected)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  const dbMode = isMockDb ? '🧪 MOCK DATABASE' : '🗄️  PostgreSQL';
  console.log(`
  🚀 FocusTab API Server v2.0 running!

  📍 Local:    http://localhost:${PORT}
  🔒 Health:   http://localhost:${PORT}/health
  💾 Database: ${dbMode}

  📧 Webhook:  POST /webhooks/cloudflare, /webhooks/mailgun
  🔑 Auth:     POST /auth/signup, /auth/login
  📖 Content:  GET  /content/today (legacy)

  🆕 v2.0 Endpoints:
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
