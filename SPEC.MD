# App Specification

## 1. System Overview

### 1.1 Architecture Style

Monolithic Next.js App Router application:

- **UI:** React Server Components + Client Components
- **Business logic:** Server Actions
- **Bulk parsing endpoint:** Route Handler (`app/api/import/route.ts`)
- **Database access:**<mark> Direct `pg` clien</mark>t
- **Auth:** better-auth (session-based)
- **Validation:** Zod
- **Database:** PostgreSQL
- **Migration strategy:** <mark>Versioned raw SQL files</mark>

This is intentionally simple and production-ready without unnecessary abstraction.

---

## 2. High-Level Architecture

```
Browser
  ↓
Next.js App Router
  ├── Server Components (data fetch)
  ├── Client Components (forms, import UI)
  ├── Server Actions (CRUD)
  └── Route Handler (/api/import)
  ↓
Database Layer (pg)
  ↓
PostgreSQL
```

---

## 3. Domain Model

### 3.1 Core Entities

- User
- <mark>Purchase</mark>
- ~~Tag *(optional v2)*~~
- ~~PurchaseTag *(optional v2)~~*

Since tagging is desired but not required for CSV export, we will include tagging in schema v1.

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
CREATE TABLE books (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_type          TEXT NOT NULL,
    title              TEXT NOT NULL,
    description        TEXT,
    image              TEXT NOT NULL DEFAULT 'https://via.placeholder.com/150x226/1ECBE1/ffffff',
    owner              TEXT NOT NULL,
    readers            TEXT NOT NULL DEFAULT 'tverkon|0|1,dverkon|0|1',
    series             TEXT,
    authors            TEXT NOT NULL,
    sortable_title     TEXT NOT NULL,
    searchable_content TEXT NOT NULL,
    purchase_date      TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_books_duplicate UNIQUE (title, authors, owner, purchase_date)
);
```

> Duplicate detection: composite unique constraint on `title + authors + owner + purchase_date`.

#### `tags` *(optional but included)*

```sql
CREATE TABLE tags (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);
```

#### `book_tags`

```sql
CREATE TABLE book_tags (
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);
```

---

## 4. Auth Model

Using better-auth:

- Email + password
- No public registration
- Admin manually inserts users (via direct DB insert or admin script)
- Forgot password supported (via `verification` table tokens)
- Session-based auth

**better-auth config (`lib/auth.ts`) — relevant excerpt:**

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

| Action          | ADMIN | USER |
| --------------- |:-----:|:----:|
| View purchases  | ✅     | ✅    |
| Create purchase | ✅     | ✅    |
| Update purchase | ✅     | ✅    |
| Delete purchase | ✅     | ❌    |
| Bulk import     | ✅     | ✅    |

All data shared across family.

---

## 5. Application Structure

### 5.1 Folder Structure

```
src/
 ├── app/
 │   ├── layout.tsx
 │   ├── page.tsx (dashboard)
 │   ├── login/
 │   ├── purchases/
 │   │   ├── page.tsx
 │   │   ├── new/
 │   │   ├── [id]/
 │   │   └── import/
 │   ├── api/
 │   │   ├── auth/
 │   │   │   └── [...all]/
 │   │   │       └── route.ts  (better-auth handler)
 │   │   └── import/
 │   │       └── route.ts
 │
 ├── components/
 │   ├── layout/
 │   ├── purchases/
 │   ├── forms/
 │   ├── tables/
 │   └── ui/
 │
 ├── lib/
 │   ├── db.ts
 │   ├── auth.ts
 │   ├── queries/
 │   ├── actions/
 │   ├── validation/
 │   └── parsing/
 │
 ├── migrations/
 │   ├── 000_create_db.sql
 │   └── 001_create_tables.sql
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

---

## 7. Server Actions Design

Use Server Actions for:

- `createPurchase`
- `updatePurchase`
- `deletePurchase`
- `createTag`
- etc.

**Pattern:**

```ts
"use server";

export async function createPurchase(input: CreatePurchaseInput) {
  const parsed = createPurchaseSchema.parse(input);
  // auth check
  // db transaction
}
```

All validation via Zod before DB access.

---

## 8. Bulk Import Flow (Kindle / Audible)

### 8.1 UX Flow

