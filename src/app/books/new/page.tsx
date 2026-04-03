import { BookForm } from "../book-form";
import { UserNav } from "../../user-nav";

export default function NewBookPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            New Book
          </h1>
          <UserNav />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <BookForm />
      </div>
    </main>
  );
}
