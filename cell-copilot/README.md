# Cell Co-Pilot

AI broker workstation demo — six agents, six simultaneous SMS conversations, real Claude API calls.

Built as a demo for General Magic outreach.

## Quick start (local)

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
# .env.local already set to http://localhost:8000
npm run dev
```

Open http://localhost:3000 — six conversations start auto-running within 8 seconds.

## Environment variables

### Backend (Railway)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `FRONTEND_URL` | Vercel URL for CORS (e.g. https://cell-copilot.vercel.app) |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Railway URL (e.g. https://cell-copilot-backend.up.railway.app) |

## Deploy

### Backend → Railway
```bash
cd backend
git init
railway login
railway init
railway up
# Set ANTHROPIC_API_KEY and FRONTEND_URL in Railway dashboard
```

### Frontend → Vercel
```bash
cd frontend
vercel --prod
# Set NEXT_PUBLIC_API_URL to your Railway URL in Vercel dashboard
# Then update FRONTEND_URL on Railway to your Vercel URL
```

## Demo reset

Click "Reset demo" in the top bar, or `POST /reset`. Wipes all in-memory state and restarts the six conversations from scratch. Use between Loom takes.

## Architecture

```
[Next.js on Vercel]  ←SSE— [FastAPI on Railway]  ←API→  [Claude Sonnet 4.5 + Haiku 4.5]
```

- Six scripted customer conversations auto-advance every 8–13 seconds
- Each customer message triggers 4 parallel Haiku detector calls + 1 Sonnet agent response
- All state lives in Python dicts (server restart = full reset)
- Frontend subscribes to SSE for real-time updates
