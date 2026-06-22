import { describe, it, expect } from "vitest";
import { createAnchor, resolveAnchor } from "@/lib/highlights/anchor";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("anchor", () => {
  it("resolves a unique quote to a range", () => {
    const r = root("<p>the quick brown fox jumps</p>");
    const range = resolveAnchor(
      { quote: "brown fox", prefix: "quick ", suffix: " jumps" },
      r
    );
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe("brown fox");
  });

  it("disambiguates duplicate quotes by context", () => {
    const r = root("<p>red car then blue car here</p>");
    const range = resolveAnchor(
      { quote: "car", prefix: "blue ", suffix: " here" },
      r
    );
    expect(range!.toString()).toBe("car");
    // matched "car" is the second one (preceded by "blue ")
    const idx = r.textContent!.indexOf("car", 8);
    expect(r.textContent!.slice(0, idx)).toContain("blue");
  });

  it("resolves a quote spanning multiple elements", () => {
    const r = root("<p>alpha <strong>beta</strong> gamma</p>");
    const range = resolveAnchor(
      { quote: "beta gamma", prefix: "alpha ", suffix: "" },
      r
    );
    expect(range!.toString()).toBe("beta gamma");
  });

  it("returns null when the quote is absent", () => {
    const r = root("<p>nothing relevant</p>");
    expect(
      resolveAnchor({ quote: "missing", prefix: "", suffix: "" }, r)
    ).toBeNull();
  });

  it("createAnchor round-trips through resolveAnchor", () => {
    const r = root("<p>one two three four five</p>");
    const text = r.firstChild!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 4); // "two..."
    range.setEnd(text, 11); // "...three"
    const anchor = createAnchor(range, r);
    expect(anchor.quote).toBe("two thr");
    const resolved = resolveAnchor(anchor, r);
    expect(resolved!.toString()).toBe("two thr");
  });
});
