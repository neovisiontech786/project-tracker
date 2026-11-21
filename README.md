# Neo Vision Tech — Project Hub

A private project and payment workspace with database-managed Admin, Founder and Member roles.

## Stack
Next.js 16, React 19, Clerk, Neon PostgreSQL, Neon Object Storage, TypeScript, Lucide icons.

## Features
- Dashboard with project counts, progress, on-hold reasons, and deadlines
- Project creation, editing, progress, status, owners, archive/restore
- Simple on-hold reasons and resume history
- Shared project notes and activity timeline
- Private uploads and signed downloads (PDF, Office documents, JPG/PNG, ZIP, up to 20 MB)
- Two-email access allowlist enforced by the server

## Deployment
1. Use the dedicated Neon project **Neo Vision Tech Project Hub**. Its initial SQL schema is in `db/migrations/0001_init.sql`; it has already been applied to Neon.
2. In Clerk, create a new application, disable public sign-ups, and create the two founder accounts.
3. Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Vercel. Team members are managed from Settings → Team, not hardcoded allowlists.
4. Add `DATABASE_URL`, `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_REGION`, `NEON_STORAGE_ACCESS_KEY`, `NEON_STORAGE_SECRET_KEY`. These have been provisioned on the connected Vercel project.
5. Deploy the Next.js project, using a Vercel plan appropriate to its business use.
6. Open the live URL and sign in with one of the two pre-created Clerk accounts.

Only two authenticated, allowlisted emails may access API data. Signed private file URLs are issued for a short period and only after authorization. No credentials should be committed to Git.

## Run locally

```sh
npm install
cp .env.example .env.local
# populate credentials in .env.local
npm run dev
```

Open http://localhost:3000.

## Limitations
- There is no client portal or task board.
- Private direct uploads require the storage service to accept CORS preflight from your deployed origin. Configure storage CORS if the browser blocks an upload.
- Project updates use individual database queries; the hold-transition and activity entries should be consolidated into atomic transactions before production-critical usage.
- The free Vercel Hobby plan has non-commercial-use restrictions; check its terms for company use.

## Dynamic team access

Run database migration `db/migrations/0008_dynamic_team.sql` **before** deploying this release. Existing accounts are preserved; the original administrators are mapped to Admin/Founder roles. Only active Admins can invite or manage team accounts. Clerk sends invitation emails to the addresses entered in Settings. The recipient accepts using `/sign-up` and verifies that same email. Members can view their assigned shared projects, comment and upload documents; Admins/Founders manage all shared projects and company finances. Private projects remain creator-only. Removing an account disables access while preserving historical payment attribution and audit records. Do not enable signups as an alternative access route: all new accounts require an invitation.
