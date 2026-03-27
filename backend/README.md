# BarberShop AI Backend

FastAPI + Neon PostgreSQL + OpenAI gpt-4o-mini chatbot backend.

## Quick Start

```bash
cd backend

# 1. Create virtualenv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your keys

# 4. Run database migrations (Neon PostgreSQL)
alembic upgrade head

# 5. Start server
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs (development only)

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (asyncpg) |
| `OPENAI_API_KEY` | OpenAI API key |
| `JWT_SECRET` | Random secret for signing JWTs (min 32 chars) |
| `SMTP_*` | Email credentials for verification codes |

## Architecture

```
app/
├── main.py          # FastAPI app, middleware, startup
├── config.py        # Settings via pydantic-settings
├── database.py      # Async engine + session factory
├── models/          # SQLModel table definitions
│   ├── user.py      # User, VerificationCode
│   └── chat.py      # ChatSession, Message
├── routers/
│   ├── auth.py      # /api/auth/* (register, verify, resend, me)
│   └── chat.py      # /api/chat/* (message, stream, history, upload)
├── services/
│   ├── auth_service.py    # JWT create/decode/refresh
│   ├── email_service.py   # SMTP with HTML template
│   ├── openai_service.py  # gpt-4o-mini completions + streaming
│   └── rate_limiter.py    # Sliding window per-user/IP
├── middleware/
│   └── error_handler.py   # Global error + request ID
└── utils/
    └── deps.py            # FastAPI dependency injectors
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Submit email + name → sends 6-digit code |
| POST | `/api/auth/verify` | Submit email + code → returns JWT |
| POST | `/api/auth/resend` | Resend code (60s cooldown) |
| GET | `/api/auth/me` | Get current user profile |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/message` | Send message, get AI response |
| POST | `/api/chat/stream` | Stream AI response (SSE) |
| GET | `/api/chat/history` | Get paginated message history |
| POST | `/api/chat/session` | Create new session |
| GET | `/api/chat/sessions` | List user's sessions |
| POST | `/api/chat/upload` | Upload file for vision |

## Deployment (Production)

```bash
# Using gunicorn with uvicorn workers
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Set `DEBUG=false` and configure proper `ALLOWED_ORIGINS` in production.
