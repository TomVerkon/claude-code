# App Specification

## 1. System Overview

### 1.1 Architecture Style

Monolithic Next.js App Router application:

- **UI:** React Server Components + Client Components
- **Business logic:** Server Actions (planned), Route Handlers (implemented)
- **Bulk parsing endpoint:** Route Handler (`app/api/import/route.ts`)
- **Database access:** Direct `pg` client
- **Auth:** better-auth (session-based) — schema created, not yet wired up
- **Validation:** Zod
- **Database:** PostgreSQL
- **Migration strategy:** Versioned raw SQL files
- **Styling:** Tailwind CSS v4

This is intentionally simple and production-ready without unnecessary abstraction.

---

## 2. High-Level Architecture

```
Browser
  ↓
Next.js App Router
  ├── Server Components (data fetch)
  ├── Client Components (forms, import UI)
  ├── Server Actions (CRUD — planned)
  └── Route Handler (/api/import)
  ↓
Database Layer (pg)
  ↓
PostgreSQL
```

---

## 3. Domain Model

### 3.1 Core Entities

- User (better-auth tables created, not yet integrated)
- Book (primary entity — tracks Kindle, Audible, and Technical book purchases)
- ~~Tag *(future)*~~
- ~~BookTag *(future)*~~

### 3.2 Database Schema (v1)

#### Auth Tables (managed by better-auth)

better-auth requires four core tables. These are generated via `npx @better-auth/cli generate` and should not be manually modified. The `role` field is a custom `additionalField` added to the `user` table via the auth config.

```sql
-- Core user table (better-auth)
CREATE TABLE "user" (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image       TEXT,
    role        TEXT NOT NULL DEFAULT 'user',  -- additionalField: 'user' | 'admin'
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Session table (better-auth)
CREATE TABLE session (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Account table — stores credentials and OAuth tokens (better-auth)
-- For email+password auth, the hashed password lives in the `password` column here.
CREATE TABLE account (
    id                        TEXT PRIMARY KEY,
    user_id                   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    account_id                TEXT NOT NULL,
    provider_id               TEXT NOT NULL,
    access_token              TEXT,
    refresh_token             TEXT,
    access_token_expires_at   TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at  TIMESTAMP WITH TIME ZONE,
    scope                     TEXT,
    id_token                  TEXT,
    password                  TEXT,  -- hashed, for credential auth
    created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Verification table — used for email verification, password reset tokens (better-auth)
CREATE TABLE verification (
    id          TEXT PRIMARY KEY,
    identifier  TEXT NOT NULL,
    value       TEXT NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

> **Note:** better-auth internally uses camelCase field names (`userId`, `expiresAt`, etc.). Configure the PostgreSQL adapter with `usePlural: false` and snake_case field mappings as needed, or let the CLI generate the correct migration.

#### `books`

Single shared family pool. DDL in `src/migrations/001_create_tables.sql`.

```sql
CREATE TYPE book_type_enum AS ENUM ('KINDLE', 'AUDIBLE', 'TECHNICAL');
CREATE TYPE owner_enum AS ENUM ('tverkon', 'dverkon');

CREATE TABLE books (
    id                 SERIAL PRIMARY KEY,
    book_type          book_type_enum NOT NULL,
    title              TEXT NOT NULL,
    description        TEXT,
    image              TEXT NOT NULL DEFAULT 'https://via.placeholder.com/150x226/1ECBE1/ffffff',
    owner              owner_enum NOT NULL,
    readers            TEXT NOT NULL DEFAULT 'tverkon|0|1,dverkon|0|1',
    series             TEXT,
    authors            TEXT NOT NULL,
    sortable_title     TEXT NOT NULL,
    searchable_content TEXT NOT NULL,
    purchase_date      TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_books_duplicate UNIQUE (book_type, title, authors, owner, purchase_date)
);
```

> **Key differences from original spec:**
> - `id` is `SERIAL` (auto-increment integer), not `UUID`
> - `book_type` and `owner` use PostgreSQL enums instead of plain `TEXT`
> - Duplicate detection: composite unique constraint on `book_type + title + authors + owner + purchase_date` (5 fields, includes `book_type`)

#### `tags` *(not yet implemented)*

```sql
CREATE TABLE tags (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);
```

#### `book_tags` *(not yet implemented)*

```sql
CREATE TABLE book_tags (
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);
```

---

## 4. Auth Model

Using better-auth (schema created, library not yet installed):

- Email + password
- No public registration
- Admin manually inserts users (via direct DB insert or admin script)
- Forgot password supported (via `verification` table tokens)
- Session-based auth

**better-auth config (`lib/auth.ts`) — planned:**

```ts
import { betterAuth } from "better-auth";
import { pool } from "./db";

