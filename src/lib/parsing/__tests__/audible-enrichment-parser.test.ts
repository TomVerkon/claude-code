import { parseAudibleEnrichmentHtml } from "../audible-enrichment-parser";

function makeEntry(fields: {
  asin: string;
  title: string;
  authors?: string;
  series?: string;
  description?: string;
}): string {
  return (
    `<div class="kscrape-audible-enrich" data-asin="${fields.asin}">` +
    `<div class="kscrape-title">${fields.title}</div>` +
    (fields.authors ? `<div class="kscrape-authors">${fields.authors}</div>` : "") +
    (fields.series ? `<div class="kscrape-series">${fields.series}</div>` : "") +
    (fields.description ? `<div class="kscrape-description">${fields.description}</div>` : "") +
    `</div>`
  );
}

describe("parseAudibleEnrichmentHtml", () => {
  it("parses a single fully-populated entry", () => {
    const html = makeEntry({
      asin: "B0F7WPLK5J",
      title: "The Architect: Humanity's Leap, Book 2",
      authors: "C.S. Garrand",
      series: "Humanity's Leap Book 2",
      description: "We didn't know what to expect when we jumped through the Leap Point.",
    });
    const records = parseAudibleEnrichmentHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      asin: "B0F7WPLK5J",
      title: "The Architect: Humanity's Leap, Book 2",
      authors: "C.S. Garrand",
      series: "Humanity's Leap Book 2",
      description: "We didn't know what to expect when we jumped through the Leap Point.",
    });
  });

  it("treats missing series and description as null", () => {
    const html = makeEntry({
      asin: "B0B62439N9",
      title: "Brain Damage",
      authors: "Freida McFadden",
    });
    const records = parseAudibleEnrichmentHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0].series).toBeNull();
    expect(records[0].description).toBeNull();
    expect(records[0].authors).toBe("Freida McFadden");
  });

  it("parses multiple entries", () => {
    const html =
      makeEntry({ asin: "A1", title: "Book One", authors: "Author A" }) +
      makeEntry({ asin: "A2", title: "Book Two", authors: "Author B", series: "Series X Book 2" });
    const records = parseAudibleEnrichmentHtml(html);
    expect(records).toHaveLength(2);
    expect(records[0].asin).toBe("A1");
    expect(records[1].series).toBe("Series X Book 2");
  });

  it("skips entries missing data-asin", () => {
    const html =
      '<div class="kscrape-audible-enrich"><div class="kscrape-title">Orphan</div></div>' +
      makeEntry({ asin: "A1", title: "Valid" });
    const records = parseAudibleEnrichmentHtml(html);
    expect(records).toHaveLength(1);
    expect(records[0].asin).toBe("A1");
  });

  it("skips entries missing title", () => {
    const html = `<div class="kscrape-audible-enrich" data-asin="A1"></div>`;
    const records = parseAudibleEnrichmentHtml(html);
    expect(records).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(parseAudibleEnrichmentHtml("")).toEqual([]);
    expect(parseAudibleEnrichmentHtml("<html><body></body></html>")).toEqual([]);
  });
});
