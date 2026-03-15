import { parse as parseHTML } from "node-html-parser";
import type { ParsedBook } from "./kindle-parser";

const DEFAULT_IMAGE = "https://via.placeholder.com/150x226/F5DEB3/000000";

/**
 * Strip leading articles (A, An, The) for sorting.
 */
function stripArticles(text: string): string {
  return text.replace(/^(a |an |the )/i, "").trim();
}

function nameToOwnerCode(name: string): "tverkon" | "dverkon" {
  const lower = name.toLowerCase();
  if (lower.includes("denise")) return "dverkon";
  return "tverkon";
}

function resolveOwner(line: string): "tverkon" | "dverkon" | null {
  const acquired = line.match(/Acquired by (.+)/i);
  if (acquired) return nameToOwnerCode(acquired[1]);

  const shared = line.match(/Shared with (.+)/i);
  if (shared) {
    const sharedWith = nameToOwnerCode(shared[1]);
    return sharedWith === "dverkon" ? "tverkon" : "dverkon";
  }

  return null;
}

function extractSeries(title: string): string | null {
  const bookMatch = title.match(/\(([^()]+?)\s+(Books?\s+\d+(?:-\d+)?)\)\s*$/i);
  if (bookMatch) {
    let seriesName = bookMatch[1].trim();
    const bookNum = bookMatch[2];
    seriesName = seriesName.replace(/\s+Series$/i, "");
    return `${seriesName} ${bookNum}`;
  }

  const numMatch = title.match(/\(([^()]+?)\s+(\d+)\)\s*$/);
  if (numMatch) {
    const candidate = numMatch[1].trim();
    if (candidate.length > 2) return `${candidate} ${numMatch[2]}`;
  }

  return null;
}

function extractDescription(title: string, series: string | null): string | null {
  const colonIdx = title.indexOf(":");
  if (colonIdx === -1) return null;

  let afterColon = title.substring(colonIdx + 1).trim();
  if (series) {
    afterColon = afterColon.replace(/\s*\([^()]*\)\s*$/, "").trim();
  }

  return afterColon || null;
}

function cleanTitle(rawTitle: string, series: string | null): string {
  const colonIdx = rawTitle.indexOf(":");
  if (colonIdx === -1) return rawTitle;

  const titlePart = rawTitle.substring(0, colonIdx).trim();
  if (series) {
    const parenMatch = rawTitle.match(/(\([^()]*\))\s*$/);
    if (parenMatch) return `${titlePart} ${parenMatch[1]}`;
  }

  return titlePart;
}

function makeSortableTitle(title: string, series: string | null): string {
  let titlePart: string;
  const colonIdx = title.indexOf(":");
  if (colonIdx !== -1) {
    titlePart = title.substring(0, colonIdx).trim();
  } else if (series) {
    titlePart = title.replace(/\s*\([^()]*\)\s*$/, "").trim();
  } else {
    titlePart = title;
  }

  const stripped = stripArticles(titlePart);
  return series ? `${stripped} (${series})` : stripped;
}

function parseDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split("T")[0];
}

function upgradeImageUrl(url: string): string {
  return url.replace(/\.SX\d+\./, ".SX450.");
}

/**
 * Parse Audible library HTML (from Amazon "Manage Your Content" page source) into structured book records.
 * The Audible HTML uses a different DOM structure than Kindle:
 * - Titles are in `.digital_entity_title` divs
 * - Authors are in `.information_row` divs (first one after title)
 * - Dates use "Acquired on" text in `.information_row`
 * - Owner uses "Acquired by" or "Shared with" in `.information_row`
 * - Images are in `div[id^="content-image-"] img`
 */
export function parseAudibleHtml(html: string): ParsedBook[] {
  const root = parseHTML(html);
  const books: ParsedBook[] = [];

  const containers = root.querySelectorAll('[class*="DigitalEntitySummary-module__container"]');

  for (const container of containers) {
    // Title: .digital_entity_title
    const titleEl = container.querySelector(".digital_entity_title");
    if (!titleEl) continue;
    const rawTitle = titleEl.text.replace(/\s+/g, " ").trim();
    if (!rawTitle) continue;

    // Authors: first .information_row after title that isn't a date/owner/tag row
    const detailsDiv = container.querySelector(".digital_entity_details");
    if (!detailsDiv) continue;

    const infoRows = detailsDiv.querySelectorAll(".information_row");
    let authors = "";
    let purchaseDate = "";
    let owner: "tverkon" | "dverkon" = "tverkon";

    for (const row of infoRows) {
      const text = row.text.replace(/\s+/g, " ").trim();

      // Skip tag rows (contain icon elements like <i class="icon-audible">)
      if (row.querySelector("i")) continue;

      // Check for date
      const dateMatch = text.match(/Acquired on\s+(.+)/i);
      if (dateMatch) {
        purchaseDate = parseDate(dateMatch[1]);
        continue;
      }

      // Check for owner
      const ownerResult = resolveOwner(text);
      if (ownerResult !== null) {
        owner = ownerResult;
        continue;
      }

      // First plain text row is the author
      if (!authors && text) {
        authors = text;
      }
    }

    if (!authors || !purchaseDate) continue;

    // Image: div[id^="content-image-"] img
    const imgEl = container.querySelector('[id^="content-image-"] img');
    const rawImageUrl = imgEl?.getAttribute("src") ?? "";
    const image = rawImageUrl ? upgradeImageUrl(rawImageUrl) : DEFAULT_IMAGE;

    const series = extractSeries(rawTitle);
    const description = extractDescription(rawTitle, series);
    const cleaned = cleanTitle(rawTitle, series);
    const sortableTitle = makeSortableTitle(rawTitle, series);
    const searchableContent = `${rawTitle} ${authors}`.toLowerCase();

    books.push({
      bookType: "AUDIBLE",
      title: cleaned,
      description,
      image,
      authors,
      owner,
      purchaseDate,
      sortableTitle,
      searchableContent,
      series,
    });
  }

  return books;
}
