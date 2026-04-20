-- Strip trailing series parenthetical from title for rows that were imported
-- under the previous parser, which kept the series paren in title.
-- New parser stores title without the "(Series Book N)" suffix; this aligns
-- existing rows with that convention.
--
-- Note: the uq_books_duplicate constraint includes (title, ...). If two rows
-- differ only in their series paren, this UPDATE will fail with a unique
-- violation. Inspect conflicts manually if it happens.

UPDATE books
SET title = regexp_replace(title, '\s*\([^()]+\)\s*$', '')
WHERE series IS NOT NULL
  AND title ~ '\([^()]+\)\s*$';
