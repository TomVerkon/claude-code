import { pool } from "../db";
import type { ParsedBook } from "../parsing/kindle-parser";

export type DuplicateCheckResult = {
  newBooks: ParsedBook[];
  duplicates: ParsedBook[];
};

/**
 * Check which parsed books already exist in the database.
 * Duplicate = same title + authors + owner + purchase_date.
 */
export async function checkDuplicates(
  books: ParsedBook[]
): Promise<DuplicateCheckResult> {
  if (books.length === 0) return { newBooks: [], duplicates: [] };

  // Build a query to find existing books matching any of the parsed books
  const conditions: string[] = [];
  const values: string[] = [];
  let paramIndex = 1;

  for (const book of books) {
    conditions.push(
      `(title = $${paramIndex} AND authors = $${paramIndex + 1} AND owner = $${paramIndex + 2} AND purchase_date = $${paramIndex + 3})`
    );
    values.push(book.title, book.authors, book.owner, book.purchaseDate);
    paramIndex += 4;
  }

  const query = `
    SELECT title, authors, owner, purchase_date
    FROM books
    WHERE ${conditions.join(" OR ")}
  `;

  const result = await pool.query(query, values);

  const existingSet = new Set(
    result.rows.map(
      (r: { title: string; authors: string; owner: string; purchase_date: string }) =>
        `${r.title}||${r.authors}||${r.owner}||${r.purchase_date}`
    )
  );

  const newBooks: ParsedBook[] = [];
  const duplicates: ParsedBook[] = [];

  for (const book of books) {
    const key = `${book.title}||${book.authors}||${book.owner}||${book.purchaseDate}`;
    if (existingSet.has(key)) {
      duplicates.push(book);
    } else {
      newBooks.push(book);
    }
  }

  return { newBooks, duplicates };
}

/**
 * Bulk insert new books in a single transaction.
 */
export async function insertBooks(books: ParsedBook[]): Promise<number> {
  if (books.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const valuePlaceholders: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    for (const book of books) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        book.bookType,
        book.title,
        book.owner,
        book.authors,
        book.sortableTitle,
        book.searchableContent,
        book.purchaseDate,
        book.series ?? null as unknown as string
      );
      paramIndex += 8;
    }

    const query = `
      INSERT INTO books (book_type, title, owner, authors, sortable_title, searchable_content, purchase_date, series)
      VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT ON CONSTRAINT uq_books_duplicate DO NOTHING
    `;

    const result = await client.query(query, values);
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
