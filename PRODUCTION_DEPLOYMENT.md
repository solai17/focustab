# ByteLetters Production Deployment Guide

## Overview

Complete guide for deploying ByteLetters v3.0 with:
- Chrome extension with Sources screen
- API server with admin dashboard
- Cloudflare Email Workers for newsletter ingestion
- PostgreSQL database on Supabase

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Chrome Ext    │────▶│   Render API    │────▶│    Supabase     │
│  (Web Store)    │     │ antletters-api  │     │   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
                               │
┌─────────────────┐     ┌──────┴──────────┐
│ Cloudflare Email│────▶│ /webhooks/      │
│    Workers      │     │ cloudflare      │
└─────────────────┘     └─────────────────┘

┌─────────────────┐
│ Cloudflare Pages│
│ byteletters.app │
│ ├── index.html  │
│ └── admin.html  │
└─────────────────┘
```

---

## 1. Prerequisites

### Required Accounts
| Service | Purpose | URL |
|---------|---------|-----|
| Google Cloud | Chrome Identity OAuth | console.cloud.google.com |
| Supabase | PostgreSQL database | supabase.com |
| Render | API hosting | render.com |
| Cloudflare | Email Workers, Pages | cloudflare.com |
| Chrome Developer | Extension publishing | chrome.google.com/webstore/devconsole |

### Required Tools
```bash
node >= 18.0.0
npm >= 9.0.0
```

---

## 2. Database Setup (Supabase)

### Step 1: Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project in your preferred region
3. Wait for database provisioning (~2 minutes)

### Step 2: Get Connection String
1. Go to **Settings → Database**
2. Copy **Connection string** (URI format)
3. Use "Transaction" pooler mode for serverless

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Step 3: Run Migrations
```bash
cd backend
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy
npx prisma generate
```

---

## 3. Backend Deployment (Render)

### Step 1: Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
JWT_SECRET="$(openssl rand -base64 32)"

# AI Processing
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# Email Webhooks
CLOUDFLARE_WEBHOOK_SECRET="your-webhook-secret"

# Admin (comma-separated emails)
ADMIN_EMAILS="your-email@gmail.com"

# Environment
NODE_ENV="production"
PORT="3000"
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and create a new Web Service
2. Connect your GitHub repository
3. Configure:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
   - Environment: Set all environment variables above

### Step 3: Get Service URL
Your service URL will be: `https://antletters-api.onrender.com`

---

## 4. Cloudflare Email Workers

### Step 1: Deploy Worker

```bash
cd cloudflare-worker
npm install

# Set secrets
npx wrangler secret put WEBHOOK_SECRET
# Enter your CLOUDFLARE_WEBHOOK_SECRET value

# Deploy
npm run deploy
```

### Step 2: Configure Email Routing

1. Go to Cloudflare Dashboard → your domain
2. **Email → Email Routing**
3. Enable Email Routing
4. Add routes:

| Route | Action |
|-------|--------|
| `inbox@byteletters.app` | Worker: byteletters-email |
| `*@inbox.byteletters.app` | Worker: byteletters-email |

### Step 3: Verify DNS
Cloudflare will add MX records automatically. Verify they're active.

---

## 5. Cloudflare Pages (Landing + Admin)

### Step 1: Deploy Landing Page

```bash
cd landing

# Install Wrangler if needed
npm install -g wrangler

# Deploy
npx wrangler pages deploy . --project-name=byteletters
```

### Step 2: Configure Domain
1. Go to Cloudflare Dashboard → Pages → byteletters
2. Custom domains → Add `byteletters.app`
3. Follow DNS configuration

### Files Deployed:
- `index.html` — Landing page
- `admin.html` — Admin dashboard
- `privacy.html` — Privacy policy
- `setup-guide.html` — User setup guide (legacy)

---

## 6. Chrome Extension

### Step 1: Update Configuration

Update `extension/public/manifest.json`:
```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

The extension is pre-configured to use:
```typescript
const API_BASE_URL = 'https://antletters-api.onrender.com';
```

### Step 2: Build Extension
```bash
cd extension
npm install
npm run build
```

### Step 3: Create ZIP
```bash
cd dist
zip -r ../byteletters-v1.1.0.zip .
```

### Step 4: Upload to Chrome Web Store
1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find ByteLetters → click to edit
3. **Package** tab → Upload new package
4. Upload `byteletters-v1.1.0.zip`
5. Update version number in store listing
6. Submit for review

---

## 7. API Endpoints Reference

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/google` | POST | No | Chrome Identity auth |
| `/auth/me` | GET | Yes | Get current user |
| `/auth/profile` | PUT | Yes | Update profile |

