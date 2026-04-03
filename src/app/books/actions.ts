"use server";

import { revalidatePath } from "next/cache";
import { bookSchema, type BookFormData } from "@/lib/schemas/book";
import {
  createBook,
  updateBook,
  deleteBook,
  type BookInput,
} from "@/lib/queries/books";

function stripArticles(text: string): string {
  return text.replace(/^(a |an |the )/i, "").trim();
}

function toBookInput(data: BookFormData): BookInput {
  return {
    bookType: data.bookType,
    title: data.title,
    description: data.description,
    image: data.image,
    owner: data.owner,
    authors: data.authors,
    sortableTitle: stripArticles(data.title),
    searchableContent: `${data.title} ${data.authors}`.toLowerCase(),
    purchaseDate: data.purchaseDate,
    series: data.series,
  };
}

export async function createBookAction(formData: BookFormData) {
  const parsed = bookSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }
  try {
    const book = await createBook(toBookInput(parsed.data));
    revalidatePath("/books");
    return { success: true as const, id: book.id };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to create book" };
  }
}

export async function updateBookAction(id: number, formData: BookFormData) {
  const parsed = bookSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }
  try {
    const book = await updateBook(id, toBookInput(parsed.data));
    if (!book) {
      return { success: false as const, error: "Book not found" };
    }
    revalidatePath("/books");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to update book" };
  }
}

export async function deleteBookAction(id: number) {
  try {
    const deleted = await deleteBook(id);
    if (!deleted) {
      return { success: false as const, error: "Book not found" };
    }
    revalidatePath("/books");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to delete book" };
  }
}
