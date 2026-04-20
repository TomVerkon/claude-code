"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBookAction } from "../actions";

export function DeleteBookButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setDeleting(true);
    setError(null);
    const result = await deleteBookAction(id);
    if (result.success) {
      router.push("/books");
      router.refresh();
    } else {
      setDeleting(false);
      setError(result.error);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-sm text-muted-foreground hover:text-red-600 hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline sm:self-center"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 sm:self-center">
          {error}
        </p>
      )}
    </>
  );
}
