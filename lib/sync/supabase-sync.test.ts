import { describe, it, expect } from "vitest";
import { bookmarkFromRow } from "@/lib/sync/supabase-sync";

function minimalRow(): Record<string, unknown> {
  return {
    id: "bk_1",
    url: "https://example.com/",
    title: "Example",
    description: null,
    preview_image_url: null,
    favicon_url: null,
    domain: "example.com",
    preview_status: "pending",
    folder_id: null,
    tag_ids: [],
    created_at: 1700000000000,
    updated_at: 1700000000000,
    deleted_at: null,
    preview_failure_kind: null,
    preview_attempt: 0,
  };
}

describe("bookmarkFromRow read_state (feature 22)", () => {
  it("maps read_state column to readState", () => {
    const b = bookmarkFromRow({ ...minimalRow(), read_state: "archived" });
    expect(b.readState).toBe("archived");
  });

  it("defaults readState to inbox when read_state column is absent", () => {
    const b = bookmarkFromRow(minimalRow());
    expect(b.readState).toBe("inbox");
  });
});

describe("bookmark link health sync (feature 34)", () => {
  it("reads link health columns", () => {
    const b = bookmarkFromRow({
      ...minimalRow(),
      link_status: "broken",
      link_checked_at: 9,
      link_redirect_url: "https://x.com",
    });
    expect(b.linkStatus).toBe("broken");
    expect(b.linkCheckedAt).toBe(9);
    expect(b.linkRedirectUrl).toBe("https://x.com");
  });
  it("defaults link health when columns absent", () => {
    const b = bookmarkFromRow(minimalRow());
    expect(b.linkStatus).toBe("unknown");
    expect(b.linkCheckedAt).toBeNull();
    expect(b.linkRedirectUrl).toBeNull();
  });
});

describe("bookmark note sync (feature 30)", () => {
  it("maps note column to note", () => {
    const b = bookmarkFromRow({ ...minimalRow(), note: "hello" });
    expect(b.note).toBe("hello");
  });

  it("defaults note to null when column is absent", () => {
    expect(bookmarkFromRow(minimalRow()).note).toBeNull();
  });
});

describe("bookmark assets sync (kind + asset_path)", () => {
  it("maps kind + asset_path and marks assets capture-ready", () => {
    const b = bookmarkFromRow({
      ...minimalRow(),
      kind: "pdf",
      asset_path: "u1/bk_1.pdf",
    });
    expect(b.kind).toBe("pdf");
    expect(b.assetPath).toBe("u1/bk_1.pdf");
    expect(b.captureStatus).toBe("ready");
  });

  it("defaults kind to link (capture pending) when columns absent", () => {
    const b = bookmarkFromRow(minimalRow());
    expect(b.kind).toBe("link");
    expect(b.assetPath).toBeNull();
    expect(b.captureStatus).toBe("pending");
  });
});

describe("prompt sync (prompt_body + prompt_category)", () => {
  it("maps prompt columns", () => {
    const b = bookmarkFromRow({
      ...minimalRow(),
      kind: "prompt",
      prompt_body: "a prompt",
      prompt_category: "Coding",
    });
    expect(b.kind).toBe("prompt");
    expect(b.promptBody).toBe("a prompt");
    expect(b.promptCategory).toBe("Coding");
  });
});
