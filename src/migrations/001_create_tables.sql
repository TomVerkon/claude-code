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
