# App Specification

## 1. System Overview

### 1.1 Architecture Style

Monolithic Next.js App Router application:

- **UI:** React Server Components + Client Components
- **Business logic:** Server Actions (planned), Route Handlers (implemented)
- **Bulk parsing endpoint:** Route Handler (`app/api/import/route.ts`)
- **Database access:** Direct `pg` client
- **Auth:** better-auth (session-based) — configured and wired up
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

- User (better-auth tables created and integrated)
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

Using better-auth (installed and configured):

- Email + password
- No public registration — allow list restricted to `tverkon@gmail.com` and `dverkon@gmail.com`
- Users seeded via `src/scripts/seed-users.ts` (takes `TVERKON_PASSWORD` and `DVERKON_PASSWORD` env vars)
- Password validation: min 8 chars, uppercase, lowercase, digit, special char (`lib/password.ts`)
- Forgot password supported (via `verification` table tokens)
- Session-based auth
- Login page at `/login`
- Auth API route at `/api/auth/[...all]`
- Route protection via `src/proxy.ts` middleware (checks `better-auth.session_token` cookie)

**better-auth config (`lib/auth.ts`) — implemented:**

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
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
});
```

**Auth client (`lib/auth-client.ts`) — implemented:**
- `createAuthClient` with configurable `baseURL`
- Exports `signIn`, `signOut`, `useSession`

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
 │   ├── page.tsx                (redirects to /books)
 │   ├── globals.css             (Tailwind v4 imports + theme)
 │   ├── login/
 │   │   └── page.tsx            (login form — Client Component)
 │   ├── books/
 │   │   ├── page.tsx            (paginated book listing — Server Component)
 │   │   ├── actions.ts          (Server Actions: create, update, delete)
 │   │   ├── book-grid.tsx       (responsive grid with book cards — Client Component)
 │   │   ├── book-detail-modal.tsx (detail modal on double-click — Client Component)
 │   │   ├── book-form.tsx       (shared create/edit form — Client Component)
 │   │   ├── pagination.tsx      (smart pagination with ellipsis)
 │   │   ├── new/
 │   │   │   └── page.tsx        (create book page)
 │   │   └── [id]/
 │   │       └── edit/
 │   │           └── page.tsx    (edit book page — Server Component)
 │   ├── purchases/
 │   │   └── import/
 │   │       └── page.tsx        (import UI with format toggle — Client Component)
 │   └── api/
 │       ├── auth/
 │       │   └── [...all]/
 │       │       └── route.ts    (better-auth handler)
 │       └── import/
 │           └── route.ts        (parse + import endpoint)
 │
 ├── lib/
 │   ├── db.ts                   (pg pool singleton)
 │   ├── auth.ts                 (better-auth config)
 │   ├── auth-client.ts          (client-side auth — signIn, signOut, useSession)
 │   ├── password.ts             (password validation rules)
 │   ├── proxy.ts                (session-based route protection middleware)
 │   ├── schemas/
 │   │   └── book.ts             (Zod schema for book create/update)
 │   ├── queries/
 │   │   └── books.ts            (getBooks, getBookById, createBook, updateBook, deleteBook, checkDuplicates, insertBooks)
 │   └── parsing/
 │       ├── kindle-parser.ts    (parseKindleText, parseKindleHtml, parseImageJson)
 │       ├── audible-parser.ts   (parseAudibleHtml)
 │       └── __tests__/          (parser unit tests)
 │
 ├── scripts/
 │   └── seed-users.ts           (create tverkon + dverkon users)
 │
 └── migrations/
     ├── 000_create_db.sql
     └── 001_create_tables.sql
```

### 5.2 Planned (not yet created)

