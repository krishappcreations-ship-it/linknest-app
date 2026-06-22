import { describe, expect, it, beforeEach } from "vitest";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import type { Preview } from "@/types";

function makeEntry(url: string, fetchedAt = 1700000000000): Preview {
  return {
    url,
    title: "T",
    description: "D",
    imageUrl: "https://x.test/og.png",
    faviconUrl: "https://x.test/favicon.ico",
    domain: new URL(url).hostname,
    fetchedAt,
  };
}

describe("memoryPreviewCacheAdapter", () => {
  let cache: ReturnType<typeof memoryPreviewCacheAdapter>;
  beforeEach(() => {
    cache = memoryPreviewCacheAdapter();
  });

  it("round-trips a put + get by url", async () => {
    const e = makeEntry("https://a.test/");
    await cache.put(e);
    expect(await cache.get("https://a.test/")).toEqual(e);
  });
  it("returns null for unknown url", async () => {
    expect(await cache.get("https://unknown.test/")).toBeNull();
  });
  it("put is idempotent (overwrites by url)", async () => {
    await cache.put(makeEntry("https://a.test/", 1));
    await cache.put(makeEntry("https://a.test/", 2));
    const out = await cache.get("https://a.test/");
    expect(out?.fetchedAt).toBe(2);
  });
  it("delete removes a row", async () => {
    await cache.put(makeEntry("https://a.test/"));
    await cache.delete("https://a.test/");
    expect(await cache.get("https://a.test/")).toBeNull();
  });
  it("delete on unknown url is a noop", async () => {
    await expect(cache.delete("https://nope.test/")).resolves.toBeUndefined();
  });
  it("list returns all entries", async () => {
    await cache.put(makeEntry("https://a.test/"));
    await cache.put(makeEntry("https://b.test/"));
    expect((await cache.list()).map((e) => e.url).sort()).toEqual([
      "https://a.test/",
      "https://b.test/",
    ]);
  });
});
