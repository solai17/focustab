# ByteLetters Architecture v3.0 — "Curated Wisdom"

## Vision

ByteLetters delivers **curated wisdom from the world's best newsletters**—one byte at a time. Every new tab shows a carefully selected insight, quote, or takeaway from top newsletters, distilled by AI and voted on by the community.

### Core Value Proposition

> "Your time is finite. Make every moment count with curated wisdom from the world's best newsletters."

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ADMIN LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Admin Dashboard (admin.html)                                            │
│  ├── Add Newsletter Sources (with archive URLs)                          │
│  ├── Trigger Archive Scraping                                            │
│  ├── Moderate AI-Extracted Insights                                      │
│  └── Review Forwarded Emails (inbox@byteletters.app)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONTENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  NewsletterSource (isCurated=true)                                       │
│         │                                                                │
│         ├── Archive Scraper (Puppeteer) ──► Edition ──► ContentByte     │
│         │                                                                │
│         └── archiveUrl, scrapingEnabled, lastScrapedAt                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  User                                                                    │
│  ├── UserSubscription ──► Which sources they follow                      │
│  ├── UserEngagement ──► Votes, saves, shares                             │
│  ├── ContentHistory ──► What they've seen/read                           │
│  └── UserPreference ──► Category weights (learned)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## v3.0 Key Changes

### 1. Curated Content Model

**Previous (v2.0)**: Users forwarded their own newsletters to personal inbox emails.

**New (v3.0)**: Admin curates high-quality newsletter sources. Users subscribe to sources they want.

```
BEFORE (v2.0):
  User → forwards email → personal inbox → AI processing → their feed

AFTER (v3.0):
  Admin → adds source with archive URL → scraper runs → AI processing → moderation
  User → subscribes to sources → sees curated content from subscribed sources
```

### 2. Sources Screen (Extension)

Users can now browse and toggle newsletter subscriptions:

```
┌─────────────────────────────────────────────────────────────────┐
│  📚 Newsletter Sources                         [X] Close        │
├─────────────────────────────────────────────────────────────────┤
│  [All] [Wisdom] [Productivity] [Business] [Tech]                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [Logo]  Lenny's Newsletter                              │    │
│  │         Product management insights                     │    │
│  │         [productivity] 847 insights    [✓ Subscribed]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [Logo]  Naval Ravikant                                  │    │
│  │         Wealth & happiness wisdom                       │    │
│  │         [wisdom] 1,203 insights        [Subscribe]      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Admin Dashboard

Full admin panel at `/admin.html`:

- **Overview**: Stats on users, sources, insights, moderation queue
- **Sources**: Add/edit newsletter sources, configure scraping
- **Insights**: Moderate AI-extracted content (approve/reject)
- **Forwarded**: Review emails sent to `inbox@byteletters.app`
- **Scraping**: Monitor and trigger scrape jobs

### 4. Generic Inbox for Discovery

- `inbox@byteletters.app` — Single inbox for new newsletter discovery
- Forwarded emails go to admin review queue
- Admin can create sources from promising newsletters

---

## Database Schema v3.0

```
┌──────────────────────┐
│        User          │
├──────────────────────┤
│ id                   │
│ email                │
│ googleId             │
│ name                 │
│ birthDate            │
│ lifeExpectancy       │
│ inboxEmail (DEPRECATED)
│ isAdmin              │  ◄── NEW: Admin flag
│ enableRecommendations│
│ onboardingCompleted  │
└──────────────────────┘
         │
         │ 1:many
         ▼
┌──────────────────────┐         ┌──────────────────────┐
│  UserSubscription    │         │   UserEngagement     │
├──────────────────────┤         ├──────────────────────┤
│ userId               │         │ userId               │
│ sourceId             │         │ byteId               │
│ isActive             │         │ vote (+1/-1/0)       │
│ discoveryMethod      │         │ isSaved              │
│ subscribedAt         │         │ viewCount            │
└──────────────────────┘         │ totalDwellTimeMs     │
                                 └──────────────────────┘

┌──────────────────────┐
│  NewsletterSource    │
├──────────────────────┤
│ id                   │
│ name                 │
│ senderEmail          │
│ description          │
│ website              │
│ logoUrl              │
│ category             │
│ isCurated            │  ◄── NEW: Admin-curated flag
│ archiveUrl           │  ◄── NEW: URL for scraping
│ scrapingEnabled      │  ◄── NEW: Auto-scrape toggle
│ lastScrapedAt        │  ◄── NEW: Last scrape time
│ lastScrapeStatus     │  ◄── NEW: success/failed
│ subscriberCount      │
│ totalInsights        │
│ isVerified           │
└──────────────────────┘
         │
         │ 1:many
         ▼
┌──────────────────────┐
│      Edition         │
├──────────────────────┤
│ sourceId             │
│ subject              │
│ contentHash          │
│ rawContent           │
│ processingStatus     │  ◄── pending/processing/completed/failed
│ processedByModel     │  ◄── gemini-3-flash, claude-sonnet-4
└──────────────────────┘
         │
         │ 1:many
         ▼
