"use client";

import { useState } from "react";
import { AppHeader } from "../../app-header";

type ParsedBook = {
  bookType: "KINDLE" | "AUDIBLE" | "TECHNICAL";
  title: string;
  description: string | null;
  image: string;
  authors: string;
  owner: "tverkon" | "dverkon";
  purchaseDate: string;
  sortableTitle: string;
  searchableContent: string;
  series: string | null;
};

type ParseResult = {
  newBooks: ParsedBook[];
  duplicates: ParsedBook[];
};

type ImportFormat = "text" | "html" | "audible-html";

export default function ImportPage() {
  const [format, setFormat] = useState<ImportFormat>("html");
  const [rawText, setRawText] = useState("");
  const [imagesJson, setImagesJson] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setLoading(true);
    setError(null);
    setParseResult(null);
    setImportCount(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parse",
          format,
          rawText,
          imagesJson: format === "text" ? (imagesJson || undefined) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Parse failed");
      }

      const data: ParseResult = await res.json();
      setParseResult(data);
      setRawText("");
      setImagesJson("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!parseResult) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", books: parseResult.newBooks }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await res.json();
      setImportCount(data.inserted);
      setParseResult(null);
      setRawText("");
      setImagesJson("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Book Import</h1>

      {/* Format toggle */}
      <div className="mb-4 flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="format"
            value="html"
            checked={format === "html"}
            onChange={() => { setFormat("html"); setRawText(""); setImagesJson(""); setParseResult(null); setError(null); }}
            className="accent-accent"
          />
          <span className="text-sm font-medium">Kindle HTML</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="format"
            value="audible-html"
            checked={format === "audible-html"}
            onChange={() => { setFormat("audible-html"); setRawText(""); setImagesJson(""); setParseResult(null); setError(null); }}
            className="accent-accent"
          />
          <span className="text-sm font-medium">Audible HTML</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="format"
            value="text"
            checked={format === "text"}
            onChange={() => { setFormat("text"); setRawText(""); setImagesJson(""); setParseResult(null); setError(null); }}
            className="accent-accent"
          />
          <span className="text-sm font-medium">Plain text + Images JSON</span>
        </label>
      </div>

      {/* Main textarea */}
      <div className="mb-4">
        <label htmlFor="import-text" className="block text-sm font-medium mb-2">
          {format === "audible-html"
            ? "Paste Audible library page HTML"
            : format === "html"
              ? "Paste Kindle library page HTML"
              : "Paste Kindle library text"}
        </label>
        <textarea
          id="import-text"
          rows={12}
          className="w-full bg-background text-foreground border border-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          placeholder={format === "audible-html"
            ? "Paste the HTML source from your Audible content library page..."
            : format === "html"
              ? "Paste the HTML source from your Kindle content library page..."
              : "Paste your Kindle content library text here..."}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      </div>

      {/* Images JSON — only for text mode */}
      {format === "text" && (
        <div className="mb-4">
          <label htmlFor="images-json" className="block text-sm font-medium mb-2">
            Images JSON (optional — from browser console script)
          </label>
          <textarea
            id="images-json"
            rows={4}
            className="w-full bg-background text-foreground border border-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            placeholder='Paste the JSON array from the browser console script...'
            value={imagesJson}
            onChange={(e) => setImagesJson(e.target.value)}
          />
        </div>
      )}

      <button
        onClick={handleParse}
        disabled={loading || !rawText.trim()}
        className="btn-primary px-6 py-2 rounded-lg disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Parse"}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Import success */}
      {importCount !== null && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-300">
          Successfully imported {importCount} book{importCount !== 1 ? "s" : ""}.
        </div>
      )}

      {/* Parse results */}
      {parseResult && (
        <div className="mt-6">
          {/* New books */}
          <h2 className="text-lg font-semibold mb-3">
            New Books ({parseResult.newBooks.length})
          </h2>
          {parseResult.newBooks.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Title</th>
                    <th className="text-left p-3">Authors</th>
                    <th className="text-left p-3">Series</th>
                    <th className="text-left p-3">Owner</th>
                    <th className="text-left p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.newBooks.map((book, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">{book.title}</td>
                      <td className="p-3">{book.authors}</td>
                      <td className="p-3 text-muted-foreground">{book.series ?? "—"}</td>
                      <td className="p-3">{book.owner}</td>
                      <td className="p-3">{book.purchaseDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground mb-6">No new books to import.</p>
          )}

          {/* Duplicates */}
          {parseResult.duplicates.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-3 text-amber-600 dark:text-amber-400">
                Duplicates ({parseResult.duplicates.length})
              </h2>
              <div className="border border-amber-200 dark:border-amber-900 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 dark:bg-amber-950/40">
                    <tr>
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">Authors</th>
                      <th className="text-left p-3">Series</th>
                      <th className="text-left p-3">Owner</th>
                      <th className="text-left p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.duplicates.map((book, i) => (
                      <tr key={i} className="border-t border-amber-100 dark:border-amber-900">
                        <td className="p-3">{book.title}</td>
                        <td className="p-3">{book.authors}</td>
                        <td className="p-3 text-muted-foreground">{book.series ?? "—"}</td>
                        <td className="p-3">{book.owner}</td>
                        <td className="p-3">{book.purchaseDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Confirm button */}
          {parseResult.newBooks.length > 0 && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-primary px-6 py-2 rounded-lg disabled:cursor-not-allowed"
            >
              {loading ? "Importing..." : `Confirm Import (${parseResult.newBooks.length} books)`}
            </button>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