### Feed
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/feed/next` | GET | Yes | Get next byte |
| `/feed/saved` | GET | Yes | Get saved bytes |
| `/feed/bytes/:id/vote` | POST | Yes | Vote on byte |
| `/feed/bytes/:id/view` | POST | Yes | Track view |
| `/feed/bytes/:id/save` | POST | Yes | Toggle save |

### Newsletters (v3.0)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/newsletters` | GET | Yes | List curated sources |
| `/newsletters/:id/subscribe` | POST | Yes | Subscribe |
| `/newsletters/:id/unsubscribe` | POST | Yes | Unsubscribe |

### Admin (v3.0)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/stats` | GET | Admin | Dashboard stats |
| `/admin/sources` | GET/POST | Admin | Manage sources |
| `/admin/insights` | GET | Admin | Moderation queue |
| `/admin/insights/:id/moderate` | POST | Admin | Approve/reject |
| `/admin/forwarded` | GET | Admin | Forwarded emails |
| `/admin/scrape/trigger` | POST | Admin | Trigger scrape |

### Webhooks
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/webhooks/cloudflare` | POST | Secret | Email ingestion |

---

## 8. Admin Dashboard

### Access
1. Go to `https://byteletters.app/admin.html`
2. Sign in with Google (must be in ADMIN_EMAILS list)
3. Dashboard loads with full management capabilities

### Features
- **Overview**: User count, source count, insights, pending moderation
- **Sources**: Add newsletters with archive URLs, configure scraping
- **Insights**: Approve/reject AI-extracted content
- **Forwarded**: Review emails sent to `inbox@byteletters.app`
- **Scraping**: Monitor scrape jobs, trigger manual scrapes

---

## 9. Security Checklist

### Implemented
- [x] JWT authentication (30-day expiry)
- [x] Rate limiting per route
- [x] CORS configuration
- [x] Security headers (Helmet)
- [x] Admin whitelist authentication
- [x] Webhook secret verification
- [x] Input validation
- [x] SQL injection protection (Prisma)

### Recommendations
- [ ] Enable Redis for distributed rate limiting
- [ ] Set up error monitoring (Sentry)
- [ ] Configure database backups
- [ ] Add API versioning (/v1/...)
- [ ] Enable CDN caching for static responses

---

## 10. Monitoring & Maintenance

### Recommended Tools
| Category | Tool |
|----------|------|
| Error Tracking | Sentry |
| Logging | Papertrail, LogDNA |
| Uptime | UptimeRobot |
| Analytics | PostHog, Mixpanel |

### Database Maintenance
```bash
# Weekly vacuum (Supabase does this automatically)
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check table sizes
psql $DATABASE_URL -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
"
```

### Log Monitoring
```bash
# Render logs - check in Render dashboard

# Cloudflare Worker logs
npx wrangler tail
```

---

## 11. Troubleshooting

### Common Issues

**Extension not loading bytes**
1. Check API is reachable: `curl https://antletters-api.onrender.com/health`
2. Verify user has subscriptions in Sources
3. Check browser console for errors

**Admin dashboard not loading**
1. Verify your email is in ADMIN_EMAILS
2. Check API authentication working
3. Clear browser cache and re-authenticate

**Emails not being processed**
1. Check Cloudflare Email Routing is active
2. Verify webhook secret matches
3. Check Render logs for webhook errors

**Scraping failing**
1. Check archive URL is accessible
2. Verify Puppeteer dependencies installed
3. Check for rate limiting from source

---

## 12. Quick Reference

### Deploy Commands
```bash
# Backend (Render)
# Deploy via Render dashboard or git push

# Cloudflare Worker
cd cloudflare-worker && npm run deploy

# Landing Page
cd landing && npx wrangler pages deploy .

# Extension
cd extension && npm run build
# Upload dist/ to Chrome Web Store
```

### Environment Variables Summary
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random-32-chars>
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
CLOUDFLARE_WEBHOOK_SECRET=...
ADMIN_EMAILS=admin@example.com
NODE_ENV=production
```

---

## Support

- **Documentation**: See ARCHITECTURE.md
- **Issues**: GitHub Issues
- **Email**: hello@byteletters.app
