import {
  parseKindleText,
  parseKindleHtml,
  parseImageJson,
  type ParsedBook,
} from "../kindle-parser";

const DEFAULT_IMAGE = "https://via.placeholder.com/150x226/1ECBE1/ffffff";

// ─── parseKindleText ────────────────────────────────────────────────

describe("parseKindleText", () => {
  it("parses a single book block with Acquired by", () => {
    const input = `
The Great Novel (Amazing Series Book 1)
Jane Author
Acquired on February 19, 2026
Acquired by Denise A Verkon
    `;
    const books = parseKindleText(input);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      bookType: "KINDLE",
      title: "The Great Novel (Amazing Series Book 1)",
      authors: "Jane Author",
      owner: "dverkon",
      purchaseDate: "2026-02-19",
      series: "Amazing Book 1",
      description: null,
      image: DEFAULT_IMAGE,
    });
  });

  it("parses Shared with as the OTHER person being owner", () => {
    const input = `
Some Book
Tom Writer
Acquired on March 1, 2026
Shared with Denise A Verkon
    `;
    const books = parseKindleText(input);
    expect(books).toHaveLength(1);
    expect(books[0].owner).toBe("tverkon");
  });

  it("parses Shared with Tom as dverkon being owner", () => {
    const input = `
Some Book
Tom Writer
Acquired on March 1, 2026
Shared with Tom Verkon
    `;
    const books = parseKindleText(input);
    expect(books[0].owner).toBe("dverkon");
  });

  it("parses multiple books", () => {
    const input = `
Book One
Author One
Acquired on January 1, 2026
Acquired by Denise A Verkon

Book Two
Author Two
Acquired on February 1, 2026
Acquired by Tom Verkon
    `;
    const books = parseKindleText(input);
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Book One");
    expect(books[0].owner).toBe("dverkon");
    expect(books[1].title).toBe("Book Two");
    expect(books[1].owner).toBe("tverkon");
  });

  it("skips noise lines between book blocks", () => {
    const input = `
My Book
Some Author
Deliver or remove from device
Delete
More Actions
In
1
Device
Acquired on March 6, 2026
Acquired by Tom Verkon
    `;
    const books = parseKindleText(input);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("My Book");
  });

  it("skips entries without a purchase date", () => {
    const input = `
Incomplete Book
Some Author
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books).toHaveLength(0);
  });

  it("assigns images by position order", () => {
    const input = `
Book A
Author A
Acquired on January 1, 2026
Acquired by Tom

Book B
Author B
Acquired on February 1, 2026
Acquired by Tom
    `;
    const images = [
      "https://m.media-amazon.com/images/I/abc.jpg",
      "https://m.media-amazon.com/images/I/def.jpg",
    ];
    const books = parseKindleText(input, images);
    expect(books[0].image).toBe(images[0]);
    expect(books[1].image).toBe(images[1]);
  });

  it("falls back to default image when no images provided", () => {
    const input = `
Book A
Author A
Acquired on January 1, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].image).toBe(DEFAULT_IMAGE);
  });

  it("falls back to default image when images array is shorter than books", () => {
    const input = `
Book A
Author A
Acquired on January 1, 2026
Acquired by Tom

Book B
Author B
Acquired on February 1, 2026
Acquired by Tom
    `;
    const images = ["https://m.media-amazon.com/images/I/abc.jpg"];
    const books = parseKindleText(input, images);
    expect(books[0].image).toBe(images[0]);
    expect(books[1].image).toBe(DEFAULT_IMAGE);
  });
});

// ─── Series extraction ──────────────────────────────────────────────

