"use client";

import { useState } from "react";
import { AppHeader } from "../../app-header";
import {
  previewEnrichmentAction,
  applyEnrichmentAction,
  type PreviewResult,
} from "./actions";

export default function EnrichPage() {
  const [rawHtml, setRawHtml] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setApplied(null);

    const result = await previewEnrichmentAction(rawHtml);
    if (result.success) {
      setPreview(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleApply() {
    if (!preview) return;
    setLoading(true);
    setError(null);

    const result = await applyEnrichmentAction(preview.records);
    if (result.success) {
      setApplied(result.updated);
      setPreview(null);
      setRawHtml("");
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  const matchedCount = preview?.preview.filter((p) => p.matched.length > 0).length ?? 0;
  const unmatchedCount = preview?.preview.filter((p) => p.matched.length === 0).length ?? 0;
  const rowsToUpdate = preview?.preview.reduce((acc, p) => acc + p.matched.length, 0) ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Audible Enrichment</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Paste the HTML blob from the A-Scrape bookmarklet to fill in series and
          description for your existing Audible books. Matching is by ASIN — shared
          books update both owners&rsquo; rows.
        </p>

        <div className="mb-4">
          <label htmlFor="enrich-html" className="block text-sm font-medium mb-2">
            A-Scrape HTML
          </label>
          <textarea
            id="enrich-html"
            rows={10}
            className="w-full bg-background text-foreground border border-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            placeholder="Paste the clipboard contents from the A-Scrape bookmarklet..."
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={loading || !rawHtml.trim()}
          className="btn-primary px-6 py-2 rounded-lg disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Preview"}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {applied !== null && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-300">
            Enrichment applied — {applied} row{applied !== 1 ? "s" : ""} updated.
          </div>
        )}

        {preview && (
          <div className="mt-6">
            <div className="mb-4 flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Matched ASINs:</span>{" "}
                <span className="font-semibold">{matchedCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rows to update:</span>{" "}
                <span className="font-semibold">{rowsToUpdate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unmatched:</span>{" "}
                <span className="font-semibold">{unmatchedCount}</span>
              </div>
            </div>

            {matchedCount > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-3">Matched</h2>
                <div className="border border-border rounded-lg overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">ASIN</th>
                        <th className="text-left p-3">Title</th>
                        <th className="text-left p-3">Rows</th>
                        <th className="text-left p-3">New Series</th>
                        <th className="text-left p-3">New Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview
                        .filter((p) => p.matched.length > 0)
                        .map((p) => {
                          const record = preview.records.find((r) => r.asin === p.asin);
                          return (
                            <tr key={p.asin} className="border-t border-border align-top">
                              <td className="p-3 font-mono text-xs">{p.asin}</td>
                              <td className="p-3">{record?.title ?? "—"}</td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {p.matched.map((m) => `${m.owner} (#${m.id})`).join(", ")}
                              </td>
                              <td className="p-3 text-muted-foreground">{p.newSeries ?? "—"}</td>
                              <td className="p-3 text-muted-foreground line-clamp-2 max-w-md">
                                {p.newDescription ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {unmatchedCount > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-3 text-amber-600 dark:text-amber-400">
                  Unmatched ({unmatchedCount})
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  These ASINs from the enrichment blob have no corresponding Audible
                  book in the library. Usually means the book was never imported, or
                  the import ran under the old parser without capturing ASINs.
                </p>
                <div className="border border-amber-200 dark:border-amber-900 rounded-lg overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 dark:bg-amber-950/40">
                      <tr>
                        <th className="text-left p-3">ASIN</th>
                        <th className="text-left p-3">Title</th>
                        <th className="text-left p-3">Authors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview
                        .filter((p) => p.matched.length === 0)
                        .map((p) => {
                          const record = preview.records.find((r) => r.asin === p.asin);
                          return (
                            <tr key={p.asin} className="border-t border-amber-100 dark:border-amber-900">
                              <td className="p-3 font-mono text-xs">{p.asin}</td>
                              <td className="p-3">{record?.title ?? "—"}</td>
                              <td className="p-3 text-muted-foreground">{record?.authors ?? "—"}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {rowsToUpdate > 0 && (
              <button
                onClick={handleApply}
                disabled={loading}
                className="btn-primary px-6 py-2 rounded-lg disabled:cursor-not-allowed"
              >
                {loading ? "Applying..." : `Apply enrichment to ${rowsToUpdate} row${rowsToUpdate !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