┌──────────────────────┐
│    ContentByte       │
├──────────────────────┤
│ editionId            │
│ content              │
│ type                 │
│ author               │
│ category             │
│ qualityScore         │
│ engagementScore      │
│ moderationStatus     │  ◄── NEW: pending/approved/rejected
│ moderatedBy          │  ◄── NEW: Admin who moderated
│ moderatedAt          │  ◄── NEW: When moderated
│ rejectionReason      │  ◄── NEW: Why rejected
└──────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   ForwardedEmail     │  NEW    │     ScrapeJob        │  NEW
├──────────────────────┤         ├──────────────────────┤
│ fromEmail            │         │ sourceId             │
│ fromName             │         │ status               │
│ subject              │         │ editionsFound        │
│ contentHash          │         │ editionsNew          │
│ htmlContent          │         │ insightsCreated      │
│ status (pending/     │         │ errorMessage         │
│   approved/rejected) │         │ triggeredBy          │
│ reviewedBy           │         │ startedAt            │
│ createdSourceId      │         │ completedAt          │
└──────────────────────┘         └──────────────────────┘
```

---

## Content Flow

### Admin Content Pipeline

```
1. ADMIN ADDS SOURCE
   └── Admin enters newsletter name, archive URL, category
                    │
                    ▼
2. SCRAPER RUNS
   └── Puppeteer visits archive URL
   └── Extracts all newsletter edition links
   └── Downloads each edition HTML
                    │
                    ▼
3. AI PROCESSING
   └── Claude/Gemini extracts insights
   └── Each insight gets qualityScore (0-1)
   └── Saved as ContentByte with moderationStatus='pending'
                    │
                    ▼
4. ADMIN MODERATION
   └── Admin reviews in dashboard
   └── Approves high-quality insights
   └── Rejects low-quality/inappropriate content
                    │
                    ▼
5. AVAILABLE TO USERS
   └── Approved insights appear in user feeds
   └── Based on subscription + engagement
```

### User Content Flow

```
1. USER OPENS NEW TAB
                    │
                    ▼
2. FETCH /feed/next
   └── Get user's subscribed source IDs
   └── Query ContentBytes from those sources
   └── Filter: moderationStatus != 'rejected'
   └── Filter: Not in ContentHistory (read or interacted)
   └── Sort by qualityScore + engagementScore
   └── Apply diversity (max 2 per source)
                    │
                    ▼
3. DISPLAY BYTE
   └── Show insight with source attribution
   └── User can: upvote, downvote, save, share, next
                    │
                    ▼
4. TRACK ENGAGEMENT
   └── After 5 seconds active: mark as 'read'
   └── Record vote/save in UserEngagement
   └── Update ContentByte aggregate scores
