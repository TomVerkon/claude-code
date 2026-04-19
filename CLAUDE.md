# CLAUDE.md

## Project Overview

Family Books — a shared family digital book library tracker for Kindle, Audible, and Technical books. Built with Next.js App Router, PostgreSQL, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.9 (strict mode)
- **Styling:** Tailwind CSS v4 (CSS-first config in `globals.css`, no `tailwind.config.js`)
- **Database:** Neon Postgres via `@neondatabase/serverless` (WebSocket-based driver; no ORM). Vercel-safe — avoids stale TCP pool issues that `pg.Pool` has on serverless.
- **Validation:** Zod v4
- **Auth:** better-auth (wired up; email+password, allow-list restricted)
- **Fonts:** Geist Sans + Geist Mono
- **Runtime:** Node.js 24
- **Hosting:** Vercel (Next.js 16 + Fluid Compute)

## Architecture Decisions

- **No ORM** — all SQL is parameterized and lives in `src/lib/queries/`
- **No inline SQL** in components or route handlers
- **Server Components** for data fetching pages (e.g., `/books`)
- **Client Components** (`"use client"`) only for interactive forms (e.g., import page)
- **Route Handlers** for bulk operations (`/api/import`)
- **Server Actions** implemented for CRUD (`src/app/books/actions.ts`)
- **Route protection** via `src/proxy.ts` — Next.js 16 replaced `middleware.ts` with `proxy.ts` (export is `proxy`, not `middleware`). Uses better-auth's `getSessionCookie()` helper, which handles both the dev (`better-auth.session_token`) and prod (`__Secure-better-auth.session_token`) cookie names.
- Path alias: `@/*` maps to `./src/*`

## Project Structure

```
src/
  app/
    page.tsx                    → redirects to /books
    layout.tsx                  → root layout (Geist fonts)
    login/page.tsx              → login form (Client Component)
    books/                      → book listing (Server Component, paginated) + CRUD
    purchases/import/           → Kindle/Audible import UI (Client Component)
    api/auth/[...all]/route.ts  → better-auth handler
    api/import/route.ts         → parse + import API endpoint
  proxy.ts                      → Next.js 16 proxy (route protection via session cookie)
  lib/
    db.ts                       → Neon serverless Pool singleton
    auth.ts                     → better-auth server config
    auth-client.ts              → better-auth React client (signIn, signOut, useSession)
    queries/books.ts            → getBooks, getBookById, create/update/delete, checkDuplicates, insertBooks
    parsing/kindle-parser.ts    → parseKindleText, parseKindleHtml, parseImageJson
    parsing/audible-parser.ts   → parseAudibleHtml
  migrations/
    000_create_db.sql           → CREATE DATABASE family_books
    001_create_tables.sql       → enums, books table, auth tables
```

## Database

- **Database name:** `family_books`
- **Primary table:** `books` with `SERIAL` primary key
- **Enums:** `book_type_enum` (KINDLE, AUDIBLE, TECHNICAL), `owner_enum` (tverkon, dverkon)
- **Duplicate detection:** 5-field composite unique constraint: `(book_type, title, authors, owner, purchase_date)`
- **Migrations:** applied manually via `psql -f src/migrations/000_create_db.sql && psql -d family_books -f src/migrations/001_create_tables.sql`

## Key Patterns

- **Kindle import** supports two modes: HTML parsing (preferred — single paste from page source) and plain text + images JSON
- **Owner logic:** "Acquired by X" → X is owner; "Shared with X" → the OTHER person is owner
- **Title processing:** series extracted from trailing parens, description from subtitle after colon, sortable title strips leading articles (A, An, The)
- **Image URLs:** upgraded from SX150 to SX300 when parsed from HTML
- **Book cards:** colored by type — Kindle=AliceBlue, Audible=Beige, Technical=LightGray
- **Pagination:** 24 books per page, ordered by purchase_date DESC

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npx tsc --noEmit` — type check without emitting

## Environment Variables

Required in `.env.local` (dev) and in the Vercel dashboard (prod — `.env*` is gitignored and NOT deployed):
```
DATABASE_URL=postgresql://...       # Neon pooled URL (hostname contains `-pooler`)
BETTER_AUTH_SECRET=...              # 32+ byte random hex
BETTER_AUTH_URL=...                 # http://localhost:3000 in dev, https://<prod-domain> in prod
FIRST_EMAIL=...                     # allow-listed user emails (for seed script + create hook)
SECOND_EMAIL=...
```

## Import via Bookmarklet

Cutting HTML from each page of Amazon "Manage Your Content" is labor-intensive. A bookmarklet is available that accumulates minimal container HTML across pages into one clipboard blob — see `2026-04-17-prod-fixes-and-scraper.txt`. The extracted HTML is compatible with both `parseKindleHtml` and `parseAudibleHtml` (both target `[class*="DigitalEntitySummary-module__container"]`).

## Spec

Full specification is in `SPEC.MD` — consult it for planned features, auth model, filtering design, and implementation progress checklist.
