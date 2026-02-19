# ByteLetters

**Curated wisdom from the world's best newsletters, delivered one byte at a time.**

ByteLetters is a Chrome extension that transforms your new tab into a source of daily inspiration. Every time you open a new tab, you'll see a carefully curated insight, quote, or takeaway from top newsletters—distilled by AI, voted on by the community.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID?style=flat-square)](https://chrome.google.com/webstore/detail/byteletters/YOUR_EXTENSION_ID)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## Features

### For Users

- **Curated Content** — Hand-picked newsletters, AI-extracted insights
- **Sources Screen** — Browse and subscribe to newsletters you love
- **Mortality Bar** — Visual reminder of your finite time (optional)
- **Save & Share** — Bookmark insights, copy quotes to clipboard
- **Community Voting** — Upvote/downvote to surface the best content
- **Smart Read Tracking** — Never see the same byte twice

### For Admins

- **Admin Dashboard** — Full control at `/admin.html`
- **Newsletter Management** — Add sources, configure archive scraping
- **Content Moderation** — Approve/reject AI-extracted insights
- **Scraping Jobs** — Monitor archive scraping status
- **Forwarded Emails** — Review submissions to `inbox@byteletters.app`

---

## Architecture

```
byteletters/
├── extension/           # Chrome Extension (React + TypeScript)
│   ├── src/
│   │   ├── components/  # ByteCard, Sources, Settings, Onboarding
│   │   ├── services/    # API client, auth
│   │   └── types/       # TypeScript interfaces
│   └── public/          # Manifest, icons
│
├── backend/             # API Server (Node.js + Express)
│   ├── src/
│   │   ├── routes/      # auth, feed, newsletters, admin, webhooks
│   │   ├── services/    # AI processing, database, scraping
│   │   └── middleware/  # Auth, rate limiting, security
│   └── prisma/          # Database schema (PostgreSQL)
│
├── cloudflare-worker/   # Email ingestion worker
│
├── landing/             # Landing page + admin dashboard
│   └── admin.html       # Admin dashboard UI
│
└── scrapers/            # Newsletter archive scrapers
```

---

## Quick Start

### Extension Development

```bash
cd extension
npm install
npm run dev
```

Load in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/dist`

### Backend Development

```bash
cd backend
npm install
cp .env.example .env  # Configure environment variables
npx prisma migrate dev
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/byteletters"

# Authentication
JWT_SECRET="your-secure-jwt-secret"

# AI Processing
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# Email (Cloudflare Workers)
CLOUDFLARE_WEBHOOK_SECRET="your-webhook-secret"
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Extension | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | PostgreSQL (Supabase) |
| AI | Claude (Anthropic), Gemini (Google) |
| Email | Cloudflare Email Workers |
| Hosting | Railway (API), Cloudflare Pages (Landing) |

---

## Key Concepts

### Curated Content Model (v3.0)

ByteLetters operates on a **curated content model**:

1. **Admin-Curated Sources** — Only newsletters marked as `isCurated` appear to users
2. **Subscription-Based Feed** — Users only see bytes from newsletters they're subscribed to
3. **Quality Scoring** — AI scores each insight; low-quality content is filtered
4. **Community Moderation** — Downvoted content is deprioritized

### Content Flow

```
Newsletter Archive
       ↓
   Scraper (Puppeteer)
       ↓
   AI Processing (Claude/Gemini)
       ↓
   Content Moderation (Admin)
       ↓
   User Feed (Extension)
```

### User Subscription Flow

```
New User Signs Up
       ↓
   Auto-subscribed to all curated newsletters
       ↓
   User customizes via Sources screen
       ↓
   Feed shows only subscribed sources
```

---

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | POST | Chrome Identity auth |
| `/auth/me` | GET | Get current user |
| `/auth/profile` | PUT | Update profile |

### Feed
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/feed/next` | GET | Get next byte for new tab |
| `/feed/saved` | GET | Get saved bytes |
| `/feed/bytes/:id/vote` | POST | Upvote/downvote |
| `/feed/bytes/:id/view` | POST | Track view + read status |
| `/feed/bytes/:id/save` | POST | Toggle save |

### Newsletters (Sources)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/newsletters` | GET | List curated newsletters |
| `/newsletters/:id/subscribe` | POST | Subscribe to source |
| `/newsletters/:id/unsubscribe` | POST | Unsubscribe from source |

### Admin (Protected)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/stats` | GET | Dashboard statistics |
| `/admin/sources` | GET/POST | Manage newsletter sources |
| `/admin/insights` | GET | List insights for moderation |
| `/admin/insights/:id/moderate` | POST | Approve/reject insight |
| `/admin/scrape/trigger` | POST | Trigger archive scrape |

---

## Database Schema (v3.0)

### Core Models

- **User** — Authentication, preferences, admin flag
- **NewsletterSource** — Newsletter metadata, scraping config
- **Edition** — Individual newsletter issues
- **ContentByte** — Extracted insights (the "bytes")
- **UserSubscription** — User ↔ Source relationships
- **UserEngagement** — Votes, saves, shares
- **ContentHistory** — Read tracking

### Admin Models

- **ForwardedEmail** — Emails sent to `inbox@byteletters.app`
- **ScrapeJob** — Archive scraping job logs

---

## Deployment

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for detailed instructions.

### Quick Deploy

```bash
# Backend (Railway)
cd backend
railway up

# Run migrations
npx prisma migrate deploy

# Extension (Chrome Web Store)
cd extension
npm run build
# Upload dist/ to Chrome Developer Dashboard
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- **Website**: [byteletters.app](https://byteletters.app)
- **Chrome Extension**: [Chrome Web Store](https://chrome.google.com/webstore/detail/byteletters/YOUR_ID)
- **Support**: hello@byteletters.app