describe("series extraction", () => {
  it("extracts series with 'Book N' pattern", () => {
    const input = `
Story of My Life (Story Lake Book 1)
Lucy Score
Acquired on February 19, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBe("Story Lake Book 1");
  });

  it("extracts series with 'Books N-M' pattern", () => {
    const input = `
Lost Town: Books 1-3 (Lost Town Books 1-3)
Nathan Hystad
Acquired on January 18, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBe("Lost Town Books 1-3");
  });

  it("extracts series with bare number pattern", () => {
    const input = `
No One Knew (Noelle Marshall 2)
Kendra Elliot
Acquired on January 5, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBe("Noelle Marshall 2");
  });

  it("strips trailing 'Series' from series name", () => {
    const input = `
The Cottage (Nantucket Seashells Series Book 2)
Amy Rafferty
Acquired on January 19, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBe("Nantucket Seashells Book 2");
  });

  it("returns null for non-series parenthetical", () => {
    const input = `
White Hot (Pocket Books Romance)
Carla Neggers
Acquired on February 8, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBeNull();
  });

  it("returns null for 'Two Complete Series'", () => {
    const input = `
Final Contact (Two Complete Series)
Jasper T. Scott
Acquired on February 10, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].series).toBeNull();
  });
});

// ─── Title cleaning ─────────────────────────────────────────────────

describe("title cleaning", () => {
  it("strips description after colon, keeps series paren", () => {
    const input = `
Beasts in the Garden: A sci-fi novel (Convergence Book 1)
C. Gockel
Acquired on January 18, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].title).toBe("Beasts in the Garden (Convergence Book 1)");
    expect(books[0].description).toBe("A sci-fi novel");
  });

  it("strips description with no series", () => {
    const input = `
Violent Echoes: A Brooks & Banks Novel
PJ Mouchet
Acquired on February 1, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].title).toBe("Violent Echoes");
    expect(books[0].description).toBe("A Brooks & Banks Novel");
  });

  it("preserves title with no colon and no series", () => {
    const input = `
Midnight Rainbow
Linda Howard
Acquired on March 3, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].title).toBe("Midnight Rainbow");
    expect(books[0].description).toBeNull();
  });

  it("preserves title with series but no colon", () => {
    const input = `
Story of My Life (Story Lake Book 1)
Lucy Score
Acquired on February 19, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].title).toBe("Story of My Life (Story Lake Book 1)");
  });
});

// ─── Sortable title ─────────────────────────────────────────────────

describe("sortable title", () => {
  it("strips leading 'The'", () => {
    const input = `
The Great Novel
Author Name
Acquired on January 1, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].sortableTitle).toBe("Great Novel");
  });

  it("strips leading 'A'", () => {
    const input = `
A Murder at the Movies (Secret Bookcase Book 2)
Ellie Alexander
Acquired on January 25, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].sortableTitle).toBe("Murder at the Movies (Secret Bookcase Book 2)");
  });

  it("strips leading 'An'", () => {
    const input = `
An Unlikely Hero
Author Name
Acquired on January 1, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].sortableTitle).toBe("Unlikely Hero");
  });

  it("includes series in sortable title", () => {
    const input = `
Story of My Life (Story Lake Book 1)
Lucy Score
Acquired on February 19, 2026
Acquired by Denise
    `;
    const books = parseKindleText(input);
    expect(books[0].sortableTitle).toBe("Story of My Life (Story Lake Book 1)");
  });

  it("strips description from sortable title", () => {
    const input = `
Beasts in the Garden: A sci-fi novel (Convergence Book 1)
C. Gockel
Acquired on January 18, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].sortableTitle).toBe("Beasts in the Garden (Convergence Book 1)");
  });
});

// ─── Searchable content ─────────────────────────────────────────────

describe("searchable content", () => {
  it("contains lowercase title and authors", () => {
    const input = `
The Great Novel
Jane Author
Acquired on January 1, 2026
Acquired by Tom
    `;
    const books = parseKindleText(input);
    expect(books[0].searchableContent).toBe("the great novel jane author");
  });
});

// ─── parseImageJson ─────────────────────────────────────────────────

