import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { fetchArticle } from "@/lib/capture/fetch-article";

const ARTICLE = `<!doctype html><html><head><title>Headline</title></head>
<body><article><h1>Headline</h1>${"<p>Sentence with several words here for length.</p>".repeat(25)}</article></body></html>`;

const NON_ARTICLE = `<!doctype html><html><head><title>App</title></head><body><nav>menu</nav><div>hi</div></body></html>`;

function mockResponse(
  body: string,
  status = 200,
  url = "https://example.com/post"
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(body));
      c.close();
    },
  });
  const res = new Response(stream, { status });
  Object.defineProperty(res, "url", { value: url, configurable: true });
  return res;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchArticle", () => {
  it("blocks SSRF hosts without fetching", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await fetchArticle("http://127.0.0.1/secret");
    expect(r).toEqual({ ok: false, kind: "blocked", retriable: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns ok with extracted fields for an article", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(ARTICLE))
    );
    const r = await fetchArticle("https://example.com/post");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.textContent).toMatch(/Sentence with several words/);
      expect(r.readingMinutes).toBeGreaterThanOrEqual(1);
      expect(r.html).not.toMatch(/<script/i);
    }
  });

  it("returns not_readable for a non-article page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(NON_ARTICLE))
    );
    const r = await fetchArticle("https://example.com/app");
    expect(r).toEqual({ ok: false, kind: "not_readable", retriable: false });
  });

  it("maps 5xx to retriable http_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse("", 503))
    );
    const r = await fetchArticle("https://example.com/x");
    expect(r).toEqual({ ok: false, kind: "http_error", retriable: true });
  });
});
