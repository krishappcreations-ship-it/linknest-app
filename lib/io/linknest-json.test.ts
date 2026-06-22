import { describe, it, expect } from "vitest";
import {
  parseLinkNestJson,
  serializeLinkNestJson,
} from "@/lib/io/linknest-json";

const data = {
  version: 1 as const,
  exportedAt: 5,
  bookmarks: [
    {
      url: "https://e.com",
      title: "E",
      description: null,
      note: "hi",
      folderPath: ["A", "B"],
      tags: ["x"],
      createdAt: 9,
    },
  ],
};

describe("linknest-json", () => {
  it("round-trips", () => {
    const parsed = parseLinkNestJson(serializeLinkNestJson(data));
    expect(parsed).toEqual(data);
  });
  it("throws on invalid shape", () => {
    expect(() => parseLinkNestJson('{"version":2}')).toThrow();
  });
  it("throws on non-JSON", () => {
    expect(() => parseLinkNestJson("not json")).toThrow();
  });
});
