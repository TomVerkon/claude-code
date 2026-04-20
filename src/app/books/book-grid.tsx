import Link from "next/link";
import type { BookRow } from "@/lib/queries/books";
import { cn } from "@/lib/cn";
import { ownerLabel, typeBadgeClass, typeCardBgClass, typeLabel } from "@/lib/book-display";

export function BookGrid({ books }: { books: BookRow[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {books.map((book) => {
        const cardBg = typeCardBgClass(book.book_type);
        return (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className={cn(
              "group block rounded-xl shadow-sm border border-border overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 select-none",
              cardBg,
            )}
          >
            <div className={cn("aspect-2/3 overflow-hidden", cardBg)}>
              <img
                src={book.image}
                alt={book.title}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                loading="lazy"
              />
            </div>

            <div className="p-3 space-y-1.5 text-foreground">
              <h2 className="text-sm font-semibold leading-tight line-clamp-2">
                {book.title}
              </h2>
              <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
                {book.authors}
              </p>
              {book.series && (
                <p className="text-xs italic text-foreground leading-snug line-clamp-1">
                  {book.series}
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded-full", typeBadgeClass(book.book_type))}>
                  {typeLabel(book.book_type)}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {ownerLabel(book.owner)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
