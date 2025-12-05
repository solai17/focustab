# FocusTab Architecture v2.0 - "Reels for Text"

## Vision

Transform FocusTab from a personal newsletter reader into a **social content discovery platform** that delivers bite-sized wisdom every time you open a new tab. Think "Twitter meets Reels meets Newsletter Digest" - curated bytes of valuable content with social engagement.

### Core Value Proposition
> "Your time is finite (mortality bar). Make every moment count with curated wisdom from the world's best newsletters."

---

## Key Architectural Changes

### 1. Content-Centric (Not User-Centric) Storage

**Problem**: If 1000 users forward Lenny's Newsletter, we'd store the same content 1000 times.

**Solution**: Separate content storage from user relationships.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT LAYER (Shared)                       │
├─────────────────────────────────────────────────────────────────┤
│  NewsletterSource    →    Edition    →    ContentByte           │
│  (Lenny's Newsletter)    (Issue #42)     (Individual insight)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Content stored ONCE
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    USER LAYER (Personal)                        │
├─────────────────────────────────────────────────────────────────┤
│  User → UserSubscription → Points to NewsletterSource           │
│       → UserEngagement   → Upvote/Downvote on ContentByte       │
│       → ContentHistory   → What they've seen                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Content Deduplication Strategy

```
When newsletter arrives via webhook:
1. Extract sender email domain + newsletter name
2. Hash the content (subject + first 500 chars of body)
3. Check if Edition with this hash exists
   - YES: Link user to existing Edition
   - NO: Create new Edition, process with Claude, extract ContentBytes
```

### 3. The "Byte" Model

Each newsletter edition is processed into multiple **ContentBytes**:
- Quotes/insights (the gold nuggets)
- Key takeaways (summary points)
- Action items (if any)
- Interesting facts/statistics

This allows granular engagement tracking and personalized feeds.

---

## Database Schema v2.0

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ NewsletterSource │────<│     Edition      │────<│   ContentByte    │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │     │ id               │
│ name             │     │ sourceId         │     │ editionId        │
│ senderEmail      │     │ subject          │     │ content          │
│ description      │     │ contentHash      │     │ type (quote/     │
│ category         │     │ rawContent       │     │   insight/stat)  │
│ subscriberCount  │     │ textContent      │     │ author           │
│ totalEngagement  │     │ summary          │     │ category         │
│ isVerified       │     │ publishedAt      │     │ engagementScore  │
│ createdAt        │     │ processedAt      │     │ upvotes          │
└──────────────────┘     └──────────────────┘     │ downvotes        │
                                                   │ viewCount        │
                                                   │ createdAt        │
                                                   └──────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│      User        │────<│ UserSubscription │     │  UserEngagement  │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │     │ id               │
│ email            │     │ userId           │     │ userId           │
│ passwordHash     │     │ sourceId         │     │ byteId           │
│ name             │     │ subscribedAt     │     │ vote (+1/-1)     │
│ birthDate        │     │ isActive         │     │ savedAt          │
│ lifeExpectancy   │     └──────────────────┘     │ sharedAt         │
│ inboxEmail       │                               │ viewedAt         │
│ enableRecommend. │     ┌──────────────────┐     │ createdAt        │
│ onboardingDone   │     │  ContentHistory  │     └──────────────────┘
│ createdAt        │────<├──────────────────┤
└──────────────────┘     │ id               │     ┌──────────────────┐
                         │ userId           │     │  UserPreference  │
                         │ byteId           │────<├──────────────────┤
                         │ shownAt          │     │ id               │
                         │ dwellTimeMs      │     │ userId           │
                         └──────────────────┘     │ category         │
                                                   │ weight (0-1)     │
                                                   │ updatedAt        │
                                                   └──────────────────┘
```

---

## Engagement System

### Vote Mechanics
```typescript
// Simple Reddit-style voting
interface Engagement {
  upvote: +1      // "This is valuable"
  downvote: -1    // "Not useful"
  neutral: 0      // Default/removed vote
}

// Engagement Score Calculation
engagementScore = (upvotes * 1.0) - (downvotes * 0.5) + (views * 0.01)

// With time decay for trending
trendingScore = engagementScore / (hoursAgo + 2)^1.5
```

### Implicit Engagement Signals
- **View time**: If user stays on byte > 3 seconds = implicit interest
- **Refresh skip**: If user refreshes immediately = implicit disinterest
- **Save action**: Strong positive signal
- **Share action**: Strongest positive signal

---

## Content Discovery Algorithm

### For New Users (Cold Start)
```
1. Show globally popular content (high engagement score)
2. Show recent trending content
3. Show content from verified/premium sources
4. Mix in "recommendation-enabled" sponsored content
```

### For Engaged Users (Personalized)
```
1. Calculate user's category preferences from engagement history
2. Weighted random selection:
   - 60% from preferred categories
   - 20% from subscribed newsletters
   - 15% from trending content
   - 5% exploration (new categories)
3. Filter out already-seen content (ContentHistory)
4. Rank by personalized score
```

### Personalization Formula
```typescript
personalizedScore =
  (engagementScore * 0.4) +
  (categoryMatchScore * 0.3) +
  (recencyScore * 0.2) +
  (sourceRelevance * 0.1)

// categoryMatchScore based on UserPreference weights
// recencyScore decays over 7 days
// sourceRelevance = 1.0 if user subscribed, 0.5 otherwise
```

---

## API Endpoints v2.0

### Content Feed
```
GET /feed
  ?type=personalized|popular|trending|subscribed
  &limit=10
  &cursor=<pagination>

Response: { bytes: ContentByte[], nextCursor: string }
```

### Engagement
```
POST /bytes/:id/vote
  Body: { vote: 1 | -1 | 0 }

POST /bytes/:id/view
  Body: { dwellTimeMs: number }

POST /bytes/:id/save
POST /bytes/:id/share
```

### Discovery
```
GET /discover/sources
  ?category=<category>

GET /discover/trending
  ?timeframe=1h|24h|7d
```

### Recommendations (Monetization)
```
GET /sponsored/bytes
  ?limit=1
  - Returns sponsored content for users with enableRecommendations=true

POST /admin/sponsored
  - For content creators to submit sponsored bytes
```

---

## Monetization Model

### "Enable Recommendations" Toggle
```
During onboarding:
┌─────────────────────────────────────────────────────────────────┐
│  📚 Discover New Newsletters                                    │
│                                                                  │
│  Enable recommendations to discover amazing newsletters         │
│  from creators who want to reach readers like you.              │
│                                                                  │
│  [Toggle: ON/OFF]                                               │
│                                                                  │
│  You can change this anytime in settings.                       │
└─────────────────────────────────────────────────────────────────┘
```

### Revenue Streams
1. **Sponsored Bytes**: Content creators pay to show their best content
2. **Featured Sources**: Newsletters pay for visibility in discovery
3. **Premium Tier**: Ad-free experience, advanced analytics
4. **API Access**: For newsletter creators to see engagement metrics

---

## UI/UX Redesign

### Connecting Mortality Bar to Content

**Current Problem**: Bar feels disconnected from content below.

**Solution**: Unified "Time Well Spent" Theme

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│              You have 2,847 Sundays remaining.                  │
│              ████████████░░░░░░░░░░░░░░░░░░░░░  32% lived       │
│                                                                  │
│              Make this moment count.                             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  "The most dangerous risk of all – the risk of          │    │
│  │   spending your life not doing what you want on         │    │
│  │   the bet you can buy yourself the freedom to           │    │
│  │   do it later."                                         │    │
│  │                                                          │    │
│  │                              — Randy Komisar            │    │
│  │                              from: Lenny's Newsletter   │    │
│  │                                                          │    │
│  │            [👍 127]  [👎 3]  [💾 Save]  [🔄 Next]        │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                         • • ○ ○ ○                               │
│                    (more bytes available)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key UI Changes
1. **Single Byte Focus**: Show one byte at a time (like Reels/TikTok)
2. **Swipe/Click Navigation**: Next byte on click or keyboard
3. **Inline Engagement**: Upvote/downvote visible and easy
4. **Progress Dots**: Show there's more content
5. **Cohesive Messaging**: "Make this moment count" connects mortality to content

### Mobile-First Card Design
```
┌────────────────────────────────────┐
│ [Category Badge]        [Source]  │
│                                    │
│ "Quote or insight text here       │
│  that is bite-sized and           │
│  easy to consume quickly"         │
│                                    │
│              — Author              │
│                                    │
│  [👍 42]  [👎]  [💾]  [↗️ Share]   │
└────────────────────────────────────┘
```

---

## Data Flow

### Newsletter Ingestion
```
User forwards email
        ↓
Mailgun webhook
        ↓
Extract sender → Find/Create NewsletterSource
        ↓
Hash content → Check for existing Edition
        ↓
[New Edition]           [Existing Edition]
    ↓                          ↓
Create Edition          Link User to Source
    ↓                          ↓
Claude Processing       Done
    ↓
Extract ContentBytes
    ↓
Calculate initial scores
    ↓
Available in feeds
```

### Feed Generation
```
User opens new tab
        ↓
GET /feed?type=personalized
        ↓
Check user preferences
        ↓
Query ContentBytes (not in history)
        ↓
Apply personalization ranking
        ↓
Return top bytes
        ↓
Log to ContentHistory
        ↓
Display byte
        ↓
Track engagement (view time, votes)
```

---

## Technical Considerations

### Performance
- **Caching**: Redis for popular/trending bytes
- **Pagination**: Cursor-based for infinite scroll
- **Preloading**: Fetch next 5 bytes while displaying current
- **CDN**: Static assets and common responses

### Scalability
- **Read replicas**: For feed queries
- **Content dedup**: Saves 80%+ storage at scale
- **Async processing**: Queue for Claude API calls
- **Rate limiting**: Per user and global

### Privacy
- **Engagement data**: Only visible in aggregate
- **User data**: Never shared with content creators
- **Opt-in recommendations**: Explicit consent required

---

## Migration Path

### Phase 1: Schema Migration
1. Create new tables (keep old ones)
2. Migrate existing newsletters to new structure
3. Dual-write during transition

### Phase 2: API Updates
1. New endpoints alongside old
2. Update extension to use new endpoints
3. Deprecate old endpoints

### Phase 3: UI Overhaul
1. New byte-focused design
2. Engagement buttons
3. Updated onboarding

### Phase 4: Personalization
1. Cold start with popular content
2. Build engagement history
3. Enable personalized feeds

---

## Success Metrics

- **Engagement Rate**: % of views with upvote/downvote
- **Return Rate**: Users opening new tabs per day
- **Content Velocity**: Bytes consumed per session
- **Recommendation Opt-in**: % of users enabling recommendations
- **Newsletter Growth**: New sources added per week
