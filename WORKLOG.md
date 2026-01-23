# Work Log

## What is done
- Added app login with `APP_PASSWORD`, cookie-based auth gate, and login page.
- Added read-only review mode with `/review?token=...` link.
- Review mode blocks edits in UI and API (POST/PATCH/DELETE).
- Added safe `localStorage` access to avoid mobile crash.
- Switched from `middleware.ts` to `proxy.ts`.
- Fixed login redirect to use 303 after POST.
- Added parts module (public `/parts`) with stock list, search, manual adjust, and order link.
- Added admin panel (`/admin`) with login, BOM editor, parts admin, and movements ledger.
- Added new shipment status `RESERVED` and stock movements on READY with rollback/delta.
- Added Prisma models: Part, Bom, BomItem, PartMovement + configuration on shipment items.
- Added part selection for shipment extras and BOM-based stock deduction.

## Current production domains
- https://flachenschneeschieber.vercel.app

## Links
- Full access: https://flachenschneeschieber.vercel.app/
- Review only: https://flachenschneeschieber.vercel.app/review?token=review-9f3a2c7e7d1a

## Required env vars (Vercel)
- DATABASE_URL
- APP_PASSWORD
- REVIEW_TOKEN = review-9f3a2c7e7d1a
- ADMIN_PASSWORD

## Notes
- Review mode is per-browser (cookie `pt_mode=review`).
- If review mode does not work, redeploy after setting env vars.
