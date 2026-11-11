# Neo Vision Tech — Project Hub

A lightweight project tracker designed for two founders. UI direction based on the approved Google Stitch export: Geist typography, slate canvas, indigo accents, compact tables, status badges and clean project-detail views.

## Included UI
- Dashboard with six summary cards, recent projects, on-hold reasons and upcoming deadlines.
- Project list with filters, search, owner views and table/card layouts.
- Create and edit project forms, status management and required on-hold notes.
- Project detail tabs: Overview, Notes, Documents and Activity.
- Document upload preview with 20 MB size and extension validation.
- Sign-in visual preview, responsive navigation, and workspace settings.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (redirects to dashboard). Review the sign-in design at `/sign-in`.

## Important: UI preview, not production storage

This stage is **the design/UI implementation**. Data comes from clearly fictional sample projects, stored in browser localStorage. File contents uploaded during preview stay in browser IndexedDB; files are **not** shared across founders. The sign-in screen is a visual prototype, not a live Clerk login.

The **Neon + Drizzle database schema** is in `src/db/schema.ts`. The backend, Clerk server-side allowlist, migrations and private cloud file storage are separate integration steps that require your environment credentials. Do not place client records or confidential documents in the prototype.

## Production stack (agreed)
- Next.js + TypeScript
- Clerk authentication for exactly two allowlisted founders
- Neon PostgreSQL Free + Drizzle
- Private object storage for documents (to finalize and verify limits)
- Vercel-compatible deployment; check Vercel Hobby non-commercial restrictions before hosting business use

Never commit `.env.local` or other secrets.
