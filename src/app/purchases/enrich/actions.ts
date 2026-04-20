"use server";

import { revalidatePath } from "next/cache";
import { parseAudibleEnrichmentHtml } from "@/lib/parsing/audible-enrichment-parser";
import {
  previewAudibleEnrichment,
  applyAudibleEnrichment,
  type EnrichmentPreview,
} from "@/lib/queries/books";

export type EnrichmentRecord = {
  asin: string;
  title: string;
  authors: string;
  series: string | null;
  description: string | null;
};

export type PreviewResult = {
  records: EnrichmentRecord[];
  preview: EnrichmentPreview[];
};

export async function previewEnrichmentAction(
  rawHtml: string
): Promise<{ success: true; data: PreviewResult } | { success: false; error: string }> {
  try {
    const records = parseAudibleEnrichmentHtml(rawHtml);
    if (records.length === 0) {
      return { success: false, error: "No enrichment records found in the pasted HTML." };
    }
    const preview = await previewAudibleEnrichment(records);
    return { success: true, data: { records, preview } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Preview failed" };
  }
}

export async function applyEnrichmentAction(
  records: EnrichmentRecord[]
): Promise<{ success: true; updated: number } | { success: false; error: string }> {
  try {
    const updated = await applyAudibleEnrichment(
      records.map((r) => ({ asin: r.asin, series: r.series, description: r.description }))
    );
    revalidatePath("/books");
    return { success: true, updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Apply failed" };
  }
}
