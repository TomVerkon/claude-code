"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BookRow } from "@/lib/queries/books";
import { cn } from "@/lib/cn";
import { ownerLabel, typeBadgeClass, typeCardBgClass, typeLabel } from "@/lib/book-display";
import { BookDetailModal } from "./book-detail-modal";
import { deleteBookAction } from "./actions";

export function BookGrid({ books }: { books: BookRow[] }) {
  const [selectedBook, setSelectedBook] = useState<BookRow | null>(null);
  const router = useRouter();

  async function handleDelete(id: number) {
    const result = await deleteBookAction(id);
    if (result.success) {
      setSelectedBook(null);
      router.refresh();
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {books.map((book) => {
          const cardBg = typeCardBgClass(book.book_type);
          return (
            <div
              key={book.id}
              onDoubleClick={() => setSelectedBook(book)}
              className={cn(
                "group rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 hover:-translate-y-1 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer select-none",
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

              <div className="p-3 space-y-1.5">
                <h2 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
                  {book.title}
                </h2>
                <p className="text-xs text-gray-500 leading-snug line-clamp-1">
                  {book.authors}
                </p>
                {book.series && (
                  <p className="text-xs text-indigo-600 leading-snug line-clamp-1">
                    {book.series}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded-full", typeBadgeClass(book.book_type))}>
                    {typeLabel(book.book_type)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-gray-400">
                      {ownerLabel(book.owner)}
                    </span>
                    <Link
                      href={`/books/${book.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-2xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BookDetailModal
        book={selectedBook}
        open={selectedBook !== null}
        onClose={() => setSelectedBook(null)}
        onDelete={handleDelete}
      />
    </>
  );
}
