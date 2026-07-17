# ByteLetters

**Byte-sized wisdom, every tab.**

ByteLetters is a Chrome extension that turns every new tab into a moment of insight. It curates the world's best newsletters, uses AI to distill each edition into standalone "bytes" of wisdom, and serves you one every time you open a tab — alongside a gentle reminder of how many weeks of life remain to spend well.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## Features

### For Users

- **Instant new tabs** — bytes render from a locally cached queue; no waiting on the network
- **Curated library** — hand-picked newsletters (James Clear, Farnam Street, Naval Ravikant, Sahil Bloom), each AI-extracted and quality-audited
- **Your sources, your feed** — toggle newsletters on/off; the feed updates immediately
- **Recommend newsletters** — suggest sources (with topic tags) right from the extension
- **The Ritual** — every tab opens with "Make week #N count" and your remaining weeks
- **Value streak** — counts bytes actually read (never breaks, only grows), synced live across all open tabs, with milestones ("1,000 bytes ≈ 100 newsletters distilled")
- **Save & vote** — bookmark the best bytes, upvote/downvote to tune quality

### For Admins (`/admin.html`)

- **Email/password login** — bcrypt-hashed credentials, admin-only access
- **Source management** — add/edit/delete newsletters, set scraping schedules
- **One-click scraping** — incremental, paginated archive scraping runs inside the backend with live job logs; capped runs auto-continue; Deep scan backfills gaps
- **Scheduled scraping** — per-source daily/weekly schedules, checked hourly
- **Insight curation** — expandable insight cards, hide/show from users, AI quality audit
- **Recommendation review** — user-suggested newsletters arrive as drafts (scraping off) for audit before joining the curated list

---

## Architecture

```
byteletters/
├── extension/           # Chrome Extension (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/  # ByteCard, MortalityBar (Ritual hero), Sources, Settings, Onboarding
│   │   ├── services/    # API client, auth (Chrome Identity)
│   │   ├── data/        # Milestone ladder, offline fallback bytes
│   │   └── utils/       # Cross-tab storage (streak sync, byte queue)
│   └── public/          # Manifest, icons
│
├── backend/             # API Server (Node.js + Express + Prisma)
│   ├── src/
│   │   ├── routes/      # auth, feed, newsletters, admin, public, internal
│   │   ├── services/    # AI extraction (Claude), scraper, scrape scheduler
│   │   └── middleware/  # JWT auth, rate limiting, security headers
│   ├── scripts/         # Local Puppeteer scraper, quality audit, admin seed
│   └── prisma/          # Database schema (PostgreSQL)
│
└── landing/             # Landing page + admin dashboard (Cloudflare Pages)
    ├── index.html       # byteletters.app
    └── admin.html       # Admin dashboard
```

---

## How Content Flows

```
Curated newsletter archives
        ↓
Scraper (in-server incremental, or local Puppeteer for JS-heavy sites)
        ↓
AI extraction (Claude Sonnet 5) — insights, quotes, takeaways
        ↓
AI quality audit — low-quality bytes deleted, the rest scored
        ↓
User feed — randomized among top-quality bytes, never repeats,
            only from sources the user switched on
```

Users can recommend newsletters from the extension; admins review them as drafts, audit content quality, then enable curation + scheduled scraping.

---

## Quick Start

### Extension Development

```bash
cd extension
npm install
npm run build
```

Load in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/dist`

### Backend Development

```bash
cd backend
npm install
# Create .env with the variables below
npx prisma db push
npm run dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/byteletters"
JWT_SECRET="a-long-random-string"        # required in production
ANTHROPIC_API_KEY="sk-ant-..."           # AI extraction + audit
INTERNAL_CRON_SECRET="..."               # protects /internal endpoints in production
```

### Useful Scripts (backend)

```bash
npm run scrape                 # Full Puppeteer scrape of all curated sources
npm run scrape -- james        # Scrape one source
npm run audit                  # AI quality audit of unaudited bytes
npm run audit:dry              # Audit preview (no deletions)
ADMIN_PASSWORD=... npm run seed:admin   # Create/reset the admin login
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Extension | React 19, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | PostgreSQL (Supabase) |
| AI | Claude Sonnet 5 (Anthropic) |
| Scraping | axios + cheerio (in-server), Puppeteer (local CLI) |
| Hosting | Render (API), Cloudflare Pages (landing + admin) |

---

## API Endpoints

### Public (no auth)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/public/showcase` | GET | Top-performing bytes for the landing page |
| `/health` | GET | Health check |

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | POST | Chrome Identity auth (extension) |
| `/auth/admin-login` | POST | Email/password admin login |
| `/auth/me` | GET | Current user |
| `/auth/profile` | PUT | Update profile |

### Feed (extension)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/feed/next` | GET | Next byte (`?exclude=` for session dedup) |
| `/feed/stats` | GET | Value-streak counters (today / all-time) |
| `/feed/saved` | GET | Saved bytes |
| `/feed/bytes/:id/vote` | POST | Upvote/downvote |
| `/feed/bytes/:id/view` | POST | Track view + read status |
| `/feed/bytes/:id/save` | POST | Toggle save |
| `/feed/recommend-newsletter` | POST | Suggest a newsletter (name, URL, tags) |

### Newsletters (sources)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/newsletters` | GET | Curated newsletters with live insight counts |
| `/newsletters/:id/subscribe` | POST | Switch a source on |
| `/newsletters/:id/unsubscribe` | POST | Switch a source off |

### Admin (protected)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/stats` | GET | Dashboard statistics |
| `/admin/sources` | GET/POST/PATCH/DELETE | Manage sources (freshness, schedules) |
| `/admin/insights` | GET | Insights with visibility/audit filters |
| `/admin/insights/:id/visibility` | POST | Hide/show an insight |
| `/admin/scrape/trigger` | POST | Run an incremental scrape (`deep` for full scan) |
| `/admin/scrape/jobs` | GET | Job history (`/:id` for full logs) |
| `/admin/recommendations` | GET | User-suggested newsletters |
| `/admin/recommendations/:id/approve` | POST | Add as draft source |

---

## Database Schema

### Core Models
- **User** — auth, profile, admin flag
- **NewsletterSource** — metadata, curation flag, scraping config + schedule
- **Edition** — individual newsletter issues (deduped by content hash)
- **ContentByte** — extracted insights with quality score, audit + visibility flags
- **UserSubscription** — user ↔ source toggles
- **UserEngagement** — votes, saves, view counts
- **ContentHistory** — read tracking (powers dedup + the value streak)

### Operations Models
- **NewsletterRecommendation** — user-suggested sources with topic tags
- **ScrapeJob** — scraping runs with progress logs

---

## Support the Project

ByteLetters is free and open source, but the AI extraction, quality audits, and hosting cost real money. If it makes your new tabs wiser:

☕ **[Buy me a coffee](https://buymeacoffee.com/solai)**

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- **Website**: [byteletters.app](https://byteletters.app)
- **Support**: hello@byteletters.app
- **Buy me a coffee**: [buymeacoffee.com/solai](https://buymeacoffee.com/solai)
