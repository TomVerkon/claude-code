# CLAUDE.md

## Project Overview

Family Books — a shared family digital book library tracker for Kindle, Audible, and Technical books. Built with Next.js App Router, PostgreSQL, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.9 (strict mode)
- **Styling:** Tailwind CSS v4 (CSS-first config in `globals.css`, no `tailwind.config.js`)
- **Database:** PostgreSQL via `pg` library (no ORM)
- **Validation:** Zod v4
- **Auth:** better-auth (schema created, not yet wired up)
- **Fonts:** Geist Sans + Geist Mono
- **Runtime:** Node.js 24

## Architecture Decisions

- **No ORM** — all SQL is parameterized and lives in `src/lib/queries/`
- **No inline SQL** in components or route handlers
- **Server Components** for data fetching pages (e.g., `/books`)
- **Client Components** (`"use client"`) only for interactive forms (e.g., import page)
- **Route Handlers** for bulk operations (`/api/import`)
- **Server Actions** planned for CRUD (not yet implemented)
- Path alias: `@/*` maps to `./src/*`

## Project Structure

```
src/
  app/
    page.tsx                    → redirects to /books
    layout.tsx                  → root layout (Geist fonts)
    books/                      → book listing (Server Component, paginated)
    purchases/import/           → Kindle import UI (Client Component)
    api/import/route.ts         → parse + import API endpoint
  lib/
    db.ts                       → pg pool singleton
    queries/books.ts            → getBooks, checkDuplicates, insertBooks
    parsing/kindle-parser.ts    → parseKindleText, parseKindleHtml, parseImageJson
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

Required in `.env.local`:
```
DATABASE_URL=postgresql://...
```

## Spec

Full specification is in `SPEC.MD` — consult it for planned features, auth model, filtering design, and implementation progress checklist.
