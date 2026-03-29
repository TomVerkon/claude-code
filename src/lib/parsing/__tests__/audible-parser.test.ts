import { parseAudibleHtml } from "../audible-parser";

function makeAudibleHtml(books: {
  asin: string;
  title: string;
  author: string;
  date: string;
  ownerLine: string;
  imageUrl?: string;
}[]): string {
  return `<tbody>${books.map(b => `
  <tr class="ListItem-module_row__3orql" role="listitem">
    <td>
      <div class="DigitalEntitySummary-module__container_3pUojes0Jk94VKwEcoGXyq">
        <div id="content-image-${b.asin}" class="DigitalEntitySummary-module__image_container_2Wc0gaFlGl_Ui8HiSVQ6l">
          <img src="${b.imageUrl ?? `https://m.media-amazon.com/images/I/test.SX150.jpg`}" alt="" />
        </div>
        <div class="DigitalEntitySummary-module__entity_information_container_3Cq8xgKD2vJmxvRc3xW5v_">
          <div class="digital_entity_details">
            <div class="information_row tags"><i class="icon-audible"></i></div>
            <div class="digital_entity_title">${b.title}</div>
            <div class="information_row">${b.author}</div>
            <span>
              <div id="content-acquired-date-${b.asin}" class="information_row">
                <span>Acquired on</span> ${b.date}
              </div>
              <div class="information_row">
                <span>${b.ownerLine}</span>
              </div>
            </span>
          </div>
        </div>
      </div>
    </td>
  </tr>`).join("\n")}</tbody>`;
}

describe("parseAudibleHtml", () => {
  it("parses a single audible book", () => {
    const html = makeAudibleHtml([{
      asin: "B0B62439N9",
      title: "Brain Damage",
      author: "Freida McFadden",
      date: "March 11, 2026",
      ownerLine: "Acquired by Denise A Verkon",
    }]);

    const books = parseAudibleHtml(html);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      bookType: "AUDIBLE",
      title: "Brain Damage",
      authors: "Freida McFadden",
      owner: "dverkon",
      purchaseDate: "2026-03-11",
    });
  });

  it("resolves 'Shared with' as the other owner", () => {
    const html = makeAudibleHtml([{
      asin: "B0D7N19JGL",
      title: "A Thousand Li: The First Step",
      author: "Tao Wong",
      date: "March 10, 2026",
      ownerLine: "Shared with Denise A Verkon",
    }]);

    const books = parseAudibleHtml(html);
    expect(books).toHaveLength(1);
    expect(books[0].owner).toBe("tverkon");
    expect(books[0].title).toBe("A Thousand Li");
    expect(books[0].description).toBe("The First Step");
  });

  it("parses multiple books", () => {
    const html = makeAudibleHtml([
      { asin: "A1", title: "Book One", author: "Author A", date: "January 1, 2026", ownerLine: "Acquired by Denise A Verkon" },
      { asin: "A2", title: "Book Two", author: "Author B", date: "February 2, 2026", ownerLine: "Shared with Denise A Verkon" },
    ]);

    const books = parseAudibleHtml(html);
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("Book One");
    expect(books[0].owner).toBe("dverkon");
    expect(books[1].title).toBe("Book Two");
    expect(books[1].owner).toBe("tverkon");
  });

  it("upgrades image URLs from SX150 to SX450", () => {
    const html = makeAudibleHtml([{
      asin: "A1",
      title: "Test Book",
      author: "Author",
      date: "January 1, 2026",
      ownerLine: "Acquired by Denise A Verkon",
      imageUrl: "https://m.media-amazon.com/images/I/test.SX150.jpg",
    }]);

    const books = parseAudibleHtml(html);
    expect(books[0].image).toBe("https://m.media-amazon.com/images/I/test.SX450.jpg");
  });

  it("extracts series from title parenthetical", () => {
    const html = makeAudibleHtml([{
      asin: "A1",
      title: "Changes: The Dresden Files, Book 12",
      author: "Jim Butcher",
      date: "February 17, 2026",
      ownerLine: "Shared with Denise A Verkon",
    }]);

    const books = parseAudibleHtml(html);
    expect(books[0].title).toBe("Changes");
    expect(books[0].description).toBe("The Dresden Files, Book 12");
    expect(books[0].series).toBeNull();
  });

  it("handles series with Book N pattern", () => {
    const html = makeAudibleHtml([{
      asin: "A1",
      title: "Iron Gold (Red Rising Book 4)",
      author: "Pierce Brown",
      date: "February 13, 2026",
      ownerLine: "Shared with Denise A Verkon",
    }]);

    const books = parseAudibleHtml(html);
    expect(books[0].title).toBe("Iron Gold (Red Rising Book 4)");
    expect(books[0].series).toBe("Red Rising Book 4");
  });

  it("sets bookType to AUDIBLE for all books", () => {
    const html = makeAudibleHtml([
      { asin: "A1", title: "Book", author: "Author", date: "January 1, 2026", ownerLine: "Acquired by Denise A Verkon" },
    ]);

    const books = parseAudibleHtml(html);
    expect(books.every(b => b.bookType === "AUDIBLE")).toBe(true);
  });

  it("normalizes whitespace in multi-line titles", () => {
    const html = makeAudibleHtml([{
      asin: "A1",
      title: "\n              A Thousand Li: The First Step\n            ",
      author: "Tao Wong",
      date: "March 10, 2026",
      ownerLine: "Shared with Denise A Verkon",
    }]);

    const books = parseAudibleHtml(html);
    expect(books[0].title).toBe("A Thousand Li");
  });
});
