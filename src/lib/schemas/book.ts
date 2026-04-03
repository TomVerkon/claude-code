import { z } from "zod";

export const bookSchema = z.object({
  bookType: z.enum(["KINDLE", "AUDIBLE", "TECHNICAL"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().default(null),
  image: z.string().default("https://via.placeholder.com/150x226/1ECBE1/ffffff"),
  owner: z.enum(["tverkon", "dverkon"]),
  authors: z.string().min(1, "Authors required"),
  purchaseDate: z.string().min(1, "Purchase date required"),
  series: z.string().nullable().default(null),
});

export type BookFormData = z.infer<typeof bookSchema>;