1. User navigates to `/purchases/import`
2. Pastes large TXT content
3. Clicks "Parse"
4. System:
   - Parses text
   - Runs duplicate detection
   - Returns structured preview
5. User confirms
6. System bulk inserts in transaction

### 8.2 Route Handler

`app/api/import/route.ts`

**Reasons:**

- Large payload
- Potential streaming
- Clean separation from CRUD actions

### 8.3 Parsing Layer

```
lib/parsing/
 ├── kindle-parser.ts
 ├── audible-parser.ts
 └── duplicate-detector.ts
```

Each parser returns:

```ts
type ParsedBook = {
  bookType: string;
  title: string;
  authors: string;
  owner: string;
  purchaseDate: string;
  sortableTitle: string;
  searchableContent: string;
};
```

**Duplicate detection:**

- Query DB for matching `title + authors + owner + purchase_date`
- Mark duplicates in preview

**Final insert:**

- Use single transaction
- Rollback on error

---

## 9. Filtering Design

We will support filtering by:

- Type
- Author (ILIKE search)
- Title (ILIKE search)
- Date range
- Tags
- `created_by`

**Implementation:**

- URL search params
- Server Component fetch with dynamic SQL builder

**Example:**

```
/purchases?type=KINDLE&author=martin&from=2023-01-01
```

Dynamic query builder in `lib/queries/purchases.ts`.

---

## 10. UI Wireframe (High-Level)

### 10.1 Layout

```
-------------------------------------------------
| Header: App Name | User | Logout             |
-------------------------------------------------
| Sidebar          | Main Content              |
| - Dashboard      |                           |
| - Purchases      |                           |
| - Import         |                           |
-------------------------------------------------
```

### 10.2 Purchases Page

```
[ Filter Bar ]
-------------------------------------------------
| Title | Author | Type | Date | Actions      |
-------------------------------------------------
| Book  | Name   | K    | 2024 | Edit/Delete  |
```

Pagination optional (5,000 records manageable, but add `LIMIT 50`).

### 10.3 Create/Edit Form

Fields:

- Type (enum select)
- Title
- Authors (comma-separated → array)
- Purchase Date
- Price
- External ID
- Tags (multi-select, optional)

### 10.4 Import Page

```
[ Select Type: Kindle / Audible ]

-----------------------------------
| Large Textarea                  |
-----------------------------------

[ Parse ]

-----------------------------------
| Preview Table with duplicates   |
-----------------------------------

[ Confirm Import ]
```

---

## 11. Validation Strategy

All input validated via Zod:

```
lib/validation/
 ├── purchase.ts
 ├── import.ts
 └── auth.ts
```

**Zod rules:**

- Title required
- Authors non-empty
- Price positive
- Date valid

---

## 12. Indexing Strategy

To support 5,000 records efficiently:

```sql
CREATE INDEX idx_purchases_type ON purchases(type);
CREATE INDEX idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_created_by ON purchases(created_by);
CREATE INDEX idx_purchases_title_trgm ON purchases USING gin (title gin_trgm_ops);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 13. Migration Strategy

```
src/migrations/
  000_create_db.sql
  001_create_tables.sql
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

- Zod → validation errors
- Database errors → mapped to domain errors
- Duplicate detection → preview stage, not runtime failure
- All Server Actions wrapped in `try/catch`

---

## 16. Testing Strategy (Recommended)

- Unit tests for parsers
- Duplicate detection tests
- SQL integration tests (optional)
- Fixture TXT files for Kindle/Audible

---

## 17. Performance Considerations

- 5,000 records trivial for Postgres
- Bulk import:
  - Use single `INSERT` with multiple values
  - Or `pg COPY` (optional future optimization)
  - Use transactions

---

## 18. Future Extensibility

Designed to support:

- Multiple families (add `family_id` column)
- Spending analytics
- CSV export
- Soft deletes
- File uploads instead of paste
- Per-user visibility

## 19. Open Questions

To finalize this spec completely, the following inputs are needed:

- [ ] Kindle TXT format example
- [ ] Audible TXT format example
- [ ] Duplicate detection rule (composite key definition)
- [ ] Hard delete vs. soft delete for purchases
- [ ] Audit logging required?

Once resolved, the following will be produced:

- Finalized DB schema
- Duplicate detection SQL strategy
- Import transaction logic
- Complete server action contracts
- Example SQL queries for advanced filtering
- Concrete code skeleton for core layers