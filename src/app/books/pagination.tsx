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
      {page > 1 ? (
        <Link
          href={`/books?page=${page - 1}`}
          className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          Prev
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg cursor-not-allowed opacity-50">
          Prev
        </span>
      )}

      <span className="sm:hidden px-3 py-2 text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>

      <span className="hidden sm:contents">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-muted-foreground">
              ...
            </span>
          ) : p === page ? (
            <span
              key={p}
              className="px-3 py-2 text-sm font-semibold text-accent-fg bg-accent rounded-lg min-w-10 text-center"
            >
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={`/books?page=${p}`}
              className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors min-w-10 text-center"
            >
              {p}
            </Link>
          )
        )}
      </span>

      {page < totalPages ? (
        <Link
          href={`/books?page=${page + 1}`}
          className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg cursor-not-allowed opacity-50">
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

  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}
