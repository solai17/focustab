# ByteLetters Email Worker

Cloudflare Email Worker that receives newsletters and forwards them to the ByteLetters API for processing.

## Overview

This worker handles two types of incoming emails:

1. **Generic Inbox** (`inbox@byteletters.app`)
   - Emails go to admin review queue
   - Admin can create newsletter sources from submissions

2. **Legacy Personal Inboxes** (`*@inbox.byteletters.app`)
   - For existing users with personal inbox emails (deprecated in v3.0)
   - Processed directly into user's feed

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure

Update `wrangler.toml` if your API URL differs:
```toml
[vars]
API_URL = "https://antletters-api.onrender.com"
```

### 3. Set Secrets
```bash
# Webhook authentication secret (must match backend CLOUDFLARE_WEBHOOK_SECRET)
npx wrangler secret put WEBHOOK_SECRET
```

### 4. Deploy
```bash
npm run deploy
```

### 5. Configure Email Routing in Cloudflare

1. Go to **Cloudflare Dashboard → Email → Email Routing**
2. Enable Email Routing for your domain
3. Create routes:

| Route Pattern | Action |
|--------------|--------|
| `inbox@byteletters.app` | Send to Worker → byteletters-email |
| `*@inbox.byteletters.app` | Send to Worker → byteletters-email |

## How It Works

```
Email arrives at inbox@byteletters.app
                │
                ▼
┌─────────────────────────────────┐
│   Cloudflare Email Worker       │
├─────────────────────────────────┤
│ 1. Parse email (sender, subject,│
│    HTML content)                │
│ 2. Extract text from HTML       │
│ 3. POST to /webhooks/cloudflare │
└─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│   ByteLetters API               │
├─────────────────────────────────┤
│ inbox@byteletters.app:          │
│   → Save to ForwardedEmail      │
│   → Admin reviews in dashboard  │
│                                 │
│ Legacy personal inbox:          │
│   → Find user by inboxEmail     │
│   → Create Edition              │
│   → Queue for AI processing     │
└─────────────────────────────────┘
```

## Payload Format

The worker sends this JSON to the API:

```json
{
  "recipient": "inbox@byteletters.app",
  "sender": "newsletter@example.com",
  "senderName": "Example Newsletter",
  "subject": "Weekly Update #42",
  "htmlContent": "<html>...</html>",
  "textContent": "Plain text version...",
  "receivedAt": "2025-01-15T10:30:00Z"
}
```

## Development

### Local Testing
```bash
npm run dev
```

Note: Email routing can't be fully tested locally. Use `wrangler tail` to debug in production.

### View Logs
```bash
npm run tail
```

### Check Deployment
```bash
npx wrangler deployments list
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_URL` | ByteLetters API URL (default: antletters-api.onrender.com) |
| `WEBHOOK_SECRET` | Shared secret for webhook authentication |

## Troubleshooting

### Emails not arriving
1. Check Email Routing is enabled in Cloudflare
2. Verify MX records are configured
3. Check worker logs with `npm run tail`

### API rejecting requests
1. Verify WEBHOOK_SECRET matches backend
2. Check API is reachable
3. Review Railway logs for errors

### Rate limiting
Cloudflare Email Workers have limits:
- 100,000 emails/day (free tier)
- No per-second limits

## Related Files

- `src/index.ts` — Main worker code
- `wrangler.toml` — Cloudflare configuration
- `package.json` — Dependencies

## v3.0 Changes

- Added support for generic inbox (`inbox@byteletters.app`)
- Generic inbox emails saved to ForwardedEmail table for admin review
- Legacy personal inboxes still supported for backward compatibility
