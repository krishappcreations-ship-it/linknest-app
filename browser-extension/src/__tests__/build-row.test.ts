import { describe, it, expect } from "vitest";
import { buildBookmarkRow } from "../lib/build-row";

describe("buildBookmarkRow", () => {
  it("builds a full snake_case LWW row with defaults", () => {
    const row = buildBookmarkRow(
      {
        url: "https://e.com/",
        title: "E",
        domain: "e.com",
        folderId: "f1",
        tagIds: ["t1", "t2"],
      },
      "user-1",
      1234
    );
    expect(row).toMatchObject({
      user_id: "user-1",
      url: "https://e.com/",
      title: "E",
      domain: "e.com",
      preview_status: "pending",
      folder_id: "f1",
      tag_ids: ["t1", "t2"],
      created_at: 1234,
      updated_at: 1234,
      deleted_at: null,
      read_state: "inbox",
      note: null,
      link_status: "unknown",
      link_checked_at: null,
      link_redirect_url: null,
    });
    expect(typeof row.id).toBe("string");
    expect(row.favicon_url).toContain("e.com");
  });
});
