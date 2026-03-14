# CoreInventory — Full Stack IMS

**Next.js 14 + PostgreSQL 15 · Self-hosted · No managed services**

---

## Quick Start (3 commands)

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL and JWT_SECRET

# 3. Run migrations + start dev server
npm run db:migrate && npm run dev
```

Open http://localhost:3000

**Default login:** admin@coreinventory.local / Admin@123

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15 running locally  
  *(or use Docker — see Docker section below)*

---

## Environment Setup

Edit `.env.local`:

```env
DATABASE_URL=postgresql://coreinventory_user:your_password@localhost:5432/coreinventory_db
JWT_SECRET=your_long_random_secret_here_minimum_32_chars
JWT_EXPIRES_IN=7d
SMTP_HOST=localhost
SMTP_PORT=587
NODE_ENV=development
```

---

## PostgreSQL Setup (Manual)

```sql
-- Run in psql as superuser:
CREATE USER coreinventory_user WITH PASSWORD 'your_password';
CREATE DATABASE coreinventory_db OWNER coreinventory_user;
GRANT ALL PRIVILEGES ON DATABASE coreinventory_db TO coreinventory_user;
```

Then run migrations:
```bash
npm run db:migrate
```

---

## Docker Setup (Easiest)

No PostgreSQL installation needed:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL 15 on port 5432
- Next.js app on port 3000
- Runs migrations automatically

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header (except auth routes).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login → JWT cookie |
| POST | /api/auth/logout | Clear session |
| GET  | /api/auth/me | Current user |
| PATCH | /api/auth/me | Update profile/password |
| POST | /api/auth/forgot-password | Send OTP |
| POST | /api/auth/reset-password | Verify OTP + new password |
| GET  | /api/products | List products (paginated, filterable) |
| POST | /api/products | Create product |
| GET  | /api/products/:id | Product + stock by location + moves |
| PUT  | /api/products/:id | Update product |
| DELETE | /api/products/:id | Soft-delete |
| GET  | /api/categories | List categories |
| POST | /api/categories | Create category |
| GET  | /api/operations | List operations (type/status filter) |
| POST | /api/operations | Create operation |
| GET  | /api/operations/:id | Operation + lines |
| PUT  | /api/operations/:id | Update draft operation |
| POST | /api/operations/:id/confirm | Confirm operation |
| POST | /api/operations/:id/validate | **Validate → executes stock moves** |
| POST | /api/operations/:id/cancel | Cancel operation |
| GET  | /api/dashboard | KPIs + recent operations |
| GET  | /api/stock | Move history ledger (paginated) |
| GET  | /api/stock?export=csv | Export CSV |
| GET  | /api/warehouses | List warehouses + locations |
| POST | /api/warehouses | Create warehouse |
| PUT  | /api/warehouses/:id | Update warehouse |
| POST | /api/warehouses/:id/locations | Add location |

---

## Database Design Highlights

- **PostgreSQL custom ENUMs** for all status/type fields — invalid values rejected at DB level
- **`validate_operation()` PostgreSQL function** — runs in a SERIALIZABLE transaction, all-or-nothing
- **Immutable `stock_moves` ledger** — BEFORE UPDATE OR DELETE trigger rejects all modifications
- **`stock_quants.on_hand_qty >= 0` CHECK constraint** — stock can never go negative
- **`next_reference()` function** with `FOR UPDATE` locking — race-condition-safe reference numbers
- **8 database triggers** enforcing business rules regardless of how data enters
- **13 performance indexes** on all FK columns and common query patterns

---

## Input Validation (3-Layer Defense)

1. **Client** — Zod schemas on all forms, field-level errors before any API call
2. **API** — Server-side Zod re-validation, UUID checks, parameterized SQL (no injection)
3. **Database** — CHECK constraints, NOT NULL, UNIQUE, FK constraints, custom triggers

---

## Project Structure

```
coreinventory/
├── migrations/
│   ├── 001_schema.sql      ← Full PostgreSQL schema + triggers + functions
│   └── 002_seed.sql        ← Initial data (warehouses, products, locations)
├── scripts/
│   └── migrate.js          ← Migration runner
├── src/
│   ├── lib/
│   │   ├── db.ts           ← PostgreSQL pool + query helpers
│   │   ├── auth.ts         ← JWT + bcrypt + OTP logic
│   │   ├── api.ts          ← Response helpers + all Zod schemas
│   │   ├── client.ts       ← Frontend API client
│   │   ├── auth-context.tsx← React auth context
│   │   ├── ui.tsx          ← Shared UI components
│   │   ├── shell.tsx       ← App sidebar + layout
│   │   └── toast.ts        ← Toast notification hook
│   └── app/
│       ├── api/            ← All API routes
│       │   ├── auth/       ← Login, register, OTP, profile
│       │   ├── products/   ← CRUD + stock info
│       │   ├── categories/ ← CRUD
│       │   ├── operations/ ← All op types + validate/cancel/confirm
│       │   ├── dashboard/  ← KPIs + recent ops
│       │   ├── stock/      ← Move history + CSV export
│       │   └── warehouses/ ← CRUD + locations
│       ├── dashboard/      ← Dashboard page
│       ├── login/          ← Login page
│       ├── signup/         ← Signup page
│       └── ...             ← Other pages
├── docker-compose.yml      ← Self-hosted PostgreSQL + app
├── Dockerfile
└── .env.example
```

---

## Tech Stack (Zero Third-Party SaaS)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 + TypeScript | App Router |
| UI | Tailwind CSS | No component library CDN |
| DB | PostgreSQL 15 (self-hosted) | No Supabase/Neon/PlanetScale |
| DB Driver | node-postgres (pg) | Raw SQL, no ORM for critical paths |
| Auth | Custom JWT (jsonwebtoken) | No Auth0/Clerk/Firebase |
| Passwords | bcryptjs | 12 rounds |
| Validation | Zod | Client + server |
| Email/OTP | Nodemailer + SMTP | No SendGrid/Mailgun |
| Real-time | SWR polling (5s) | No Pusher/Ably |
| Deployment | Docker Compose | Fully self-contained |