export const auth = betterAuth({
  database: pool,
  user: {
    additionalFields: {
      role: {
        type: ["user", "admin"],
        required: false,
        defaultValue: "user",
        input: false, // users cannot set their own role
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
});
```

### Authorization Rules

| Action        | ADMIN | USER |
| ------------- |:-----:|:----:|
| View books    | yes   | yes  |
| Create book   | yes   | yes  |
| Update book   | yes   | yes  |
| Delete book   | yes   | no   |
| Bulk import   | yes   | yes  |

All data shared across family.

---

## 5. Application Structure

### 5.1 Folder Structure (current)

```
src/
 ├── app/
 │   ├── layout.tsx              (root layout with Geist fonts)
 │   ├── page.tsx                (placeholder — "Hello World")
 │   ├── globals.css             (Tailwind v4 imports + theme)
 │   ├── purchases/
 │   │   └── import/
 │   │       └── page.tsx        (Kindle import UI — implemented)
 │   └── api/
 │       └── import/
 │           └── route.ts        (parse + import endpoint)
 │
 ├── lib/
 │   ├── db.ts                   (pg pool singleton)
 │   ├── queries/
 │   │   └── books.ts            (checkDuplicates, insertBooks)
 │   └── parsing/
 │       └── kindle-parser.ts    (parseKindleText, parseImageJson)
 │
 └── migrations/
     ├── 000_create_db.sql
     └── 001_create_tables.sql
```

### 5.2 Planned (not yet created)

```
src/
 ├── app/
 │   ├── login/                  (login page)
 │   ├── purchases/
 │   │   ├── page.tsx            (book list with filters)
 │   │   ├── new/                (create book form)
 │   │   └── [id]/               (edit book)
 │   └── api/
 │       └── auth/
 │           └── [...all]/
 │               └── route.ts    (better-auth handler)
 │
 ├── components/
 │   ├── layout/
 │   ├── purchases/
 │   ├── forms/
 │   ├── tables/
 │   └── ui/
 │
 ├── lib/
 │   ├── auth.ts
 │   ├── actions/
 │   └── validation/
 │
 └── types/
```

---

## 6. Database Access Layer

### 6.1 `db.ts`

Singleton `pg` pool:

```ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

- No ORM.
- All queries parameterized.
- All queries live in `lib/queries/*`.
- No inline SQL in components.

### 6.2 `queries/books.ts` (implemented)

- **`checkDuplicates(books)`** — checks parsed books against DB using composite key (`book_type + title + authors + owner + purchase_date`), returns `{ newBooks, duplicates }`
- **`insertBooks(books)`** — bulk inserts in a single transaction with `ON CONFLICT DO NOTHING`, returns inserted count

---

## 7. Server Actions Design

*Not yet implemented.* Will use Server Actions for:

- `createBook`
- `updateBook`
- `deleteBook`
- `createTag`
- etc.

**Pattern:**

```ts
"use server";

export async function createBook(input: CreateBookInput) {
  const parsed = createBookSchema.parse(input);
  // auth check
  // db transaction
}
```

All validation via Zod before DB access.

---

## 8. Bulk Import Flow (Kindle)

### 8.1 Implementation Status: COMPLETE

### 8.2 UX Flow

1. User navigates to `/purchases/import`
2. Pastes raw Kindle library text into first textarea
3. Optionally pastes images JSON (from browser console scraper) into second textarea
4. Clicks "Parse"
5. System:
   - Parses text via `parseKindleText()`
   - Parses images via `parseImageJson()` (filters Amazon cover URLs)
   - Matches images to books by position order
   - Runs duplicate detection against DB
   - Returns structured preview split into "New Books" and "Duplicates"
6. User reviews preview table (title, authors, series, owner, date)
7. Clicks "Confirm Import"
8. System bulk inserts in transaction

### 8.3 Route Handler

`app/api/import/route.ts` — single POST endpoint with discriminated union:

- `action: "parse"` — validates input via Zod, parses text + images, checks duplicates
- `action: "import"` — validates book array via Zod, bulk inserts

### 8.4 Parsing Layer

```
lib/parsing/
 └── kindle-parser.ts    (implemented)
```

**`parseKindleText(rawText, images?)`** extracts books from raw Kindle library text:
- Skips noise lines ("Deliver or remove from device", "Delete", "More Actions", device counts)
- Extracts title, authors, purchase date from structured blocks
- Detects owner from "Acquired by X" / "Shared with X" lines
- Extracts series from parenthesized groups (e.g., "Series Name Book 3")
- Extracts description from subtitle after colon
- Strips leading articles (A, An, The) for sortable title
- Builds searchable content as lowercase `title + authors`

**`parseImageJson(json)`** filters Amazon book cover images:
- Handles double-encoded JSON (from `copy()`)
- Filters URLs containing `m.media-amazon.com/images/I/`

Each parser returns:

```ts
type ParsedBook = {
  bookType: "KINDLE" | "AUDIBLE" | "TECHNICAL";
  title: string;
  description: string | null;
  image: string;
  authors: string;
  owner: "tverkon" | "dverkon";
  purchaseDate: string;
  sortableTitle: string;
  searchableContent: string;
  series: string | null;
};
```

### 8.5 Duplicate Detection

- Query DB for matching `book_type + title + authors + owner + purchase_date` (5-field composite)
- Mark duplicates in preview (shown in amber-highlighted table)
- Insert uses `ON CONFLICT ON CONSTRAINT uq_books_duplicate DO NOTHING`

### 8.6 Audible Parser

*Not yet implemented.* Planned at `lib/parsing/audible-parser.ts`.

---

## 9. Filtering Design

*Not yet implemented.* Will support filtering by:

- Type (book_type enum)
- Author (ILIKE search)
- Title (ILIKE search)
- Date range
- Tags
- Owner

**Implementation:**

- URL search params
- Server Component fetch with dynamic SQL builder

**Example:**

```
/purchases?type=KINDLE&author=martin&from=2023-01-01
```

Dynamic query builder in `lib/queries/books.ts`.

---

## 10. UI Wireframe (High-Level)

### 10.1 Layout

```
-------------------------------------------------
| Header: App Name | User | Logout             |
-------------------------------------------------
| Sidebar          | Main Content              |
| - Dashboard      |                           |
| - Books          |                           |
| - Import         |                           |
-------------------------------------------------
```

### 10.2 Books Page (planned)

```
[ Filter Bar ]
-------------------------------------------------
| Title | Author | Type | Date | Actions      |
-------------------------------------------------
| Book  | Name   | K    | 2024 | Edit/Delete  |
```

Pagination optional (5,000 records manageable, but add `LIMIT 50`).

### 10.3 Create/Edit Form (planned)

Fields:

- Type (enum select: KINDLE, AUDIBLE, TECHNICAL)
- Title
- Authors
- Purchase Date
- Image URL
- Series (optional)
- Description (optional)
- Tags (multi-select, optional)

### 10.4 Import Page (implemented)

```
[ Kindle Book Import ]

-----------------------------------
| Textarea: Raw Kindle text       |
-----------------------------------

-----------------------------------
| Textarea: Images JSON (optional)|
-----------------------------------

[ Parse ]

-----------------------------------
| New Books table (title, authors,|
|   series, owner, date)          |
-----------------------------------

-----------------------------------
| Duplicates table (amber)        |
-----------------------------------

[ Confirm Import (N books) ]
```

---

## 11. Validation Strategy

Import validation implemented via Zod in `app/api/import/route.ts`:

- `parseSchema` — validates raw text input
- `importSchema` — validates book array with typed enums
- Uses `z.discriminatedUnion` on `action` field

Planned validation files:

```
lib/validation/
 ├── book.ts
 ├── import.ts
 └── auth.ts
```

---

## 12. Indexing Strategy

*Not yet implemented.* To support 5,000 records efficiently:

```sql
CREATE INDEX idx_books_type ON books(book_type);
CREATE INDEX idx_books_purchase_date ON books(purchase_date);
CREATE INDEX idx_books_owner ON books(owner);
CREATE INDEX idx_books_title_trgm ON books USING gin (title gin_trgm_ops);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 13. Migration Strategy

```
src/migrations/
  000_create_db.sql          (CREATE DATABASE family_books)
  001_create_tables.sql      (enums + books table + auth tables)
```

Apply manually:

- **Local:** `psql -f src/migrations/000_create_db.sql && psql -d family_books -f src/migrations/001_create_tables.sql`
- **Production:** Same files applied via deployment script

---

## 14. Environment Configuration

**`.env.local`**

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

**Vercel:**

- Set same env vars in dashboard
- Use production Postgres URL

---

## 15. Error Handling Strategy

- Zod → validation errors (400 response with issue details)
- Database errors → 500 response with generic message
- Duplicate detection → preview stage, not runtime failure
- Insert uses `ON CONFLICT DO NOTHING` as safety net
- All Route Handlers wrapped in `try/catch`

---

## 16. Testing Strategy (Recommended)

- Unit tests for parsers
- Duplicate detection tests
- SQL integration tests (optional)
- Fixture TXT files for Kindle/Audible (`kindle-01.txt` exists as sample data)

---

## 17. Performance Considerations

- 5,000 records trivial for Postgres
- Bulk import:
  - Uses single `INSERT` with multiple value rows
  - `ON CONFLICT DO NOTHING` handles race conditions
  - Wrapped in transaction with rollback on error

---

## 18. Future Extensibility

Designed to support:

- Multiple families (add `family_id` column)
- Spending analytics
- CSV export
- Soft deletes
- File uploads instead of paste
- Per-user visibility

## 19. Implementation Progress

### Completed

- [x] Project scaffolding (Next.js 16 + Tailwind v4 + TypeScript 5.9)
- [x] Database schema (enums, books table, auth tables)
- [x] Database connection layer (`lib/db.ts`)
- [x] Kindle text parser with series/description/owner extraction
- [x] Image JSON parser for Amazon cover URLs
- [x] Duplicate detection query
- [x] Bulk insert with transaction + conflict handling
- [x] Import API route with Zod validation
- [x] Import UI page (parse + preview + confirm)
- [x] Sample data files (`kindle-01.txt`, `kindle-01-images.json`)

### Not Yet Started

- [ ] better-auth integration (library install + config + routes)
- [ ] Login page
- [ ] Dashboard page
- [ ] Books list page with filtering
- [ ] Create/edit book forms
- [ ] Server Actions for CRUD
- [ ] Tags system
- [ ] Audible parser
- [ ] Database indexes
- [ ] Component library (`components/` directory)
