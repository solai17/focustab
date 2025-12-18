/**
 * Cloudflare Worker - Keep Backend Alive
 *
 * This worker pings the ByteLetters API every 14 minutes to prevent
 * Render's free tier from sleeping.
 *
 * SETUP:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Go to Worker Settings > Triggers > Cron Triggers
 * 5. Add cron: */14 * * * * (every 14 minutes)
 * 6. Deploy
 */

const API_URL = 'https://api.byteletters.app/health';

export default {
  // Scheduled handler for cron triggers
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pingBackend());
  },

  // HTTP handler for manual testing
  async fetch(request, env, ctx) {
    const result = await pingBackend();
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function pingBackend() {
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'ByteLetters-KeepAlive/1.0',
      },
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    console.log(`[Keep-Alive] Ping successful - ${latency}ms - Status: ${data.status}`);

    return {
      success: true,
      latency,
      timestamp: new Date().toISOString(),
      backend: data,
    };
  } catch (error) {
    console.error(`[Keep-Alive] Ping failed:`, error.message);

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
