import { notFound } from "next/navigation";
import { getBookById } from "@/lib/queries/books";
import { BookForm } from "../../book-form";
import { AppHeader } from "../../../app-header";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await getBookById(parseInt(id, 10));

  if (!book) notFound();

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6">
          Edit Book
        </h1>
        <BookForm book={book} />
      </div>
    </main>
  );
}
