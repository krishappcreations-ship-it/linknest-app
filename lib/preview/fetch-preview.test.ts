import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { fetchPreview } from "@/lib/preview/fetch-preview";
import { screenshotFallbackUrl } from "@/lib/preview/screenshot-url";

const SHOT = screenshotFallbackUrl("https://example.com/");

const HTML_OK = `<!doctype html><html><head>
<title>Hello World</title>
<meta name="description" content="A page">
<meta property="og:image" content="https://x.test/og.png">
<meta property="og:description" content="OG desc wins">
<link rel="icon" href="/favicon.ico">
</head><body>...</body></html>`;

const HTML_SPARSE = `<!doctype html><html><head><title>Just A Title</title></head><body></body></html>`;
const HTML_EMPTY_HEAD = `<!doctype html><html><head></head><body></body></html>`;

function mockResponse(opts: {
  body?: string;
  status?: number;
  url?: string;
}): Response {
  const body = opts.body ?? "";
  const status = opts.status ?? 200;
  const url = opts.url ?? "https://example.com/";
  // Build a real Response with a stream we control.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  const res = new Response(stream, { status });
  // url is read-only on Response; redefine via getter for test purposes.
  Object.defineProperty(res, "url", { value: url, configurable: true });
  return res;
}

function bigStreamResponse(byteCount: number): Response {
  const chunkSize = 16 * 1024;
  let written = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (written >= byteCount) {
        controller.close();
        return;
      }
      const remaining = byteCount - written;
      const size = Math.min(chunkSize, remaining);
      controller.enqueue(new Uint8Array(size));
      written += size;
    },
  });
  const res = new Response(stream, { status: 200 });
  Object.defineProperty(res, "url", {
    value: "https://example.com/",
    configurable: true,
  });
  return res;
}

beforeEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPreview happy paths", () => {
  it("returns full metadata when og + favicon present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ body: HTML_OK }))
    );
    const r = await fetchPreview("https://example.com/");
    expect(r).toMatchObject({
      ok: true,
      title: "Hello World",
      description: "OG desc wins",
      ogImage: "https://x.test/og.png",
      favicon: "https://example.com/favicon.ico",
    });
  });
  it("returns ok with null fields when head is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ body: HTML_EMPTY_HEAD }))
    );
    const r = await fetchPreview("https://example.com/");
    if (!r.ok) throw new Error("expected ok");
    expect(r.title).toBeNull();
    expect(r.description).toBeNull();
    // No image on the page → screenshot fallback.
    expect(r.ogImage).toBe(SHOT);
    // favicon falls back to google s2
    expect(r.favicon).toContain("google.com/s2/favicons");
  });
  it("returns ok with title only when sparse head", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ body: HTML_SPARSE }))
    );
    const r = await fetchPreview("https://example.com/");
    if (!r.ok) throw new Error("expected ok");
    expect(r.title).toBe("Just A Title");
    expect(r.ogImage).toBe(SHOT);
  });
});

describe("fetchPreview failure kinds", () => {
  it("falls back to a screenshot on non-retriable 4xx (e.g. 403 bot block)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ status: 403 }))
    );
    const r = await fetchPreview("https://example.com/");
    if (!r.ok) throw new Error("expected ok");
    expect(r.ogImage).toBe(SHOT);
    expect(r.title).toBeNull();
    expect(r.favicon).toContain("google.com/s2/favicons");
  });
  it("returns http_error on 502 (retriable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ status: 502 }))
    );
    const r = await fetchPreview("https://example.com/");
    expect(r).toEqual({ ok: false, kind: "http_error", retriable: true });
  });
  it("returns retriable http_error on 429 (rate limited)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ status: 429 }))
    );
    const r = await fetchPreview("https://example.com/");
    expect(r).toEqual({ ok: false, kind: "http_error", retriable: true });
  });
  it("returns network on fetch throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      })
    );
    const r = await fetchPreview("https://example.com/");
    expect(r).toEqual({ ok: false, kind: "network", retriable: true });
  });
  it("returns timeout on AbortError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("abort") as Error & { name: string };
        err.name = "AbortError";
        throw err;
      })
    );
    const r = await fetchPreview("https://example.com/");
    expect(r).toEqual({ ok: false, kind: "timeout", retriable: true });
  });
  it("falls back to a screenshot when body exceeds 2 MB cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => bigStreamResponse(3 * 1024 * 1024))
    );
    const r = await fetchPreview("https://example.com/");
    if (!r.ok) throw new Error("expected ok");
    expect(r.ogImage).toBe(SHOT);
  });
});

describe("fetchPreview SSRF guard", () => {
  it("blocks localhost", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await fetchPreview("http://localhost:5432/");
    expect(r).toEqual({ ok: false, kind: "blocked", retriable: false });
    expect(spy).not.toHaveBeenCalled();
  });
  it("blocks 127.0.0.1", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const r = await fetchPreview("http://127.0.0.1/x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
  });
  it("blocks 192.168.x.x", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const r = await fetchPreview("http://192.168.1.1/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
  });
  it("blocks non-http(s) schemes", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const r = await fetchPreview("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("blocked");
  });
});

describe("fetchPreview URL absolutization", () => {
  it("resolves relative og:image against final url", async () => {
    const HTML = `<head><meta property="og:image" content="/img/og.png"></head>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({ body: HTML, url: "https://final.test/path/" })
      )
    );
    const r = await fetchPreview("https://shortener.test/abc");
    if (!r.ok) throw new Error("ok");
    expect(r.ogImage).toBe("https://final.test/img/og.png");
  });
  it("ignores malformed og:image href", async () => {
    const HTML = `<head><meta property="og:image" content="not a url"></head>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ body: HTML }))
    );
    const r = await fetchPreview("https://example.com/");
    if (!r.ok) throw new Error("ok");
    // Malformed og:image is rejected, then the screenshot fallback applies.
    expect(r.ogImage).toBe(SHOT);
  });
  it("uses final redirect URL for favicon fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({ body: HTML_EMPTY_HEAD, url: "https://final.test/" })
      )
    );
    const r = await fetchPreview("https://short.test/x");
    if (!r.ok) throw new Error("ok");
    expect(r.favicon).toContain("domain=final.test");
    // Screenshot fallback uses the post-redirect final URL.
    expect(r.ogImage).toBe(screenshotFallbackUrl("https://final.test/"));
  });
});
