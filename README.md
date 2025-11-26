# FocusTab 🎯

> Transform every new tab into a reminder of what matters.

FocusTab is a Chrome extension that replaces your new tab page with three powerful elements:

1. **Life Perspective** - A visual reminder of your remaining Sundays
2. **Curated Wisdom** - AI-extracted inspiration from your newsletters  
3. **Reading Queue** - Summarized newsletters waiting for your attention

## ✨ Features

- **Mortality Awareness**: Visualize your remaining time based on life expectancy
- **Newsletter Curation**: Forward emails to your unique inbox for AI processing
- **Smart Summaries**: Get key insights and reading time estimates
- **Inspiration Rotation**: Fresh wisdom quotes from your reading material
- **Beautiful Design**: Dark, minimal aesthetic that doesn't distract
- **Privacy First**: All data stored locally in your browser

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Load in Chrome

1. Build the extension: `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder

## 🏗️ Architecture

```
focustab/
├── public/
│   ├── manifest.json     # Chrome extension manifest
│   └── icons/            # Extension icons
├── src/
│   ├── components/       # React components
│   │   ├── MortalityBar.tsx
│   │   ├── InspirationCard.tsx
│   │   ├── ReadingList.tsx
│   │   ├── NewsletterReader.tsx
│   │   ├── Onboarding.tsx
│   │   └── Settings.tsx
│   ├── data/
│   │   └── mockData.ts   # Sample content for demo
│   ├── types/
│   │   └── index.ts      # TypeScript interfaces
│   ├── utils/
│   │   └── storage.ts    # Chrome storage abstraction
│   ├── App.tsx           # Main application
│   └── main.tsx          # Entry point
└── dist/                 # Built extension (after build)
```

## 📧 Newsletter Integration (Phase 2)

The full version will include a backend service for:

1. **Email Inbox**: Each user gets a unique email address (e.g., `yourname-abc123@focustab.app`)
2. **AI Processing**: Newsletters are parsed using Claude to extract:
   - Inspirational quotes and wisdom
   - Key insights and summaries
   - Reading time estimates
3. **Sync**: Content syncs to your extension automatically

### Backend Stack (Phase 2)

- Node.js / Express or Python / FastAPI
- PostgreSQL database
- Mailgun for email receiving
- Claude API for content extraction

## 🎨 Design Philosophy

FocusTab follows these principles:

- **Glanceable**: All key info visible without scrolling
- **Non-Anxious**: Mortality reminder motivates, doesn't frighten
- **Minimal Friction**: Forward emails, that's it
- **Beautiful Defaults**: Works well from day one

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS 3** for styling
- **Lucide React** for icons
- **Chrome Extension Manifest V3**

## 📝 Configuration

### User Settings

- **Name**: Personalized greeting
- **Birth Date**: For life calculation
- **Life Expectancy**: Adjustable (default: 80 years)

### Storage

All data is stored locally using Chrome's `storage.local` API (or localStorage for web development).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use and modify.

## 🙏 Inspiration

- [Wait But Why: Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html)
- [The Last Sunday Chrome Extension](https://chrome.google.com/webstore/detail/the-last-sunday)
- [Momentum Dashboard](https://momentumdash.com/)

---

Built with ❤️ for intentional living.
