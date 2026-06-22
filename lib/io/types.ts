import { z } from "zod";

export interface ImportEntry {
  url: string;
  title: string;
  addDate?: number;
  folderPath: string[];
  tags: string[];
}

export interface ImportSummary {
  added: number;
  skipped: number;
  foldersCreated: number;
  tagsCreated: number;
  errors: string[];
}

export const ExportBookmarkSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  folderPath: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.number(),
});
export type ExportBookmark = z.infer<typeof ExportBookmarkSchema>;

export const LinkNestExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  bookmarks: z.array(ExportBookmarkSchema),
});
export type LinkNestExport = z.infer<typeof LinkNestExportSchema>;
