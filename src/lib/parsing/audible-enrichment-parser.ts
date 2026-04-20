import { parse as parseHTML } from "node-html-parser";

export type AudibleEnrichment = {
  asin: string;
  title: string;
  authors: string;
  series: string | null;
  description: string | null;
};

/**
 * Parse the HTML blob produced by the A-Scrape bookmarklet (audible.com
 * library page scraper) into structured enrichment records.
 *
 * Each record is a <div class="kscrape-audible-enrich" data-asin="..."> with
 * kscrape-title / kscrape-authors / kscrape-series / kscrape-description
 * children. Only asin and title are required; series and description are
 * optional (books without a series won't emit the element, etc.).
 */
export function parseAudibleEnrichmentHtml(html: string): AudibleEnrichment[] {
  const root = parseHTML(html);
  const entries = root.querySelectorAll(".kscrape-audible-enrich");
  const out: AudibleEnrichment[] = [];

  for (const entry of entries) {
    const asin = entry.getAttribute("data-asin")?.trim() ?? "";
    if (!asin) continue;

    const title = entry.querySelector(".kscrape-title")?.text.trim() ?? "";
    if (!title) continue;

    const authors = entry.querySelector(".kscrape-authors")?.text.trim() ?? "";
    const seriesText = entry.querySelector(".kscrape-series")?.text.trim() ?? "";
    const description = entry.querySelector(".kscrape-description")?.text.trim() ?? "";

    out.push({
      asin,
      title,
      authors,
      series: seriesText || null,
      description: description || null,
    });
  }

  return out;
}
