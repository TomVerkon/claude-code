-- Clear existing books and add an asin column.
-- Context: the user is re-importing the entire Kindle + Audible library from
-- scratch under the new parsers (which now capture ASIN from Amazon HTML), so
-- a truncate-and-reload is cleaner than a per-row backfill.
--
-- ASIN is stored as a nullable TEXT. No unique constraint yet — the same ASIN
-- can legitimately appear twice (different owners), and manual-form entries
-- have no ASIN. Future enrichment flows will key on (asin, owner).
--
-- Apply with: psql "$DATABASE_URL" -f src/migrations/003_truncate_and_add_asin.sql

TRUNCATE TABLE books RESTART IDENTITY;

ALTER TABLE books ADD COLUMN IF NOT EXISTS asin TEXT;