describe("parseImageJson", () => {
  it("extracts Amazon image URLs", () => {
    const json = JSON.stringify([
      { title: "Book 1", image: "https://m.media-amazon.com/images/I/abc.jpg" },
      { title: "Book 2", image: "https://m.media-amazon.com/images/I/def.jpg" },
    ]);
    const images = parseImageJson(json);
    expect(images).toEqual([
      "https://m.media-amazon.com/images/I/abc.jpg",
      "https://m.media-amazon.com/images/I/def.jpg",
    ]);
  });

  it("filters out non-Amazon URLs", () => {
    const json = JSON.stringify([
      { title: "Nav Sprite", image: "https://example.com/sprite.png" },
      { title: "Book 1", image: "https://m.media-amazon.com/images/I/abc.jpg" },
    ]);
    const images = parseImageJson(json);
    expect(images).toEqual(["https://m.media-amazon.com/images/I/abc.jpg"]);
  });

  it("filters out entries without image field", () => {
    const json = JSON.stringify([
      { title: "No Image" },
      { title: "Book", image: "https://m.media-amazon.com/images/I/abc.jpg" },
    ]);
    const images = parseImageJson(json);
    expect(images).toEqual(["https://m.media-amazon.com/images/I/abc.jpg"]);
  });

  it("handles double-encoded JSON", () => {
    const inner = JSON.stringify([
      { title: "Book", image: "https://m.media-amazon.com/images/I/abc.jpg" },
    ]);
    const doubleEncoded = JSON.stringify(inner);
    const images = parseImageJson(doubleEncoded);
    expect(images).toEqual(["https://m.media-amazon.com/images/I/abc.jpg"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseImageJson("not json")).toEqual([]);
    expect(parseImageJson("")).toEqual([]);
  });
});

// ─── parseKindleHtml ────────────────────────────────────────────────

describe("parseKindleHtml", () => {
  function makeBookHtml({
    asin = "B001TEST",
    title = "Test Book",
    authors = "Test Author",
    imageUrl = "https://m.media-amazon.com/images/I/test.SX150.jpg",
    date = "March 6, 2026",
    ownerLine = '<div class="information_row"><span>Acquired by Tom Verkon</span></div>',
  } = {}): string {
    return `
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div id="content-image-${asin}" class="DigitalEntitySummary-module__image_container_x">
          <img src="${imageUrl}" alt="">
        </div>
        <div class="digital_entity_details">
          <div id="content-title-${asin}" class="digital_entity_title" role="link">
            <div role="heading" aria-level="4">${title}</div>
          </div>
          <div id="content-author-${asin}" class="information_row">${authors}</div>
          <span>
            <div id="content-acquired-date-${asin}" class="information_row">
              <span>Acquired on</span> ${date}
            </div>
            ${ownerLine}
          </span>
        </div>
      </div>
    `;
  }

  it("parses a single book from HTML", () => {
    const html = makeBookHtml({
      title: "The Great Novel (Amazing Series Book 1)",
      authors: "Jane Author",
      ownerLine: '<div class="information_row"><span>Acquired by Denise A Verkon</span></div>',
    });
    const books = parseKindleHtml(html);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      bookType: "KINDLE",
      title: "The Great Novel (Amazing Series Book 1)",
      authors: "Jane Author",
      owner: "dverkon",
      purchaseDate: "2026-03-06",
      series: "Amazing Book 1",
    });
  });

  it("upgrades image from SX150 to SX450", () => {
    const html = makeBookHtml({
      imageUrl: "https://m.media-amazon.com/images/I/51DMzhUe9GL.SX150.jpg",
    });
    const books = parseKindleHtml(html);
    expect(books[0].image).toBe(
      "https://m.media-amazon.com/images/I/51DMzhUe9GL.SX450.jpg"
    );
  });

  it("handles Shared with owner logic", () => {
    const html = makeBookHtml({
      ownerLine: '<div id="content-shared-B001" class="information_row"><span>Shared with</span> Denise A Verkon</div>',
    });
    const books = parseKindleHtml(html);
    expect(books[0].owner).toBe("tverkon");
  });

  it("parses multiple books", () => {
    const html =
      makeBookHtml({ asin: "B001", title: "Book One", authors: "Author A" }) +
      makeBookHtml({ asin: "B002", title: "Book Two", authors: "Author B" });
    const books = parseKindleHtml(html);
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Book One");
    expect(books[1].title).toBe("Book Two");
  });

  it("skips entries without title element", () => {
    const html = `
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div id="content-author-B001" class="information_row">Author</div>
      </div>
    `;
    const books = parseKindleHtml(html);
    expect(books).toHaveLength(0);
  });

  it("skips entries without date", () => {
    const html = `
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div class="digital_entity_details">
          <div id="content-title-B001" class="digital_entity_title" role="link">
            <div role="heading" aria-level="4">No Date Book</div>
          </div>
          <div id="content-author-B001" class="information_row">Author</div>
        </div>
      </div>
    `;
    const books = parseKindleHtml(html);
    expect(books).toHaveLength(0);
  });

  it("normalizes whitespace in titles", () => {
    const html = makeBookHtml({
      title: "Advanced Angular\n                (Series\n                Book 3)",
    });
    const books = parseKindleHtml(html);
    expect(books[0].title).toContain("Advanced Angular");
    expect(books[0].title).not.toContain("\n");
  });

  it("cleans title with description and series", () => {
    const html = makeBookHtml({
      title: "Beasts in the Garden: A sci-fi novel (Convergence Book 1)",
    });
    const books = parseKindleHtml(html);
    expect(books[0].title).toBe("Beasts in the Garden (Convergence Book 1)");
    expect(books[0].description).toBe("A sci-fi novel");
    expect(books[0].series).toBe("Convergence Book 1");
  });

  it("uses default image when img element is missing", () => {
    const html = `
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div class="digital_entity_details">
          <div id="content-title-B001" class="digital_entity_title" role="link">
            <div role="heading" aria-level="4">No Image Book</div>
          </div>
          <div id="content-author-B001" class="information_row">Author</div>
          <span>
            <div id="content-acquired-date-B001" class="information_row">
              <span>Acquired on</span> March 6, 2026
            </div>
            <div class="information_row"><span>Acquired by Tom</span></div>
          </span>
        </div>
      </div>
    `;
    const books = parseKindleHtml(html);
    expect(books[0].image).toBe(DEFAULT_IMAGE);
  });

  it("defaults to tverkon when no owner line present", () => {
    const html = makeBookHtml({ ownerLine: "" });
    const books = parseKindleHtml(html);
    expect(books[0].owner).toBe("tverkon");
  });
});

