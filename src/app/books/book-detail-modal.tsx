"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { BookRow } from "@/lib/queries/books";

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

export function BookDetailModal({
  book,
  open,
  onClose,
  onDelete,
}: {
  book: BookRow | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  if (!book) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-xl shadow-xl border border-gray-200 p-0 max-w-lg w-full backdrop:bg-black/50"
    >
      <div style={{ backgroundColor: cardBgColor(book.book_type) }} className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-gray-900 leading-tight pr-4">{book.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Cover image */}
        <div className="flex justify-center">
          <img
            src={book.image}
            alt={book.title}
            className="max-h-64 object-contain rounded"
          />
        </div>

        {/* Details */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-gray-500">Authors</dt>
          <dd className="text-gray-900">{book.authors}</dd>

          <dt className="font-medium text-gray-500">Type</dt>
          <dd>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadgeColor(book.book_type)}`}>
              {typeLabel(book.book_type)}
            </span>
          </dd>

          <dt className="font-medium text-gray-500">Owner</dt>
          <dd className="text-gray-900">{ownerLabel(book.owner)}</dd>

          {book.series && (
            <>
              <dt className="font-medium text-gray-500">Series</dt>
              <dd className="text-indigo-600">{book.series}</dd>
            </>
          )}

          {book.description && (
            <>
              <dt className="font-medium text-gray-500">Description</dt>
              <dd className="text-gray-900">{book.description}</dd>
            </>
          )}

          <dt className="font-medium text-gray-500">Purchased</dt>
          <dd className="text-gray-900">{book.purchase_date}</dd>

          <dt className="font-medium text-gray-500">Added</dt>
          <dd className="text-gray-900">{new Date(book.created_at).toLocaleDateString()}</dd>
        </dl>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Link
            href={`/books/${book.id}/edit`}
            className="flex-1 text-center bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Edit
          </Link>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${book.title}"?`)) {
                onDelete(book.id);
              }
            }}
            className="flex-1 text-center bg-red-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-center bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm font-medium hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