```
src/
 ├── components/
 │   ├── layout/
 │   └── ui/
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

- **`getBooks(page, pageSize)`** — paginated book retrieval (default: page 1, 24 per page), ordered by `purchase_date DESC` then `sortable_title ASC`, returns `{ books, totalCount, totalPages }`
- **`getBookById(id)`** — fetch a single book by ID, returns `BookRow | null`
- **`createBook(data)`** — insert a single book, returns the created `BookRow`
- **`updateBook(id, data)`** — update a book by ID (sets `updated_at = NOW()`), returns updated `BookRow | null`
- **`deleteBook(id)`** — delete a book by ID, returns `boolean`
- **`checkDuplicates(books)`** — checks parsed books against DB using composite key (`book_type + title + authors + owner + purchase_date`), returns `{ newBooks, duplicates }`
- **`insertBooks(books)`** — bulk inserts in a single transaction with `ON CONFLICT DO NOTHING`, returns inserted count

---

## 7. Server Actions Design

**Implemented** in `app/books/actions.ts`. Three server actions for book CRUD:

- **`createBookAction(formData)`** — validates via Zod `bookSchema`, computes derived fields (`sortableTitle`, `searchableContent`), inserts book, calls `revalidatePath("/books")`
- **`updateBookAction(id, formData)`** — validates, computes derived fields, updates book, revalidates
- **`deleteBookAction(id)`** — deletes book, revalidates

**Derived fields** (computed server-side, not in form):
- `sortableTitle` — strips leading articles (A, An, The) from title
- `searchableContent` — lowercase concatenation of `title + authors`

**Validation schema** (`lib/schemas/book.ts`):

```ts
const bookSchema = z.object({
  bookType: z.enum(["KINDLE", "AUDIBLE", "TECHNICAL"]),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  image: z.string().default("https://via.placeholder.com/150x226/1ECBE1/ffffff"),
  owner: z.enum(["tverkon", "dverkon"]),
  authors: z.string().min(1),
  purchaseDate: z.string().min(1),
  series: z.string().nullable().default(null),
});
```

All actions return `{ success: true, ... }` or `{ success: false, error: string }`.

---

## 8. Bulk Import Flow (Kindle)

### 8.1 Implementation Status: COMPLETE

### 8.2 UX Flow

1. User navigates to `/purchases/import`
2. Selects import format via radio buttons: **HTML** (default), **Audible HTML**, or **Text**
3. Pastes content into textarea (HTML source for HTML/Audible modes, raw text for text mode)
4. In text mode, optionally pastes images JSON into second textarea
5. Clicks "Parse"
6. System:
   - Parses via `parseKindleHtml()`, `parseAudibleHtml()`, or `parseKindleText()` depending on format
   - For text mode: parses images via `parseImageJson()`, matches to books by position
   - Runs duplicate detection against DB
   - Returns structured preview split into "New Books" and "Duplicates"
7. User reviews preview table (title, authors, series, owner, date)
8. Clicks "Confirm Import"
9. System bulk inserts in transaction

### 8.3 Route Handler

`app/api/import/route.ts` — single POST endpoint with discriminated union:

- `action: "parse"` — validates input via Zod, parses based on format (`text`, `html`, `audible-html`), checks duplicates
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

**`parseKindleHtml(html)`** extracts books from Kindle library page source (preferred):
- Parses DOM using `node-html-parser`
- Targets `DigitalEntitySummary` class-based selectors
- Same extraction logic as text parser (owner, series, description, sortable title)
- Upgrades image URLs to SX450 resolution

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

**Implemented** at `lib/parsing/audible-parser.ts`.

**`parseAudibleHtml(html)`** extracts books from Audible library page source:
- Uses same DOM structure as Kindle HTML parser
- Parses `information_row` divs for metadata
- Owner and date extraction
- Image URL upgrading to higher resolution
- Sets `bookType` to `AUDIBLE`

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

### 10.2 Books Page (implemented)

Responsive card grid layout (not table):

```
[ Header: "Family Books (N total)" [+ New Book] [User | Logout] ]
-------------------------------------------------
| [img] [img] [img] [img] [img] [img]          |
| Title Title Title Title Title Title           |
| Auth  Auth  Auth  Auth  Auth  Auth            |
| Badge Badge Badge Badge Badge Badge           |
-------------------------------------------------
[ Pagination: < 1 2 ... 5 6 7 ... 10 > ]
```

- **Grid:** 6 columns on desktop, responsive down to 2 columns
- **Book cards:** cover image (lazy loaded), title, authors, series, type badge, owner label, hover scale effect
- **Double-click** on card opens detail modal with all book fields
- **Edit link** appears on card hover, navigates to `/books/[id]/edit`
- **Type badges:** color-coded — Kindle (blue), Audible (orange), Technical (emerald)
- **Pagination:** 24 books per page, smart pagination with ellipsis, previous/next buttons

### 10.3 Book Detail Modal (implemented)

Opened by double-clicking a book card. Uses native `<dialog>` element.

```
-------------------------------------------------
| Title                                    [X]  |
|                                               |
|              [ Cover Image ]                  |
|                                               |
| Authors:     ...                              |
| Type:        [Badge]                          |
| Owner:       ...                              |
| Series:      ...                              |
| Description: ...                              |
| Purchased:   ...                              |
| Added:       ...                              |
|                                               |
| [ Edit ]  [ Delete ]  [ Close ]              |
-------------------------------------------------
```

- Background color matches book type (AliceBlue/Beige/LightGray)
- Edit navigates to `/books/[id]/edit`
- Delete prompts `window.confirm()` before deleting

### 10.4 Create/Edit Book Form (implemented)

Shared form component (`book-form.tsx`) used at `/books/new` (create) and `/books/[id]/edit` (update).

Fields:

- Type (enum select: KINDLE, AUDIBLE, TECHNICAL)
- Owner (select: Tom, Denise)
- Title (required)
- Authors (required)
- Series (optional)
- Description (optional textarea)
- Image URL
- Purchase Date (text, e.g. "January 1, 2024")

Actions: Save, Delete (edit mode only), Cancel (returns to /books)

### 10.4 Import Page (implemented)

```
[ Kindle Book Import ]

