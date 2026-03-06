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