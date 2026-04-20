import { parse as parseHTML } from "node-html-parser";

export type ParsedBook = {
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
  asin: string | null;
};

const NOISE_LINES = new Set([
  "deliver or remove from device",
  "delete",
  "more actions",
  "download available in additional formats",
]);

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

/**
 * Determine owner from "Acquired by ..." or "Shared with ..." lines.
 * "Acquired by X" → X is the owner (they bought it).
 * "Shared with X" → the OTHER person is the owner (they shared it with X).
 */
function resolveOwner(line: string): "tverkon" | "dverkon" | null {
  const acquired = line.match(/^Acquired by (.+)$/i);
  if (acquired) {
    return nameToOwnerCode(acquired[1]);
  }

  const shared = line.match(/^Shared with (.+)$/i);
  if (shared) {
    const sharedWith = nameToOwnerCode(shared[1]);
    return sharedWith === "dverkon" ? "tverkon" : "dverkon";
  }

  return null;
}

/**
 * Extract series (with book number) from the last parenthesized group in a title.
 * Examples:
 *   "Story of My Life (Story Lake Book 1)" → "Story Lake Book 1"
 *   "(A Port Alma Murder Mystery Book 7)" → "A Port Alma Murder Mystery Book 7"
 *   "(A Miranda's Rights Mystery 1)" → "A Miranda's Rights Mystery 1"
 *   "(Nantucket Seashells Series Book 4)" → "Nantucket Seashells Book 4"
 *   "(Pocket Books Romance)" → null (no number)
 *   "(Two Complete Series)" → null (no number)
 */
function extractSeries(title: string): string | null {
  // Match last paren group with "Book(s) N" or "Book(s) N-M": (Series Name Book 3), (Series Books 1-3)
  const bookMatch = title.match(/\(([^()]+?)\s+(Books?\s+\d+(?:-\d+)?)\)\s*$/i);
  if (bookMatch) {
    let seriesName = bookMatch[1].trim();
    const bookNum = bookMatch[2]; // e.g. "Book 1"
    seriesName = seriesName.replace(/\s+Series$/i, "");
    return `${seriesName} ${bookNum}`;
  }

  // Match last paren group ending with a bare number: (A Miranda's Rights Mystery 1)
  const numMatch = title.match(/\(([^()]+?)\s+(\d+)\)\s*$/);
  if (numMatch) {
    const candidate = numMatch[1].trim();
    if (candidate.length > 2) {
      return `${candidate} ${numMatch[2]}`;
    }
  }

  return null;
}

/**
 * Extract description from a title string.
 * Description is text after a colon but before the series parenthetical (or end of string).
 * e.g. "Beasts in the Garden: A sci-fi novel (Series Book 1)" → "A sci-fi novel"
 *      "Already Home: A Romance About Family" → "A Romance About Family"
 *      "Story of My Life (Story Lake Book 1)" → null (no colon)
 */
function extractDescription(title: string, series: string | null): string | null {
  const colonIdx = title.indexOf(":");
  if (colonIdx === -1) return null;

  let afterColon = title.substring(colonIdx + 1).trim();

  // Strip the series parenthetical from the end if present
  if (series) {
    // Remove the last paren group (the series one)
    afterColon = afterColon.replace(/\s*\([^()]*\)\s*$/, "").trim();
  }

  return afterColon || null;
}

/**
 * Build sortable title from just the title part + series (no description).
 * "Beasts in the Garden: desc text (Series Book 1)" → "Beasts in the Garden (Series Book 1)"
 * "The Fall of Shane Mackade (MacKade Brothers Book 4)" → "Fall of Shane Mackade (MacKade Brothers Book 4)"
 */
function makeSortableTitle(title: string, series: string | null): string {
  // Get title part (before colon, or before series paren if no colon)
  let titlePart: string;
  const colonIdx = title.indexOf(":");
  if (colonIdx !== -1) {
    titlePart = title.substring(0, colonIdx).trim();
  } else if (series) {
    // Remove the last paren group to get the core title
    titlePart = title.replace(/\s*\([^()]*\)\s*$/, "").trim();
  } else {
    titlePart = title;
  }

  const stripped = stripArticles(titlePart);
  return series ? `${stripped} (${series})` : stripped;
}

/**
 * Produce the display title: drop the post-colon description and any trailing
 * series parenthetical. Description and series are already captured in their
 * own fields, so repeating them in title is redundant.
 * "Beasts in the Garden: A sci-fi novel (Series Book 1)" → "Beasts in the Garden"
 * "Already Home: A Romance About Family" → "Already Home"
 * "Story of My Life (Story Lake Book 1)" → "Story of My Life"
 */
function cleanTitle(rawTitle: string, series: string | null): string {
  let cleaned = rawTitle;

  if (series) {
    cleaned = cleaned.replace(/\s*\([^()]*\)\s*$/, "");
  }

  const colonIdx = cleaned.indexOf(":");
  if (colonIdx !== -1) {
    cleaned = cleaned.substring(0, colonIdx);
  }

  return cleaned.trim();
}

/**
 * Parse a date string like "February 19, 2026" to "2026-02-19".
 */
function parseDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split("T")[0];
}

/**
 * Upgrade image URL to SX450 for better quality.
 */
function upgradeImageUrl(url: string): string {
  return url.replace(/\.SX\d+\./, ".SX450.");
}

const DEFAULT_IMAGE = "https://via.placeholder.com/150x226/1ECBE1/ffffff";

/**
 * Filter Amazon book cover images from raw console-scraped JSON.
 * Removes nav sprites and entries without image URLs.
 */
