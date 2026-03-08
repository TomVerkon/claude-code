import Link from "next/link";

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const pages = getPageNumbers(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 mt-8 pb-8" aria-label="Pagination">
      {/* Previous */}
      {page > 1 ? (
        <Link
          href={`/books?page=${page - 1}`}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Prev
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm font-medium text-gray-300 bg-white border border-gray-200 rounded-lg cursor-not-allowed">
          Prev
        </span>
      )}

      {/* Mobile: "Page X of Y" */}
      <span className="sm:hidden px-3 py-2 text-sm text-gray-500">
        Page {page} of {totalPages}
      </span>

      {/* Desktop: numbered pages */}
      <span className="hidden sm:contents">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-400">
              ...
            </span>
          ) : p === page ? (
            <span
              key={p}
              className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg min-w-[40px] text-center"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={`/books?page=${p}`}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[40px] text-center"
            >
              {p}
            </Link>
          )
        )}
      </span>

      {/* Next */}
      {page < totalPages ? (
        <Link
          href={`/books?page=${page + 1}`}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm font-medium text-gray-300 bg-white border border-gray-200 rounded-lg cursor-not-allowed">
          Next
        </span>
      )}
    </nav>
  );
}

/**
 * Generate page numbers with ellipsis for large ranges.
 * Always shows first, last, and a window around the current page.
 */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show page 1
  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  // Window around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  // Always show last page
  pages.push(total);

  return pages;
}
