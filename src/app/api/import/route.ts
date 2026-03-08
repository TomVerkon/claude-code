import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseKindleText, parseImageJson, parseKindleHtml } from "@/lib/parsing/kindle-parser";
import { checkDuplicates, insertBooks } from "@/lib/queries/books";

const parseSchema = z.object({
  action: z.literal("parse"),
  format: z.enum(["text", "html"]).default("text"),
  rawText: z.string().min(1, "Text is required"),
  imagesJson: z.string().optional(),
});

const importSchema = z.object({
  action: z.literal("import"),
  books: z.array(
    z.object({
      bookType: z.enum(["KINDLE", "AUDIBLE", "TECHNICAL"]),
      title: z.string(),
      description: z.string().nullable(),
      image: z.string(),
      authors: z.string(),
      owner: z.enum(["tverkon", "dverkon"]),
      purchaseDate: z.string(),
      sortableTitle: z.string(),
      searchableContent: z.string(),
      series: z.string().nullable(),
    })
  ),
});

const requestSchema = z.discriminatedUnion("action", [parseSchema, importSchema]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);

    if (parsed.action === "parse") {
      let books;
      if (parsed.format === "html") {
        books = parseKindleHtml(parsed.rawText);
      } else {
        const images = parsed.imagesJson ? parseImageJson(parsed.imagesJson) : [];
        books = parseKindleText(parsed.rawText, images);
      }
      const { newBooks, duplicates } = await checkDuplicates(books);
      return NextResponse.json({ newBooks, duplicates });
    }

    // action === "import"
    const inserted = await insertBooks(parsed.books);
    return NextResponse.json({ inserted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
