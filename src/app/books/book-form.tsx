"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookRow } from "@/lib/queries/books";
import { bookSchema } from "@/lib/schemas/book";
import { createBookAction, updateBookAction, deleteBookAction } from "./actions";

export function BookForm({ book }: { book?: BookRow }) {
  const isEdit = !!book;
  const router = useRouter();

  const [bookType, setBookType] = useState(book?.book_type ?? "KINDLE");
  const [title, setTitle] = useState(book?.title ?? "");
  const [authors, setAuthors] = useState(book?.authors ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [image, setImage] = useState(book?.image ?? "https://via.placeholder.com/150x226/1ECBE1/ffffff");
  const [owner, setOwner] = useState(book?.owner ?? "tverkon");
  const [purchaseDate, setPurchaseDate] = useState(book?.purchase_date ?? "");
  const [series, setSeries] = useState(book?.series ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = {
      bookType: bookType as "KINDLE" | "AUDIBLE" | "TECHNICAL",
      title: title.trim(),
      description: description.trim() || null,
      image: image.trim(),
      owner: owner as "tverkon" | "dverkon",
      authors: authors.trim(),
      purchaseDate: purchaseDate.trim(),
      series: series.trim() || null,
    };

    const parsed = bookSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const result = isEdit
      ? await updateBookAction(book!.id, parsed.data)
      : await createBookAction(parsed.data);

    if (result.success) {
      router.push("/books");
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!book || !window.confirm(`Delete "${book.title}"?`)) return;
    setLoading(true);
    const result = await deleteBookAction(book.id);
    if (result.success) {
      router.push("/books");
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="bookType" className={labelClass}>Type</label>
          <select id="bookType" value={bookType} onChange={(e) => setBookType(e.target.value)} className={inputClass}>
            <option value="KINDLE">Kindle</option>
            <option value="AUDIBLE">Audible</option>
            <option value="TECHNICAL">Technical</option>
          </select>
        </div>

        <div>
          <label htmlFor="owner" className={labelClass}>Owner</label>
          <select id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
            <option value="tverkon">Tom</option>
            <option value="dverkon">Denise</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>Title</label>
        <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="authors" className={labelClass}>Authors</label>
        <input id="authors" type="text" required value={authors} onChange={(e) => setAuthors(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="series" className={labelClass}>Series</label>
        <input id="series" type="text" value={series} onChange={(e) => setSeries(e.target.value)} className={inputClass} placeholder="Optional" />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={3} placeholder="Optional" />
      </div>

      <div>
        <label htmlFor="image" className={labelClass}>Image URL</label>
        <input id="image" type="text" value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="purchaseDate" className={labelClass}>Purchase Date</label>
        <input id="purchaseDate" type="text" required value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputClass} placeholder="e.g. January 1, 2024" />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : isEdit ? "Update Book" : "Create Book"}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push("/books")}
          className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm font-medium hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
