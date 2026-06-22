import { describe, it, expect } from "vitest";
import { parseNetscape, serializeNetscape } from "@/lib/io/netscape";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Dev</H3>
  <DL><p>
    <DT><A HREF="https://react.dev" ADD_DATE="1700000000" TAGS="js,ui">React</A>
    <DT><H3>Tools</H3>
    <DL><p>
      <DT><A HREF="https://vite.dev">Vite</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://example.com">Example</A>
</DL><p>`;

describe("parseNetscape", () => {
  it("parses nested folders, tags, and add_date", () => {
    const entries = parseNetscape(SAMPLE);
    const react = entries.find((e) => e.url === "https://react.dev")!;
    expect(react.title).toBe("React");
    expect(react.folderPath).toEqual(["Dev"]);
    expect(react.tags).toEqual(["js", "ui"]);
    expect(react.addDate).toBe(1700000000 * 1000);
    const vite = entries.find((e) => e.url === "https://vite.dev")!;
    expect(vite.folderPath).toEqual(["Dev", "Tools"]);
    const ex = entries.find((e) => e.url === "https://example.com")!;
    expect(ex.folderPath).toEqual([]);
  });

  it("skips malformed entries without throwing", () => {
    const entries = parseNetscape(
      "<DL><DT><A>no href</A><DT><A HREF=''></A></DL>"
    );
    expect(entries).toEqual([]);
  });

  it("round-trips via serialize", () => {
    const data = {
      version: 1 as const,
      exportedAt: 1,
      bookmarks: [
        {
          url: "https://react.dev",
          title: "React",
          description: null,
          note: null,
          folderPath: ["Dev"],
          tags: ["js"],
          createdAt: 1700000000000,
        },
      ],
    };
    const out = parseNetscape(serializeNetscape(data));
    expect(out[0]!.url).toBe("https://react.dev");
    expect(out[0]!.folderPath).toEqual(["Dev"]);
    expect(out[0]!.tags).toEqual(["js"]);
  });
});
