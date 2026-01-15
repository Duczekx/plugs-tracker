# App Blueprint (plugs-tracker)

Purpose
- Warehouse and shipment tracking for Flachenschneeschieber (inventory, orders, sent history).
- Admin-only activity log for key operations.

Stack
- Next.js App Router (client-heavy pages).
- Prisma ORM with PostgreSQL (Neon).
- Vercel deployment.

Repos / Hosting
- GitHub: https://github.com/Duczekx/plugs-tracker.git
- Vercel project uses this repo, branch: main.
- Database: Neon Postgres (DATABASE_URL in env).

Environment Variables (Vercel + local .env)
- DATABASE_URL: Neon connection string.
- NEXT_PUBLIC_NOTIFY_EMAIL_TO: email recipient for status mails.
- NEXT_PUBLIC_NOTIFY_EMAIL_CC: optional CC.
- ADMIN_KEY: admin-only access for /activity + /api/activity (+ cleanup).

Key Pages
- / (Inventory / Magazyn): manage stock, adjust quantities, add/remove product numbers.
- /shipments (Zamowienia): create shipments, deduct from inventory.
- /sent (Wyslane): history, edit/delete shipments, change status READY/SENT.
- /activity (Historia): admin-only activity log with search + pagination.

Admin Access (Activity)
- /api/activity and /api/activity/cleanup require header: x-admin-key = ADMIN_KEY.
- /activity UI stores admin key in localStorage:
  - key name: plugs-tracker-admin-key
  - input screen shown if missing.
  - logout clears localStorage.

Email Content (German)
- Shipment status emails are German and include full item details:
  model (FL ...), number, Bau-Nr, Versanddatum, color, Schwenkbock, 6/2 valve,
  bucket holder, quantity, and extra parts; notes included in /sent.
- Implemented in:
  - app/shipments/page.tsx (buildMailto)
  - app/sent/page.tsx (buildMailto)

Activity Log (append-only)
- Prisma model: ActivityLog (id, createdAt, type, entityType, entityId, summary, meta JSON).
- Indexes: createdAt, type.
- Logged operations (transactional):
  - inventory.adjust (delta changes)
  - shipment.status READY/SENT
  - shipment.create
  - shipment.delete
- API:
  - GET /api/activity?take=50&cursor=<id>&q=<search>
    - order by createdAt desc, then id desc
    - pagination via nextCursor
  - POST /api/activity/cleanup (delete older than 180 days)

Key API Routes
- /api/inventory/adjust (POST) - adjusts inventory + activity log.
- /api/shipments (GET/POST) - list/create shipments + activity log.
- /api/shipments/[id] (PATCH/DELETE) - update status or edit shipment, delete shipment + activity log.
- /api/activity (GET) - admin-only log list.
- /api/activity/cleanup (POST) - admin-only retention cleanup.

Prisma / DB
- Schema: prisma/schema.prisma
- Migrations in prisma/migrations
- ActivityLog migration: 20260115140109_add_activity_log

Local Dev
- npm install
- Ensure .env has DATABASE_URL and ADMIN_KEY
- npm run db:deploy (prisma migrate deploy + generate)
- npm run dev

Operational Notes
- Do not add polling. Activity and lists should fetch on demand only.
- Keep UI/UX unchanged unless requested.
- For admin-only protection, headers are used (x-admin-key).

