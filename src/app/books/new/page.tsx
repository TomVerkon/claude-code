import { BookForm } from "../book-form";
import { AppHeader } from "../../app-header";

export default function NewBookPage() {
  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-6">
          New Book
        </h1>
        <BookForm />
      </div>
    </main>
  );
}
