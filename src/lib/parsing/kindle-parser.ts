export type ParsedBook = {
  bookType: string;
  title: string;
  authors: string;
  owner: string;
  purchaseDate: string;
  sortableTitle: string;
  searchableContent: string;
  series: string | null;
};

const NOISE_LINES = new Set([
  "deliver or remove from device",
  "delete",
  "more actions",
  "download available in additional formats",
]);

/**
 * Build a sortable title by stripping leading articles (A, An, The).
 */
function makeSortableTitle(title: string): string {
  return title.replace(/^(a |an |the )/i, "").trim();
}

/**
 * Determine owner from "Acquired by ..." or "Shared with ..." lines.
 * Maps known names to owner codes.
 */
function nameToOwnerCode(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("denise")) return "dverkon";
  if (lower.includes("tom") || lower.includes("thomas")) return "tverkon";
  return lower.replace(/\s+/g, "");
}

/**
 * Determine owner from "Acquired by ..." or "Shared with ..." lines.
 * "Acquired by X" → X is the owner (they bought it).
 * "Shared with X" → the OTHER person is the owner (they shared it with X).
 */
function resolveOwner(line: string): string | null {
  const acquired = line.match(/^Acquired by (.+)$/i);
  if (acquired) {
    return nameToOwnerCode(acquired[1]);
  }

  const shared = line.match(/^Shared with (.+)$/i);
  if (shared) {
    // "Shared with X" means the account owner shared it with X,
    // so the owner is the OTHER person (not X).
    const sharedWith = nameToOwnerCode(shared[1]);
    return sharedWith === "dverkon" ? "tverkon" : "dverkon";
  }

  return null;
}

/**
 * Extract series name from a title.
 * Matches the last parenthesized group containing "Book N" or just a trailing number.
 * Examples:
 *   "Story of My Life (Story Lake Book 1)" → "Story Lake"
 *   "Goodbye Linden Square... (A Port Alma Murder Mystery Book 7)" → "A Port Alma Murder Mystery"
 *   "Someone Else's Daughter: Book I (A Miranda's Rights Mystery 1)" → "A Miranda's Rights Mystery"
 *   "White Hot (Pocket Books Romance)" → null (no number)
 *   "Final Contact (Two Complete Series)" → null (no number)
 */
function extractSeries(title: string): string | null {
  // Match the last paren group with "Book N" pattern: (Series Name Book 3)
  // Use [^()]+ to avoid matching across multiple paren groups
  const bookMatch = title.match(/\(([^()]+?)\s+Book\s+\d+\)\s*$/i);
  if (bookMatch) {
    let series = bookMatch[1].trim();
    // Strip trailing "Series" word if present: "Nantucket Seashells Series" → "Nantucket Seashells"
    series = series.replace(/\s+Series$/i, "");
    return series;
  }

  // Match last paren group ending with a bare number: (A Miranda's Rights Mystery 1)
  const numMatch = title.match(/\(([^()]+?)\s+(\d+)\)\s*$/);
  if (numMatch) {
    const candidate = numMatch[1].trim();
    // Avoid false positives like "(Two Complete Series)" — candidate must not be purely descriptive
    if (candidate.length > 2) {
      return candidate;
    }
  }

  return null;
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
 * Parse raw Kindle library text into structured book records.
 */
export function parseKindleText(rawText: string): ParsedBook[] {
  const lines = rawText.split("\n").map((l) => l.trim());
  const books: ParsedBook[] = [];

  let i = 0;
  while (i < lines.length) {
    // Skip empty/noise lines to find the start of a book block
    if (!lines[i] || NOISE_LINES.has(lines[i].toLowerCase())) {
      i++;
      continue;
    }

    // Also skip device count lines like "In", "1", "Device", "2", "Devices"
    if (/^(in|\d+|devices?)$/i.test(lines[i])) {
      i++;
      continue;
    }

    // A book block starts with a title (non-empty, non-noise, non-date line)
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
    let owner = "tverkon"; // default owner

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
        // We've got all the data we need for this book
        break;
      }

      // If we hit another title-like line (not noise, not date, not owner), stop
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

    if (!purchaseDate) continue; // skip if we couldn't parse a date

    const series = extractSeries(title);
    const sortableTitle = makeSortableTitle(title);
    const searchableContent = `${title} ${authors}`.toLowerCase();

    books.push({
      bookType: "KINDLE",
      title,
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
