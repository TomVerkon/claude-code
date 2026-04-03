"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BookRow } from "@/lib/queries/books";
import { BookDetailModal } from "./book-detail-modal";
import { deleteBookAction } from "./actions";

function ownerLabel(owner: string): string {
  if (owner === "tverkon") return "Tom";
  if (owner === "dverkon") return "Denise";
  return owner;
}

function typeLabel(bookType: string): string {
  if (bookType === "KINDLE") return "Kindle";
  if (bookType === "AUDIBLE") return "Audible";
  if (bookType === "TECHNICAL") return "Technical";
  return bookType;
}

function typeBadgeColor(bookType: string): string {
  if (bookType === "KINDLE") return "bg-blue-100 text-blue-700";
  if (bookType === "AUDIBLE") return "bg-orange-100 text-orange-700";
  if (bookType === "TECHNICAL") return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 text-gray-700";
}

function cardBgColor(bookType: string): string {
  if (bookType === "KINDLE") return "AliceBlue";
  if (bookType === "AUDIBLE") return "Beige";
  if (bookType === "TECHNICAL") return "LightGray";
  return "white";
}

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
        {books.map((book) => (
          <div
            key={book.id}
            onDoubleClick={() => setSelectedBook(book)}
            style={{ backgroundColor: cardBgColor(book.book_type) }}
            className="group rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 hover:-translate-y-1 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer select-none"
          >
            {/* Cover image */}
            <div className="aspect-[2/3] overflow-hidden" style={{ backgroundColor: cardBgColor(book.book_type) }}>
              <img
                src={book.image}
                alt={book.title}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                loading="lazy"
              />
            </div>

            {/* Info */}
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
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeBadgeColor(book.book_type)}`}>
                  {typeLabel(book.book_type)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {ownerLabel(book.owner)}
                  </span>
                  <Link
                    href={`/books/${book.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
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
