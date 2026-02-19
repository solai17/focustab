# Chrome Web Store Submission Guide — ByteLetters v1.1.0

## What's New in v1.1.0

- **Sources Screen** — Browse and subscribe to curated newsletters
- **Simplified Experience** — No more personal inbox emails required
- **Smart Read Tracking** — Never see the same byte twice
- **Improved Feed Algorithm** — Better content diversity

---

## Pre-Submission Checklist

- [x] manifest.json valid (version 1.1.0)
- [x] Icons: 16px, 48px, 128px PNG files
- [x] Permissions minimal and justified
- [x] Sources screen implemented
- [x] Removed inbox email CTA
- [ ] Screenshots prepared (1280×800)
- [ ] Privacy policy URL updated

---

## Store Listing Content

### Extension Name
```
ByteLetters
```

### Short Description (132 characters max)
```
Curated wisdom from the world's best newsletters. Every new tab shows bite-sized insights, distilled by AI and voted by the community.
```
Character count: 131 ✓

### Detailed Description
```
Wisdom, one byte at a time.

ByteLetters transforms your new tab into a source of daily inspiration. Every time you open a new tab, you'll see a carefully curated insight from the world's best newsletters—distilled by AI, voted on by the community.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW IT WORKS

1️⃣ Browse Sources
Open the Sources screen to discover newsletters from top authors like Naval Ravikant, Tim Ferriss, James Clear, and more.

2️⃣ Subscribe to What You Love
Toggle on the newsletters you want. Toggle off the ones you don't. Your feed shows only content from your subscriptions.

3️⃣ Wisdom Finds You
Open a new tab. A fresh byte of wisdom appears. Upvote the gems. Skip the rest. It's that simple.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FEATURES

✦ Curated Sources — Hand-picked newsletters from thought leaders
✦ Smart Feed — AI-extracted insights ranked by quality
✦ Community Voting — Best content rises to the top
✦ Never Repeat — Smart tracking ensures fresh content
✦ Mortality Bar — Optional reminder of your finite time
✦ Save & Share — Bookmark insights, copy to clipboard
✦ Beautiful Design — Elegant dark theme for focus

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FEATURED NEWSLETTERS

• Naval Ravikant — Wealth & happiness
• James Clear — Atomic Habits author
• Tim Ferriss — 5-Bullet Friday
• Lenny's Newsletter — Product management
• Sahil Bloom — The Curiosity Chronicle
• Morning Brew — Business news
• And many more...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FREE TO USE

ByteLetters is completely free. Create an account to sync your subscriptions and saved bytes across devices.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIVACY FIRST

• No ads, no tracking
• Your data stays yours
• AI processing doesn't train models
• Delete your account anytime

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUPPORT

Questions? Email us at hello@byteletters.app
Website: https://byteletters.app
```

### Category
```
Productivity
```

### Language
```
English
```

---

## Permission Justifications

### `storage`
**Justification:** Required to save user preferences, authentication tokens, newsletter subscriptions, and cached bytes locally for offline access and faster loading.

### `identity`
**Justification:** Used for Google Sign-In authentication to create user accounts, sync subscriptions, and saved bytes across devices.

### `identity.email`
**Justification:** Required to retrieve the user's email address after Google Sign-In for account identification and personalized experience.

---

## Privacy Policy

Host at: `https://byteletters.app/privacy.html`

```
PRIVACY POLICY FOR BYTELETTERS

Last Updated: January 2025

1. INFORMATION WE COLLECT

When you use ByteLetters, we collect:
• Email address (via Google Sign-In) for authentication
• Newsletter subscriptions you choose
• Bytes you save, upvote, or downvote
• Anonymous usage data (bytes viewed, time spent)

2. HOW WE USE YOUR INFORMATION

• To authenticate your account
• To sync subscriptions and saved bytes
• To personalize your feed based on preferences
• To improve content quality through community voting

3. WHAT WE DON'T DO

• We don't sell your data to third parties
• We don't track your browsing activity outside ByteLetters
• We don't use advertising or third-party analytics
• We don't share your data with newsletter creators

4. AI PROCESSING

Newsletter content is processed by AI (Claude and Gemini) to extract insights.
Your personal data is never used to train AI models.

5. DATA STORAGE

• Data stored securely on Supabase (PostgreSQL)
• Authentication handled by Google OAuth
• All connections encrypted (HTTPS/TLS)
• Servers located in the US

6. DATA DELETION

Delete your account and all data anytime:
1. Open ByteLetters in a new tab
2. Click Settings (gear icon)
3. Select "Delete Account"

7. CHANGES TO THIS POLICY

We'll notify users of material changes via email.

8. CONTACT

Privacy questions? Email hello@byteletters.app
```

---

## Screenshots Needed

Prepare these screenshots (1280×800 recommended):

1. **New Tab View** — Byte displayed with mortality bar
2. **Sources Screen** — Newsletter list with subscribe toggles
3. **Engagement** — Upvote/downvote buttons in action
4. **Settings Panel** — User preferences
5. **Empty State** — "Browse Sources" prompt

### Screenshot Tips
- Use clean browser profile (no bookmarks bar)
- Use actual curated content
- Show variety of byte types (quotes, insights)
- Highlight the dark theme aesthetic
- Ensure text is readable at small sizes

---

## Build & Package

```bash
# Navigate to extension folder
cd extension

# Install dependencies
npm install

# Build for production
npm run build

# Create ZIP for upload
cd dist
zip -r ../byteletters-v1.1.0.zip .
```

---

## Submission Steps

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click on ByteLetters
3. **Package** tab → Upload new package
4. Select `byteletters-v1.1.0.zip`
5. Update store listing if needed
6. Verify screenshots are current
7. Submit for review

**Expected review time:** 1-3 business days

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release with personal inbox emails |
| 1.1.0 | Sources screen, curated content model, removed inbox email |

---

## Common Rejection Reasons to Avoid

1. **Missing privacy policy** — Ensure URL is accessible ✓
2. **Excessive permissions** — Only using storage, identity ✓
3. **Misleading description** — Accurately describes features ✓
4. **Broken functionality** — Test thoroughly before submitting
5. **Outdated screenshots** — Update for v1.1.0 features

---

## Post-Submission

After approval:
1. Verify extension auto-updates for existing users
2. Monitor reviews and ratings
3. Respond to user feedback
4. Plan next feature update
