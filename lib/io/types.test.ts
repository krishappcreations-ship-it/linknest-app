import { describe, it, expect } from "vitest";
import { LinkNestExportSchema } from "@/lib/io/types";

describe("LinkNestExportSchema", () => {
  it("parses a v1 export", () => {
    const data = {
      version: 1,
      exportedAt: 1,
      bookmarks: [
        {
          url: "https://e.com",
          title: "E",
          description: null,
          note: null,
          folderPath: ["Dev"],
          tags: ["js"],
          createdAt: 1,
        },
      ],
    };
    expect(LinkNestExportSchema.parse(data).bookmarks.length).toBe(1);
  });
  it("rejects a wrong version", () => {
    expect(() =>
      LinkNestExportSchema.parse({ version: 2, exportedAt: 1, bookmarks: [] })
    ).toThrow();
  });
});