[ Format: (o) HTML  ( ) Audible HTML  ( ) Text ]

-----------------------------------
| Textarea: Paste content here    |
-----------------------------------

(Text mode only:)
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

CRUD validation implemented via Zod in `lib/schemas/book.ts`:

- `bookSchema` — validates book form data for create/update (type, title, authors, owner, purchaseDate required; description, series, image optional with defaults)
- Used by Server Actions in `app/books/actions.ts` with `safeParse()`

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

## 16. Testing Strategy

- **Parser unit tests (implemented):** `src/lib/parsing/__tests__/`
  - `kindle-parser.test.ts` — tests for `parseKindleText`, `parseImageJson`, `parseKindleHtml` (series extraction, owner resolution, title cleaning, noise line handling, multiple books)
  - `audible-parser.test.ts` — tests for `parseAudibleHtml`
- Duplicate detection tests (not yet)
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
- [x] Kindle HTML parser (`parseKindleHtml`) — preferred import method
- [x] Audible HTML parser (`parseAudibleHtml`)
- [x] Image JSON parser for Amazon cover URLs
- [x] Duplicate detection query
- [x] Bulk insert with transaction + conflict handling
- [x] Import API route with Zod validation (supports text, html, audible-html formats)
- [x] Import UI page (format toggle + parse + preview + confirm)
- [x] Sample data files (`kindle-01.txt`, `kindle-01-images.json`)
- [x] Books list page with responsive card grid and pagination (24 per page)
- [x] better-auth integration (library install + config + auth route handler)
- [x] Login page with email/password form
- [x] Auth client (`signIn`, `signOut`, `useSession`)
- [x] Route protection middleware (`proxy.ts`)
- [x] Password validation rules (`password.ts`)
- [x] User seed script (`scripts/seed-users.ts`)
- [x] Parser unit tests (Kindle text, Kindle HTML, Audible HTML, image JSON)
- [x] `getBooks` paginated query
- [x] Full CRUD: Server Actions (`createBookAction`, `updateBookAction`, `deleteBookAction`)
- [x] Zod validation schema for book create/update (`lib/schemas/book.ts`)
- [x] CRUD query functions (`getBookById`, `createBook`, `updateBook`, `deleteBook`)
- [x] Book detail modal (double-click card → native `<dialog>` with all fields)
- [x] Create book page (`/books/new`) with shared form component
- [x] Edit book page (`/books/[id]/edit`) with shared form component
- [x] Delete with confirmation (from modal and edit page)
- [x] UserNav component (username + logout) on all pages

### Not Yet Started

- [ ] Dashboard page
- [ ] Book filtering (type, author, title, date range, owner)
- [ ] Tags system
- [ ] Database indexes
- [ ] Component library (`components/` directory)
