/**
 * Cloudflare Worker - Newsletter Queue Processor
 *
 * Triggers the backend to process pending newsletters every 5 minutes.
 * Respects Gemini API rate limits (10 RPM, ~500 RPD).
 *
 * SETUP:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Add environment variable: CRON_SECRET (same as INTERNAL_CRON_SECRET in backend)
 * 5. Go to Worker Settings > Triggers > Cron Triggers
 * 6. Add cron: *\/5 * * * * (every 5 minutes)
 * 7. Deploy
 *
 * Environment Variables:
 * - CRON_SECRET: Secret key to authenticate with backend
 * - API_URL: Backend API URL (default: https://antletters-api.onrender.com)
 */

const DEFAULT_API_URL = 'https://antletters-api.onrender.com';

export default {
  // Scheduled handler for cron triggers (every 5 minutes)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processQueue(env));
  },

  // HTTP handler for manual testing
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Manual trigger endpoint
    if (url.pathname === '/trigger') {
      const result = await processQueue(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Status endpoint
    if (url.pathname === '/status') {
      const result = await getQueueStats(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      name: 'ByteLetters Queue Processor',
      endpoints: {
        '/trigger': 'Manually trigger queue processing',
        '/status': 'Get queue statistics',
      },
      cron: 'Runs every 5 minutes automatically',
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

/**
 * Process the newsletter queue
 */
async function processQueue(env) {
  const apiUrl = env.API_URL || DEFAULT_API_URL;
  const cronSecret = env.CRON_SECRET || '';
  const startTime = Date.now();

  console.log(`[Queue Worker] Processing queue at ${new Date().toISOString()}`);

  try {
    const response = await fetch(`${apiUrl}/internal/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
        'User-Agent': 'ByteLetters-QueueProcessor/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`[Queue Worker] Completed in ${duration}ms:`, data);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      result: data,
    };
  } catch (error) {
    console.error(`[Queue Worker] Error:`, error.message);

    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Get queue statistics
 */
async function getQueueStats(env) {
  const apiUrl = env.API_URL || DEFAULT_API_URL;
  const cronSecret = env.CRON_SECRET || '';

  try {
    const response = await fetch(`${apiUrl}/internal/queue-stats`, {
      method: 'GET',
      headers: {
        'X-Cron-Secret': cronSecret,
        'User-Agent': 'ByteLetters-QueueProcessor/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      error: error.message,
    };
  }
}