export function parseImageJson(json: string): string[] {
  try {
    let parsed = JSON.parse(json);
    // Handle double-encoded JSON (copy() wraps in extra quotes)
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    const raw: { title?: string; image?: string }[] = parsed;
    return raw
      .map((e) => e.image ?? "")
      .filter((url) => url.includes("m.media-amazon.com/images/I/"));
  } catch {
    return [];
  }
}

/**
 * Parse raw Kindle library text into structured book records.
 * Optional images array is matched to books by position order.
 */
export function parseKindleText(rawText: string, images: string[] = []): ParsedBook[] {
  const lines = rawText.split("\n").map((l) => l.trim());
  const books: ParsedBook[] = [];

  let i = 0;
  while (i < lines.length) {
    // Skip empty/noise lines to find the start of a book block
    if (!lines[i] || NOISE_LINES.has(lines[i].toLowerCase())) {
      i++;
      continue;
    }

    // Skip device count lines like "In", "1", "Device", "2", "Devices"
    if (/^(in|\d+|devices?)$/i.test(lines[i])) {
      i++;
      continue;
    }

    // A book block starts with a title
    const title = lines[i];

    // If this looks like an "Acquired" or "Shared" line, skip it (orphan)
    if (/^(Acquired|Shared)\b/i.test(title)) {
      i++;
      continue;
    }

    i++;

    // Next non-empty line should be author(s)
    while (i < lines.length && !lines[i]) i++;
    if (i >= lines.length) break;
    const authors = lines[i];
    i++;

    // Find the "Acquired on ..." line
    let purchaseDate = "";
    let owner: "tverkon" | "dverkon" = "tverkon"; // default owner

    while (i < lines.length) {
      const line = lines[i];
      if (!line || NOISE_LINES.has(line.toLowerCase()) || /^(in|\d+|devices?)$/i.test(line)) {
        i++;
        continue;
      }

      const dateMatch = line.match(/^Acquired on (.+)$/i);
      if (dateMatch) {
        purchaseDate = parseDate(dateMatch[1]);
        i++;
        continue;
      }

      const ownerResult = resolveOwner(line);
      if (ownerResult !== null) {
        owner = ownerResult;
        i++;
        break;
      }

      // If we hit another title-like line, stop
      break;
    }

    // Skip remaining noise lines for this block
    while (i < lines.length && (
      !lines[i] ||
      NOISE_LINES.has(lines[i].toLowerCase()) ||
      /^(in|\d+|devices?)$/i.test(lines[i])
    )) {
      i++;
    }

    if (!purchaseDate) continue;

    const series = extractSeries(title);
    const description = extractDescription(title, series);
    const cleaned = cleanTitle(title, series);
    const sortableTitle = makeSortableTitle(title, series);
    const searchableContent = `${title} ${authors}`.toLowerCase();

    books.push({
      bookType: "KINDLE",
      title: cleaned,
      description,
      image: images[books.length] ?? DEFAULT_IMAGE,
      authors,
      owner,
      purchaseDate,
      sortableTitle,
      searchableContent,
      series,
      asin: null,
    });
  }

  return books;
}

/**
 * Parse Kindle library HTML (from "Manage Your Content" page source) into structured book records.
 * Extracts title, authors, image, date, and owner directly from DOM structure.
 */
export function parseKindleHtml(html: string): ParsedBook[] {
  const root = parseHTML(html);
  const books: ParsedBook[] = [];

  // Each book lives in a div with class containing "DigitalEntitySummary-module__container"
  const containers = root.querySelectorAll('[class*="DigitalEntitySummary-module__container"]');

  for (const container of containers) {
    // Title: div[id^="content-title-"] > div[role="heading"]
    const titleWrapper = container.querySelector('[id^="content-title-"]');
    const titleEl = titleWrapper?.querySelector('[role="heading"]');
    if (!titleEl) continue;
    const rawTitle = titleEl.text.replace(/\s+/g, " ").trim();
    if (!rawTitle) continue;

    // ASIN is the suffix of the title wrapper's id: "content-title-{ASIN}"
    const asin = titleWrapper?.getAttribute("id")?.replace(/^content-title-/, "") ?? null;

    // Authors: div[id^="content-author-"]
    const authorEl = container.querySelector('[id^="content-author-"]');
    const authors = authorEl?.text.trim() ?? "";
    if (!authors) continue;

    // Image: div[id^="content-image-"] img
    const imgEl = container.querySelector('[id^="content-image-"] img');
    const rawImageUrl = imgEl?.getAttribute("src") ?? "";
    const image = rawImageUrl ? upgradeImageUrl(rawImageUrl) : DEFAULT_IMAGE;

    // Date: div[id^="content-acquired-date-"]
    const dateEl = container.querySelector('[id^="content-acquired-date-"]');
    const dateText = dateEl?.text.trim() ?? "";
    const dateMatch = dateText.match(/Acquired on\s+(.+)/i);
    const purchaseDate = dateMatch ? parseDate(dateMatch[1]) : "";
    if (!purchaseDate) continue;

    // Owner: "Acquired by X" or "Shared with X" in an information_row
    let owner: "tverkon" | "dverkon" = "tverkon";
    const infoRows = container.querySelectorAll(".information_row");
    for (const row of infoRows) {
      const text = row.text.trim();
      const ownerResult = resolveOwner(text);
      if (ownerResult !== null) {
        owner = ownerResult;
        break;
      }
    }

    const series = extractSeries(rawTitle);
    const description = extractDescription(rawTitle, series);
    const cleaned = cleanTitle(rawTitle, series);
    const sortableTitle = makeSortableTitle(rawTitle, series);
    const searchableContent = `${rawTitle} ${authors}`.toLowerCase();

    books.push({
      bookType: "KINDLE",
      title: cleaned,
      description,
      image,
      authors,
      owner,
      purchaseDate,
      sortableTitle,
      searchableContent,
      series,
      asin: asin || null,
    });
  }

  return books;
}
