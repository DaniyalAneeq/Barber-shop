# BarberShop Web Backend

FastAPI backend for the contact form / appointment booking on the barbershop website.
Shares the same Neon PostgreSQL database as the chatbot backend but runs as a
**separate process** on port **8001**.

---

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/web/services` | List active services (populates the dropdown) |
| `POST` | `/api/web/contact/book` | Submit a contact booking |
| `GET` | `/health` | Health check |

---

## Setup

### 1. Copy environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — copy from `../backend/.env` (same DB)
- `SMTP_*` — copy from `../backend/.env` (same mail credentials)
- `ALLOWED_ORIGINS` — add your frontend origin

### 2. Install dependencies with uv

```bash
cd web-backend
uv sync
```

### 3. Run the database migration

```bash
uv run alembic upgrade head
```

This creates the `contact_bookings` table in the shared database.
The chatbot's `appointments` table is **not touched**.

### 4. Start the server

```bash
uv run fastapi dev main.py --port 8001
```

Production:
```bash
uv run fastapi run main.py --port 8001
```

---

## Frontend env var

Add to the Next.js `.env.local`:

```
NEXT_PUBLIC_WEB_API_URL=http://localhost:8001
```

---

## Database notes

- Both backends share the same Neon PostgreSQL database.
- `contact_bookings` (this backend) and `appointments` (chatbot backend) are **independent tables** — no foreign keys between them.
- `contact_bookings.service` stores the service name and is validated against the shared `services` table on every write but does not write to it.
- Each backend runs its own Alembic migration history; only `contact_bookings` is managed here.
