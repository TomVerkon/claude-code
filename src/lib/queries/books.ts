import { pool } from "../db";
import type { ParsedBook } from "../parsing/kindle-parser";

export type BookRow = {
  id: number;
  book_type: string;
  title: string;
  description: string | null;
  image: string;
  owner: string;
  readers: string;
  series: string | null;
  authors: string;
  sortable_title: string;
  searchable_content: string;
  purchase_date: string;
  created_at: string;
  updated_at: string;
};

export type BooksPage = {
  books: BookRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Fetch a paginated list of books, ordered by sortable_title.
 */
export async function getBooks(page = 1, pageSize = 24): Promise<BooksPage> {
  const offset = (page - 1) * pageSize;

  const [countResult, booksResult] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM books"),
    pool.query(
      `SELECT id, book_type, title, description, image, owner, readers, series, authors, sortable_title, searchable_content, purchase_date, created_at, updated_at
       FROM books
       ORDER BY purchase_date DESC, sortable_title ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    books: booksResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type DuplicateCheckResult = {
  newBooks: ParsedBook[];
  duplicates: ParsedBook[];
};

/**
 * Check which parsed books already exist in the database.
 * Duplicate = same book_type + title + authors + owner + purchase_date.
 */
export async function checkDuplicates(
  books: ParsedBook[]
): Promise<DuplicateCheckResult> {
  if (books.length === 0) return { newBooks: [], duplicates: [] };

  const conditions: string[] = [];
  const values: string[] = [];
  let paramIndex = 1;

  for (const book of books) {
    conditions.push(
      `(book_type = $${paramIndex} AND title = $${paramIndex + 1} AND authors = $${paramIndex + 2} AND owner = $${paramIndex + 3} AND purchase_date = $${paramIndex + 4})`
    );
    values.push(book.bookType, book.title, book.authors, book.owner, book.purchaseDate);
    paramIndex += 5;
  }

  const query = `
    SELECT book_type, title, authors, owner, purchase_date
    FROM books
    WHERE ${conditions.join(" OR ")}
  `;

  const result = await pool.query(query, values);

  const existingSet = new Set(
    result.rows.map(
      (r: { book_type: string; title: string; authors: string; owner: string; purchase_date: string }) =>
        `${r.book_type}||${r.title}||${r.authors}||${r.owner}||${r.purchase_date}`
    )
  );

  const newBooks: ParsedBook[] = [];
  const duplicates: ParsedBook[] = [];

  for (const book of books) {
    const key = `${book.bookType}||${book.title}||${book.authors}||${book.owner}||${book.purchaseDate}`;
    if (existingSet.has(key)) {
      duplicates.push(book);
    } else {
      newBooks.push(book);
    }
  }

  return { newBooks, duplicates };
}

export type BookInput = {
  bookType: string;
  title: string;
  description: string | null;
  image: string;
  owner: string;
  authors: string;
  sortableTitle: string;
  searchableContent: string;
  purchaseDate: string;
  series: string | null;
};

/**
 * Fetch a single book by ID.
 */
export async function getBookById(id: number): Promise<BookRow | null> {
  const result = await pool.query(
    `SELECT id, book_type, title, description, image, owner, readers, series, authors,
            sortable_title, searchable_content, purchase_date, created_at, updated_at
     FROM books WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * Create a single book.
 */
export async function createBook(data: BookInput): Promise<BookRow> {
  const result = await pool.query(
    `INSERT INTO books (book_type, title, description, image, owner, authors, sortable_title, searchable_content, purchase_date, series)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [data.bookType, data.title, data.description, data.image, data.owner, data.authors, data.sortableTitle, data.searchableContent, data.purchaseDate, data.series]
  );
  return result.rows[0];
}

/**
 * Update a book by ID.
 */
export async function updateBook(id: number, data: BookInput): Promise<BookRow | null> {
  const result = await pool.query(
    `UPDATE books
     SET book_type = $1, title = $2, description = $3, image = $4, owner = $5,
         authors = $6, sortable_title = $7, searchable_content = $8, purchase_date = $9,
         series = $10, updated_at = NOW()
     WHERE id = $11
     RETURNING *`,
    [data.bookType, data.title, data.description, data.image, data.owner, data.authors, data.sortableTitle, data.searchableContent, data.purchaseDate, data.series, id]
  );
  return result.rows[0] ?? null;
}

/**
 * Delete a book by ID.
 */
export async function deleteBook(id: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM books WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
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
    const values: (string | null)[] = [];
    let paramIndex = 1;

    for (const book of books) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`
      );
      values.push(
        book.bookType,
        book.title,
        book.description,
        book.image,
        book.owner,
        book.authors,
        book.sortableTitle,
        book.searchableContent,
        book.purchaseDate,
        book.series
      );
      paramIndex += 10;
    }

    const query = `
      INSERT INTO books (book_type, title, description, image, owner, authors, sortable_title, searchable_content, purchase_date, series)
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
