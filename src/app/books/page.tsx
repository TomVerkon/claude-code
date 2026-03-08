import { getBooks } from "@/lib/queries/books";
import { BookGrid } from "./book-grid";
import { Pagination } from "./pagination";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { books, total, totalPages } = await getBooks(page);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Family Books
          </h1>
          <span className="text-sm text-gray-500">
            {total} book{total !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {books.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No books yet.</p>
            <a href="/purchases/import" className="text-blue-600 hover:underline mt-2 inline-block">
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
