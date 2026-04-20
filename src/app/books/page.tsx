import { getBooks } from "@/lib/queries/books";
import { BookGrid } from "./book-grid";
import { Pagination } from "./pagination";
import { AppHeader } from "../app-header";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { books, total, totalPages } = await getBooks(page);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">
            {total} book{total !== 1 ? "s" : ""}
          </span>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No books yet.</p>
            <a href="/purchases/import" className="text-accent hover:underline mt-2 inline-block">
              Import some books
            </a>
          </div>
        ) : (
          <>
            <BookGrid books={books} />
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
