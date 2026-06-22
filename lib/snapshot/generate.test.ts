import { describe, it, expect } from "vitest";
import {
  buildSnapshotNode,
  hashHue,
  generateSnapshot,
} from "@/lib/snapshot/generate";

describe("hashHue", () => {
  it("is deterministic and in range", () => {
    const a = hashHue("example.com");
    const b = hashHue("example.com");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });
  it("differs across domains", () => {
    expect(hashHue("a.com")).not.toBe(hashHue("bbbb.org"));
  });
});

describe("buildSnapshotNode", () => {
  it("renders title, excerpt, domain at fixed size", () => {
    const node = buildSnapshotNode({
      title: "Local-first software",
      excerpt: "Keep your data on the device you own.",
      domain: "inkandswitch.com",
    });
    expect(node.style.width).toBe("600px");
    expect(node.style.height).toBe("400px");
    expect(node.textContent).toContain("Local-first software");
    expect(node.textContent).toContain("inkandswitch.com");
  });
});

describe("generateSnapshot", () => {
  it("returns the dataUrl from the injected toPng and cleans up the node", async () => {
    const before = document.body.childElementCount;
    const url = await generateSnapshot(
      { title: "T", excerpt: "E", domain: "d.com" },
      { toPng: async () => "data:image/png;base64,ZZZZ" }
    );
    expect(url).toBe("data:image/png;base64,ZZZZ");
    expect(document.body.childElementCount).toBe(before);
  });
});
