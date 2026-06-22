import { LinkNestExportSchema, type LinkNestExport } from "./types";

export function parseLinkNestJson(text: string): LinkNestExport {
  return LinkNestExportSchema.parse(JSON.parse(text));
}

export function serializeLinkNestJson(data: LinkNestExport): string {
  return JSON.stringify(data, null, 2);
}
