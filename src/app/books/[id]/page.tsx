import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookById } from "@/lib/queries/books";
import { AppHeader } from "../../app-header";
import { cn } from "@/lib/cn";
import { ownerLabel, typeBadgeClass, typeCardBgClass, typeLabel } from "@/lib/book-display";
import { DeleteBookButton } from "./delete-button";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (Number.isNaN(bookId)) notFound();

  const book = await getBookById(bookId);
  if (!book) notFound();

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/books"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <span aria-hidden="true">&larr;</span> Back to Library
        </Link>

        <article
          className={cn(
            "rounded-xl shadow-sm border border-border overflow-hidden",
            typeCardBgClass(book.book_type),
          )}
        >
          <div className="grid md:grid-cols-[260px_1fr] gap-6 p-5 sm:p-6 text-foreground">
            <div className="flex justify-center md:block">
              <img
                src={book.image}
                alt={book.title}
                className="max-h-72 md:max-h-none md:w-full object-contain rounded"
              />
            </div>

            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                  {book.title}
                </h1>
                {book.series && (
                  <p className="italic text-foreground mt-1 text-sm">{book.series}</p>
                )}
              </div>

              <div>
                <span
                  className={cn(
                    "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                    typeBadgeClass(book.book_type),
                  )}
                >
                  {typeLabel(book.book_type)}
                </span>
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">Authors</dt>
                <dd>{book.authors}</dd>

                <dt className="font-medium text-muted-foreground">Owner</dt>
                <dd>{ownerLabel(book.owner)}</dd>

                <dt className="font-medium text-muted-foreground">Purchased</dt>
                <dd>{book.purchase_date}</dd>

                <dt className="font-medium text-muted-foreground">Added</dt>
                <dd>{new Date(book.created_at).toLocaleDateString()}</dd>

                {book.description && (
                  <>
                    <dt className="font-medium text-muted-foreground">Description</dt>
                    <dd>{book.description}</dd>
                  </>
                )}
              </dl>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4">
                <DeleteBookButton id={book.id} title={book.title} />
                <Link href={`/books/${book.id}/edit`} className="btn-primary px-5">
                  Edit
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
