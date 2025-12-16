# FocusTab Production Deployment Guide

## Overview

This guide covers deploying FocusTab to production with:
- Secure user authentication via Chrome Identity
- PostgreSQL database
- Scalable API with rate limiting
- Chrome extension with cross-device sync

---

## 1. Prerequisites

### Required Accounts
- **Google Cloud Console** - For Chrome extension OAuth
- **Database Provider** - Supabase, Railway, Neon, or AWS RDS (PostgreSQL)
- **Hosting Platform** - Railway, Render, Fly.io, or AWS/GCP
- **Domain** - For production API and Mailgun

### Required Tools
```bash
node >= 18.0.0
npm >= 9.0.0
```

---

## 2. Google Cloud Setup (Chrome Identity)

### Step 1: Create Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: "FocusTab"
3. Enable the **Chrome Web Store API**

### Step 2: Configure OAuth Consent Screen
1. Go to APIs & Services → OAuth consent screen
2. Choose "External" user type
3. Fill in app information:
   - App name: FocusTab
   - User support email: your email
   - Developer contact: your email

### Step 3: Create OAuth Client ID
1. Go to APIs & Services → Credentials
2. Create Credentials → OAuth client ID
3. Application type: **Chrome Extension**
4. Enter your extension ID (from chrome://extensions in developer mode)
5. Copy the **Client ID**

### Step 4: Update Extension Manifest
In `extension/public/manifest.json`, replace:
```json
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["openid", "email", "profile"]
}
```

---

## 3. Database Setup (PostgreSQL)

### Option A: Supabase (Recommended for startups)
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy the connection string (use "Transaction" mode for serverless)

### Option B: Railway
1. Create account at [railway.app](https://railway.app)
2. New Project → Add PostgreSQL
3. Copy the connection string from Variables tab

### Option C: Neon (Serverless PostgreSQL)
1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string

### Database URL Format
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

---

## 4. Backend Deployment

### Step 1: Environment Variables
Create production `.env`:
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="$(openssl rand -base64 32)"
CLAUDE_API_KEY="sk-ant-..."
NODE_ENV=production
PORT=3000
```

### Step 2: Run Database Migrations
```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

### Step 3: Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Step 4: Deploy to Render
1. Connect GitHub repo
2. Set environment variables
3. Build command: `npm install && npx prisma generate`
4. Start command: `npm start`

### Step 5: Deploy to Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly secrets set DATABASE_URL="..."
fly secrets set JWT_SECRET="..."
fly deploy
```

---

## 5. API Security Checklist

### ✅ Implemented
- [x] Rate limiting (10/min auth, 100/min general, 200/min feed)
- [x] JWT authentication with 30-day expiry
- [x] Security headers (Helmet)
- [x] CORS configuration
- [x] Input validation
- [x] SQL injection protection
- [x] XSS protection
- [x] Password hashing (bcrypt, cost 12)

### 🔧 Production Recommendations
- [ ] Add Redis for distributed rate limiting
- [ ] Enable HTTPS only
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure CDN (Cloudflare)
- [ ] Set up database backups
- [ ] Add API versioning (/v1/...)

---

## 6. Extension Publishing

### Step 1: Build Extension
```bash
cd extension
npm run build
```

### Step 2: Package for Chrome Web Store
1. Zip the `dist` folder
2. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay one-time $5 developer fee
4. Upload zip file
5. Fill in store listing details
6. Submit for review

### Store Listing Tips
- **Name**: FocusTab - Life, Goals & Wisdom
- **Category**: Productivity
- **Screenshots**: 1280x800 or 640x400
- **Promo tile**: 440x280

---

## 7. Environment Configuration

### Development
```env
DATABASE_URL="postgresql://focustab:focustab123@localhost:5432/focustab"
JWT_SECRET="dev-secret-not-for-production"
NODE_ENV=development
```

### Production
```env
DATABASE_URL="postgresql://user:pass@prod-host:5432/focustab?sslmode=require"
JWT_SECRET="<32+ char secure random string>"
NODE_ENV=production
```

---

## 8. API Endpoints Reference

### Authentication
| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/auth/google` | POST | No | 10/min | Chrome Identity auth |
| `/auth/signup` | POST | No | 10/min | Email/password signup |
| `/auth/login` | POST | No | 10/min | Email/password login |
| `/auth/me` | GET | Yes | 10/min | Get current user |
| `/auth/profile` | PUT | Yes | 10/min | Update profile |

### Feed (Requires Auth)
| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/feed` | GET | Yes | 200/min | Get personalized feed |
| `/feed/next` | GET | Yes | 200/min | Get next byte |
| `/feed/bytes/:id/vote` | POST | Yes | 60/min | Vote on byte |
| `/feed/bytes/:id/view` | POST | Yes | 200/min | Track view |
| `/feed/saved` | GET | Yes | 100/min | Get saved bytes |

### Discovery
| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/discover/sources` | GET | Yes | 100/min | Browse sources |
| `/discover/trending` | GET | Yes | 100/min | Trending content |
| `/discover/onboarding` | GET | No | 100/min | Onboarding content |

---

## 9. Scaling Considerations

### Database
- Use connection pooling (PgBouncer or Prisma Data Proxy)
- Add read replicas for high traffic
- Index frequently queried columns (already done in schema)

### API
- Deploy multiple instances behind load balancer
- Use Redis for rate limiting across instances
- Cache popular content (trending, discovery)

### Estimated Capacity (Single Instance)
- ~1000 concurrent users
- ~100 requests/second
- Scale horizontally as needed

---

## 10. Monitoring & Maintenance

### Recommended Tools
- **Error Tracking**: Sentry
- **Logging**: Papertrail, LogDNA
- **Uptime**: UptimeRobot, Pingdom
- **Analytics**: PostHog, Mixpanel

### Database Maintenance
```bash
# Vacuum and analyze (run weekly)
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check table sizes
psql $DATABASE_URL -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

---

## Quick Start Commands

```bash
# Clone and setup
git clone <repo>
cd focustab/backend

# Install dependencies
npm install

# Setup database
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy
npx prisma generate

# Start production server
NODE_ENV=production npm start
```

---

## Support

For issues or questions:
- GitHub Issues: [repo]/issues
- Documentation: [docs-url]
