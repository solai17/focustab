# ByteLetters Email Worker

Cloudflare Email Worker that receives newsletters and forwards them to the ByteLetters API.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure
Update `wrangler.toml` with your API URL if different from `api.byteletters.app`.

### 3. Deploy
```bash
npm run deploy
```

### 4. Configure Email Routing in Cloudflare
1. Go to Cloudflare Dashboard → Email → Email Routing
2. Create a catch-all route: `*@inbox.byteletters.app`
3. Select "Send to Worker" → Choose this worker

## Environment Variables

Set these in Cloudflare dashboard or via `wrangler secret`:
- `WEBHOOK_SECRET` (optional): Shared secret for webhook authentication

## Development
```bash
npm run dev
```

## Logs
```bash
npm run tail
```