// ─── Parity: text vs HTML produce same output ──────────────────────

describe("text and HTML parser parity", () => {
  it("produces matching results for equivalent input", () => {
    const text = `
Beasts in the Garden: A sci-fi novel (Convergence Book 1)
C. Gockel
Acquired on January 18, 2026
Shared with Denise A Verkon
    `;
    const html = `
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div id="content-image-B001" class="DigitalEntitySummary-module__image_container_x">
          <img src="https://m.media-amazon.com/images/I/cover.SX150.jpg" alt="">
        </div>
        <div class="digital_entity_details">
          <div id="content-title-B001" class="digital_entity_title" role="link">
            <div role="heading" aria-level="4">Beasts in the Garden: A sci-fi novel (Convergence Book 1)</div>
          </div>
          <div id="content-author-B001" class="information_row">C. Gockel</div>
          <span>
            <div id="content-acquired-date-B001" class="information_row">
              <span>Acquired on</span> January 18, 2026
            </div>
            <div id="content-shared-B001" class="information_row"><span>Shared with</span> Denise A Verkon</div>
          </span>
        </div>
      </div>
    `;

    const textBooks = parseKindleText(text);
    const htmlBooks = parseKindleHtml(html);

    // Same core fields (image differs because HTML has one and text doesn't)
    expect(textBooks[0].title).toBe(htmlBooks[0].title);
    expect(textBooks[0].authors).toBe(htmlBooks[0].authors);
    expect(textBooks[0].owner).toBe(htmlBooks[0].owner);
    expect(textBooks[0].purchaseDate).toBe(htmlBooks[0].purchaseDate);
    expect(textBooks[0].series).toBe(htmlBooks[0].series);
    expect(textBooks[0].description).toBe(htmlBooks[0].description);
    expect(textBooks[0].sortableTitle).toBe(htmlBooks[0].sortableTitle);
    expect(textBooks[0].bookType).toBe(htmlBooks[0].bookType);
  });
});
