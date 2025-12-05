# FocusTab 🎯

A Chrome extension that transforms your new tab page into a focused productivity dashboard with mortality awareness, daily inspiration, and AI-powered newsletter reading.

## Project Structure

```
focustab/
├── extension/           # Chrome Extension (Phase 1)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── data/        # Mock data
│   │   ├── types/       # TypeScript interfaces
│   │   └── utils/       # Utilities
│   └── public/          # Extension manifest & icons
│
├── backend/             # API Server (Phase 2)
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Claude AI, database
│   │   └── middleware/  # Auth middleware
│   └── prisma/          # Database schema
│
└── README.md            # This file
```

## Features

### Extension
- 📊 **Mortality Bar** - Visual life progress based on age
- 💡 **Daily Inspiration** - AI-curated quotes and insights
- 📰 **Reading List** - AI-summarized newsletter content
- ⚙️ **Customizable Settings** - Personalize your experience

### Backend API
- 🔐 **Authentication** - JWT-based user auth
- 📧 **Email Processing** - Mailgun webhook for newsletters
- 🤖 **AI Processing** - Claude-powered content summarization
- 💾 **Database** - PostgreSQL with Prisma ORM

---

## Quick Start

### Extension Development

```bash
cd extension
npm install
npm run dev
```

Load the extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` folder

### Backend Development

```bash
cd backend
npm install
cp .env.example .env  # Configure your environment variables
npx prisma migrate dev
npm run dev
```

---

## Environment Setup

### Backend `.env` Configuration

```env
DATABASE_URL="postgresql://user:password@localhost:5432/focustab"
JWT_SECRET="your-jwt-secret"
CLAUDE_API_KEY="your-claude-api-key"
MAILGUN_API_KEY="your-mailgun-api-key"
MAILGUN_DOMAIN="your-domain"
```

---

## Tech Stack

| Component | Technologies |
|-----------|-------------|
| **Extension** | React, TypeScript, Vite, TailwindCSS |
| **Backend** | Node.js, Express, TypeScript, Prisma |
| **Database** | PostgreSQL |
| **AI** | Claude API (Anthropic) |
| **Email** | Mailgun Webhooks |

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.
