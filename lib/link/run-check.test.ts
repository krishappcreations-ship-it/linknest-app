import { describe, it, expect } from "vitest";
import { runLinkCheck, type RunCheckDeps } from "@/lib/link/run-check";
import { asBookmarkId, type Bookmark } from "@/types";

const bm = (id: string, url: string): Bookmark =>
  ({ id: asBookmarkId(id), url, deletedAt: null }) as Bookmark;

describe("runLinkCheck", () => {
  it("checks each bookmark, stamps a patch, tallies a summary", async () => {
    const patches: Array<[string, string]> = [];
    const deps: RunCheckDeps = {
      checkUrl: async (url) =>
        url.includes("dead")
          ? { status: "broken", httpStatus: 404 }
          : { status: "ok" },
      updateBookmark: async (id, patch) => {
        patches.push([id, patch.linkStatus]);
      },
      now: () => 100,
    };
    const summary = await runLinkCheck(
      [bm("b1", "https://ok.com"), bm("b2", "https://dead.com")],
      deps
    );
    expect(summary).toMatchObject({ ok: 1, broken: 1 });
    expect(patches).toEqual([
      ["b1", "ok"],
      ["b2", "broken"],
    ]);
  });

  it("sets linkRedirectUrl only when redirected", async () => {
    const seen: Array<string | null> = [];
    const deps: RunCheckDeps = {
      checkUrl: async () => ({
        status: "redirected",
        redirectUrl: "https://new.com",
      }),
      updateBookmark: async (_id, patch) => {
        seen.push(patch.linkRedirectUrl);
      },
      now: () => 1,
    };
    await runLinkCheck([bm("b1", "https://x.com")], deps);
    expect(seen).toEqual(["https://new.com"]);
  });

  it("skips tombstoned bookmarks", async () => {
    const checked: string[] = [];
    const deps: RunCheckDeps = {
      checkUrl: async (url) => {
        checked.push(url);
        return { status: "ok" };
      },
      updateBookmark: async () => {},
    };
    const dead = { ...bm("b1", "https://x.com"), deletedAt: 5 } as Bookmark;
    await runLinkCheck([dead], deps);
    expect(checked).toEqual([]);
  });
});
