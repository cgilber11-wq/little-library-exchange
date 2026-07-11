# Little Library Exchange

A web app for sharing books through little free libraries: manage your inventory, tag books with your library location or personal collection, search for books near you, and earn **Goodwill** (a reading-neighbor score) for successful exchanges.

## Flow

1. **Sign up / Sign in** – Create an account or log in.
2. **Set your location** – Add your little library address or a short description so others can find your books.
3. **Add books** – Scan or type an ISBN; the app looks up title/author/cover via Open Library. Tag each book as “at my little library” or “in my collection”.
4. **Search** – Search by title or author. Optional **max distance** (mi) uses your **saved library coordinates** (address suggestions on the Location page) or **device GPS**. Listings use the lister’s library coordinates.
5. **Claim** – Request a book from another user. They place it in their (or a nearby) little library; you pick it up. Mark the exchange complete to earn **Goodwill**. Each owner sets a **pickup window** (days) in **Settings**; if the exchange isn’t finished in time, the claim **expires** and the book is available again.
6. **Lineage** – The first time you list a book, the app starts a **tracked copy**. When someone completes a pickup and later uses **Relist a pickup**, it stays the same copy. The **original lister** sees **handoff** counts on the dashboard; **Goodwill** still only goes up when *you* are part of a completed pickup (not for every downstream reader’s relist alone).

## Tech stack

- **Next.js 14** (App Router)
- **NextAuth** (credentials: email + password)
- **Prisma** + **PostgreSQL** (Docker locally; Neon/Vercel Postgres in production)
- **Tailwind CSS**
- **Open Library API** (ISBN → book metadata)
- **Vercel Blob** for library photos in production (local disk in dev)

## Setup

1. **Install dependencies**

   ```bash
   cd little-library-exchange
   npm install
   ```

2. **Postgres**

   ```bash
   npm run db:up
   ```

   Leave that terminal running (embedded Postgres). Optional Docker: `npm run db:docker:up`.

3. **Environment**

   Copy `.env.example` to `.env` and set:

   - `NEXTAUTH_SECRET` – random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` – `http://localhost:3000`
   - `DATABASE_URL` – already set for embedded Postgres in `.env.example`

4. **Migrate & seed**

   ```bash
   npx prisma generate
   npm run db:migrate
   npm run db:seed:me
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Go live

See **[GO_LIVE.md](./GO_LIVE.md)** for the production checklist (Vercel + Neon + Blob + soft launch).

## Next steps (product)

- **Notifications** – Email when someone reserves your book or marks it placed.
- **Little Free Library map** – Browse nearby libraries on a map (deferred past soft launch).
- **Password reset / OAuth** – After credentials-only soft launch proves the loop.