```

---

## Feed Algorithm v3.0

### Primary Feed (Curated)

```typescript
async function getCuratedFeed(userId, excludeIds, sourceIds, limit) {
  // Only show content from:
  // 1. Sources user is subscribed to
  // 2. Sources marked as isCurated=true
  // 3. Insights not rejected by moderation

  const bytes = await prisma.contentByte.findMany({
    where: {
      id: { notIn: excludeIds },
      edition: {
        sourceId: { in: sourceIds },
        source: { isCurated: true },
      },
      moderationStatus: { not: 'rejected' },
    },
    orderBy: [
      { qualityScore: 'desc' },
      { engagementScore: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  // Diversity filter: max 2 per source
  return applyDiversityFilter(bytes, limit);
}
```

### Scoring Formula

```typescript
// Quality Score (AI-assigned, 0-1)
qualityScore = AIModel.scoreInsight(content)

// Engagement Score (community-driven)
engagementScore =
  (upvotes * 1.0) -
  (downvotes * 0.5) +
  (views * 0.01) +
  (saves * 2.0) +
  (shares * 3.0)

// Feed Ranking
feedScore = (qualityScore * 0.4) + (normalizedEngagement * 0.4) + (recencyBoost * 0.2)
```

---

## API Routes v3.0

### Authentication (`/auth`)
```
POST /auth/google     - Chrome Identity authentication
POST /auth/signup     - Email/password signup
POST /auth/login      - Email/password login
GET  /auth/me         - Get current user
PUT  /auth/profile    - Update profile
```

### Feed (`/feed`)
```
GET  /feed            - Get personalized feed
GET  /feed/next       - Get next byte (new tab)
POST /feed/bytes/:id/vote  - Vote on byte
POST /feed/bytes/:id/view  - Track view + read status
POST /feed/bytes/:id/save  - Toggle save
GET  /feed/saved      - Get saved bytes
```

### Newsletters (`/newsletters`) — NEW
```
GET  /newsletters                   - List curated sources with subscription status
GET  /newsletters/subscribed        - Get user's subscribed sources
POST /newsletters/:id/subscribe     - Subscribe to source
POST /newsletters/:id/unsubscribe   - Unsubscribe from source
POST /newsletters/subscribe-all     - Subscribe to all (onboarding)
```

### Admin (`/admin`) — NEW (Protected)
```
GET  /admin/stats                   - Dashboard statistics
GET  /admin/sources                 - List all sources with stats
POST /admin/sources                 - Create new source
PATCH /admin/sources/:id            - Update source
DELETE /admin/sources/:id           - Delete source (with confirmation)

GET  /admin/insights                - List insights for moderation
POST /admin/insights/:id/moderate   - Approve/reject insight
POST /admin/insights/bulk-moderate  - Bulk approve/reject

GET  /admin/forwarded               - List forwarded emails
POST /admin/forwarded/:id/review    - Review forwarded email

GET  /admin/scrape/jobs             - List scrape jobs
POST /admin/scrape/trigger          - Trigger scrape for source

POST /admin/cleanup/users           - Fresh start (delete all users)
```

### Webhooks (`/webhooks`)
```
POST /webhooks/cloudflare  - Cloudflare Email Worker webhook
POST /webhooks/mailgun     - Mailgun webhook (legacy)
```

---

## Security Model

### Admin Authentication

```typescript
// Admin whitelist (environment variable in production)
const ADMIN_EMAILS = ['admin@byteletters.app'];

async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });

  // Check whitelist OR isAdmin flag
  const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdmin;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Auto-upgrade whitelisted users
  if (ADMIN_EMAILS.includes(user.email) && !user.isAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }

  next();
}
```

### Rate Limiting

| Route | Limit | Window |
|-------|-------|--------|
| `/auth/*` | 10 | 1 minute |
| `/feed/*` | 200 | 1 minute |
| `/admin/*` | 100 | 1 minute |
| `/newsletters/*` | 60 | 1 minute |

---

## Extension Components

```
extension/src/
├── App.tsx                 # Main app with routing
├── components/
│   ├── ByteCard.tsx        # Single byte display with engagement
│   ├── Sources.tsx         # NEW: Newsletter subscription UI
│   ├── MortalityBar.tsx    # Life progress visualization
│   ├── Settings.tsx        # User preferences
│   └── Onboarding.tsx      # New user flow
├── services/
│   ├── api.ts              # API client
│   └── auth.ts             # Chrome Identity auth
└── types/
    └── index.ts            # TypeScript interfaces
```

### Sources Component

```typescript
// Browse and toggle newsletter subscriptions
function Sources({ onClose }) {
  const [newsletters, setNewsletters] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch curated newsletters with subscription status
  useEffect(() => {
    fetch('/newsletters', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setNewsletters(data.newsletters));
  }, []);

  // Toggle subscription
  const toggleSubscription = async (newsletter) => {
    const endpoint = newsletter.isSubscribed ? 'unsubscribe' : 'subscribe';
    await fetch(`/newsletters/${newsletter.id}/${endpoint}`, { method: 'POST' });
    // Update local state
  };

  return (
    <Modal>
      <CategoryTabs categories={['all', 'wisdom', 'productivity', ...]} />
      <NewsletterList
        newsletters={newsletters}
        onToggle={toggleSubscription}
      />
    </Modal>
  );
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Email Workers                    │  Pages                               │
│  └── inbox@byteletters.app        │  └── byteletters.app                │
│  └── *@inbox.byteletters.app      │      ├── index.html (landing)       │
│      │                            │      └── admin.html (dashboard)     │
│      ▼                            │                                      │
│  POST /webhooks/cloudflare        │                                      │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RAILWAY                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  API Server (api.byteletters.app)                                        │
│  └── Node.js + Express + Prisma                                          │
│  └── /auth, /feed, /newsletters, /admin, /webhooks                       │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                                     │
│  └── Users, Sources, Editions, ContentBytes, Subscriptions               │
│  └── ForwardedEmails, ScrapeJobs                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics v3.0

| Metric | Description | Target |
|--------|-------------|--------|
| **DAU** | Daily active users | Growth |
| **Bytes/Session** | Insights consumed per session | 5+ |
| **Subscription Rate** | Users who customize sources | 40%+ |
| **Engagement Rate** | Bytes with votes | 20%+ |
| **Quality Score Avg** | AI quality of content | 0.7+ |
| **Moderation Queue** | Pending insights | <100 |

---

## Future Roadmap

### Phase 4: Enhanced Scraping
- [ ] Scheduled scraping (daily/weekly per source)
- [ ] Scraper health monitoring
- [ ] Automatic retry with backoff

### Phase 5: AI Quality Scoring
- [ ] Batch score existing insights
- [ ] Auto-reject low-quality (<0.3 score)
- [ ] Learn from moderation decisions

### Phase 6: Advanced Features
- [ ] User-generated collections
- [ ] Social sharing with attribution
- [ ] Creator analytics dashboard
- [ ] Premium tier (early access, no ads)
