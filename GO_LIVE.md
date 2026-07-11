# Go-live shape (week 1)

Minimal path to a real, invite-only deploy. **Local and production both use Postgres.** Photos use disk locally and Vercel Blob in production.

## Target stack

| Piece | Choice | Why |
|-------|--------|-----|
| App host | [Vercel](https://vercel.com) | Fits Next.js App Router |
| Database | Postgres (Docker locally; Neon/Vercel Postgres in prod) | Replaces SQLite |
| Photos | Disk locally; [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) in prod | Serverless-safe uploads |
| Auth | NextAuth credentials (already built) | Keep simple; OAuth later |
| Domain | Vercel domain or custom | Set `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` to match |

Out of scope for week 1: email, Sentry, OAuth, map browse, rate limits beyond Vercel defaults.

---

## What’s already in the repo

- [x] Prisma schema → **postgresql**
- [x] Initial migration: `prisma/migrations/20260711000000_init`
- [x] `docker-compose.yml` for local Postgres (+ test DB)
- [x] Photo uploads → Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set; local disk otherwise
- [x] `vercel.json` runs `prisma migrate deploy` on build
- [x] npm scripts: `db:up`, `db:migrate`, `db:deploy`, …

---

## Your machine (local)

No Docker required — the repo uses **embedded Postgres**:

```bash
# Terminal 1 — leave Postgres running
npm run db:up

# Terminal 2
npx prisma generate
npm run db:migrate
npm run db:seed
npm run db:seed:me
npm run dev
```

`.env` (already set for embedded Postgres):

```bash
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://lle:lle@127.0.0.1:54329/little_library_exchange?schema=public"
```

Optional: Docker Compose still works via `npm run db:docker:up` (port 5432).

**Account after seed:me:** `collin.gilbertemail@gmail.com` / `password123` (created if missing).
---

## Checklist — production

### 0. Before hosting

- [ ] Soft-launch plan: one neighborhood / invite-only (no public marketing yet)
- [ ] Confirm you will **not** run `db:seed` / `db:seed:me` against production
- [ ] Generate a production secret: `openssl rand -base64 32`

### 1. Postgres (hosted)

- [ ] Create a [Neon](https://neon.tech) project (or Vercel Postgres)
- [ ] Copy the connection string
- [ ] Set `DATABASE_URL` in Vercel → Production (and Preview if desired)
- [ ] First deploy will run `prisma migrate deploy` via `vercel.json`
- [ ] Confirm tables exist and are **empty** (no seed users)

### 2. Object storage (photos)

- [ ] In Vercel: Storage → Create Blob store → connect to this project
- [ ] Confirm `BLOB_READ_WRITE_TOKEN` is set in project env
- [ ] Redeploy; upload a library photo on staging/production and confirm it loads after a refresh

### 3. Auth & URLs

| Variable | Value |
|----------|--------|
| `NEXTAUTH_SECRET` | Unique production secret |
| `NEXTAUTH_URL` | `https://your-domain.com` |
| `NEXT_PUBLIC_APP_URL` | Same origin (QR codes) |
| `DATABASE_URL` | Neon/Vercel Postgres URL |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob |

- [ ] Deploy and test register → login → dashboard (no redirect loop)

### 4. Deploy

- [ ] Push repo to GitHub
- [ ] Import on Vercel; root = repo root
- [ ] Env vars from step 3
- [ ] Deploy Production
- [ ] Smoke test:
  - [ ] Register a **new** account
  - [ ] Set location (address suggestion → lat/lng)
  - [ ] Add book (shelf + collection)
  - [ ] Upload library profile photo
  - [ ] Open `/library/{slug}` + QR
  - [ ] Second account: search → reserve → place → pick up

### 5. Soft launch hygiene

- [ ] No `@seed.lle` / `@nbr.lle` in production
- [ ] Share invite link only with first cohort
- [ ] Private channel for bug reports

### 6. Week 2+ (after first real users)

- [ ] Email (Resend) for reservation / placed notifications
- [ ] Sentry
- [ ] Confirm Neon backup retention
- [ ] Privacy policy + contact
- [ ] Rate limit register + claims

---

## Status

| Step | Status |
|------|--------|
| Postgres in codebase + migration | Done |
| Local Docker Compose | Optional (`db:docker:up`) |
| Embedded local Postgres | Done (`npm run db:up`) |
| Migrate + seed on local | Done |
| Integration tests on Postgres | Done (48 passing) |
| Blob photo code | Done (token required in prod) |
| Vercel build + migrate | Done (`vercel.json`) |
| Hosted Neon + Vercel project | **You** — needs your login (repo has no git remote yet) |
| Blob store on Vercel | **You** — create & connect |
| Empty prod smoke test | **You** |
| Invite cohort | **You** |
