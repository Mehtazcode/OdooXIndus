# CoreInventory 🏭

> Modular Inventory Management System — Odoo Hackathon 2026

A full-stack, production-grade IMS built with Next.js 14 and self-hosted PostgreSQL 15. Replaces manual Excel-based stock tracking with a centralized, real-time system.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

-  **Live Dashboard** — 5 KPI cards updating every 5 seconds
-  **Product Management** — Full CRUD with stock tracking per location
-  **Receipts** — Incoming stock from vendors with auto stock increase
-  **Delivery Orders** — Outgoing stock with 3-step Pick → Pack → Validate
-  **Internal Transfers** — Move stock between warehouses and locations
-  **Stock Adjustments** — Reconcile physical counts with system records
-  **Move History** — Immutable stock ledger with CSV export
-  **Multi-Warehouse** — Unlimited warehouses with location trees
-  **JWT Auth** — Login lockout, OTP password reset, role-based access

---

## 🗄️ Database Highlights

- Self-hosted PostgreSQL 15 — zero managed services
- `validate_operation()` function runs in a SERIALIZABLE transaction
- 8 custom triggers — immutable ledger, status machine, stock floor at 0
- 3-layer input validation — Zod (client) → Zod (API) → PostgreSQL constraints
- Race-condition-safe reference numbers via `FOR UPDATE` locking

---

## 🚀 Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Set DATABASE_URL and JWT_SECRET in .env.local

# 3. Run database migrations
npm run db:migrate

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default login:** admin@coreinventory.local / Admin@123

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL 15 (self-hosted) |
| DB Driver | node-postgres (pg) |
| Auth | Custom JWT + bcryptjs |
| Validation | Zod (client + server) |
| Deployment | Docker Compose |

---

## 📁 Project Structure
```
coreinventory/
├── migrations/          # PostgreSQL schema + seed data
├── scripts/             # Migration runner
├── src/
│   ├── lib/             # DB, Auth, API helpers, UI components
│   └── app/
│       ├── api/         # All REST API routes
│       └── (pages)/     # All frontend pages
├── docker-compose.yml   # Self-hosted deployment
└── .env.example         # Environment template
```

---

## 📹 Demo Video

[▶️ Watch Demo](YOUR_VIDEO_LINK_HERE)

---

Built with ❤️ for Odoo Hackathon 2026
