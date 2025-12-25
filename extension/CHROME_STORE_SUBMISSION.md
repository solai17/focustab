# Chrome Web Store Submission Guide for ByteLetters

## ✅ Pre-Submission Checklist

- [x] manifest.json valid (version 1.0.0)
- [x] Icons: 16px, 48px, 128px PNG files present
- [x] Permissions minimal and justified
- [ ] Screenshots prepared (1280×800 or 640×400)
- [ ] Privacy policy URL ready

---

## 📝 Store Listing Content

### Extension Name
```
ByteLetters
```

### Short Description (132 characters max)
```
Transform newsletters into bite-sized wisdom. Every new tab shows key insights from your favorite newsletters, distilled by AI.
```
Character count: 127 ✓

### Detailed Description
```
Your newsletters, distilled.

Stop drowning in unread emails. ByteLetters transforms your newsletters into bite-sized wisdom that appears in every new tab. Read less. Absorb more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW IT WORKS

1️⃣ Forward Your Newsletters
Set up automatic forwarding from Gmail or Outlook to your unique ByteLetters inbox. One-time setup, then forget it.

2️⃣ AI Extracts the Gold
Our AI reads every newsletter and extracts only the insights worth remembering—quotes, statistics, action items, and key takeaways.

3️⃣ Wisdom Finds You
Open a new tab. That's it. A fresh byte of wisdom appears, perfectly timed throughout your day.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FEATURES

✦ Smart Extraction — AI identifies quotes, insights, statistics, and action items
✦ Beautiful Interface — Elegant dark theme designed for focus
✦ Community Feed — Access curated bytes from top newsletters instantly
✦ Mortality Reminder — Optional feature showing your Sundays remaining
✦ Privacy First — Your data stays yours. No tracking, no ads
✦ Works Offline — Saved bytes available without internet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUPPORTED NEWSLETTERS

Works with any newsletter! Popular ones include:
• James Clear (Atomic Habits)
• Sahil Bloom (The Curiosity Chronicle)
• Tim Ferriss (5-Bullet Friday)
• Morning Brew
• The Hustle
• Lenny's Newsletter
• And thousands more...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FREE TO USE

ByteLetters is free forever. No subscription required. Create an account to sync your bytes across devices.

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

## 🔐 Permission Justifications

When submitting, you'll need to justify each permission:

### `storage`
**Justification:** Required to save user preferences, authentication tokens, and cached bytes locally for offline access and faster loading.

### `identity`
**Justification:** Used for Google Sign-In authentication to create user accounts and sync bytes across devices.

### `identity.email`
**Justification:** Required to retrieve the user's email address after Google Sign-In for account identification and to generate unique inbox addresses.

---

## 🔒 Privacy Policy

Host this at: `https://byteletters.app/privacy` (or include in your landing page)

```
PRIVACY POLICY FOR BYTELETTERS

Last Updated: December 2025

1. INFORMATION WE COLLECT

When you use ByteLetters, we collect:
• Email address (via Google Sign-In) for authentication
• Newsletters you forward to us for processing
• Your preferences and saved bytes

2. HOW WE USE YOUR INFORMATION

• To authenticate your account
• To process newsletters and extract insights
• To sync your bytes across devices
• To improve our AI extraction quality

3. WHAT WE DON'T DO

• We don't sell your data to third parties
• We don't track your browsing activity
• We don't use advertising or analytics trackers
• We don't share your newsletter content with anyone

4. AI PROCESSING

Your newsletters are processed by AI (Google Gemini and Claude) to extract insights.
The content is not used to train AI models and is deleted after processing.

5. DATA STORAGE

• Data is stored securely on Supabase (PostgreSQL)
• Authentication handled by Google OAuth
• All connections are encrypted (HTTPS)

6. DATA DELETION

You can delete your account and all associated data at any time:
1. Open ByteLetters in a new tab
2. Click Settings (gear icon)
3. Select "Delete Account"

7. CHANGES TO THIS POLICY

We'll notify users of any material changes via email.

8. CONTACT

Questions about privacy? Email us at hello@byteletters.app
```

---

## 📸 Screenshots Needed

Prepare these screenshots (1280×800 recommended):

1. **New Tab View** — Show a byte displayed in a new tab
2. **Byte Types** — Show different byte types (quote, insight, action, statistic)
3. **Settings Panel** — Show the settings/inbox address
4. **Community Feed** — Show browsing community bytes
5. **Dark Theme** — Highlight the elegant dark design

**Tips:**
- Use a clean browser profile
- Hide bookmarks bar
- Use actual content, not placeholder text
- Ensure text is readable

---

## 🚀 Build & Package

```bash
# Navigate to extension folder
cd extension

# Install dependencies
npm install

# Build for production
npm run build

# The dist/ folder contains your extension
# Zip it for upload:
cd dist
zip -r ../byteletters-v1.0.0.zip .
```

---

## 📤 Submission Steps

1. Go to: https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload `byteletters-v1.0.0.zip`
4. Fill in all listing details above
5. Upload screenshots
6. Add privacy policy URL
7. Submit for review

**Expected review time:** 1-3 business days

---

## ⚠️ Common Rejection Reasons to Avoid

1. **Missing privacy policy** — Make sure URL is accessible
2. **Excessive permissions** — Only request what you need ✓
3. **Misleading description** — Be accurate about features ✓
4. **Missing functionality** — Test thoroughly before submitting
5. **Broken links** — Verify all URLs work
