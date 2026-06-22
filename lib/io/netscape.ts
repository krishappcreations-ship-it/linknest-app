/**
 * Netscape bookmarks HTML parser + serializer (feature 32). Pure string↔data.
 * Tolerant: malformed nodes are skipped, never thrown. DOMParser exists in the
 * browser and in jsdom (vitest env).
 *
 * Standard shape: a folder is `<DT><H3>Name</H3>` followed by a sibling `<DL>`
 * holding that folder's items; bookmarks are `<DT><A HREF ...>`.
 */

import type { ImportEntry, LinkNestExport } from "./types";

/** The `<DL>` that follows an `<H3>`'s `<DT>` (child first, else next sibling). */
function nestedDl(dt: Element): Element | null {
  const child = dt.querySelector(":scope > dl");
  if (child) return child;
  let sib = dt.nextElementSibling;
  while (sib) {
    if (sib.tagName === "DL") return sib;
    if (sib.tagName === "DT") return null;
    sib = sib.nextElementSibling;
  }
  return null;
}

export function parseNetscape(html: string): ImportEntry[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const entries: ImportEntry[] = [];

  function walk(dl: Element, path: string[]): void {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== "DT") continue;
      const h3 = dt.querySelector(":scope > h3");
      const a = dt.querySelector(":scope > a");
      if (h3) {
        const name = (h3.textContent ?? "").trim();
        const dl2 = nestedDl(dt);
        if (dl2) walk(dl2, name ? [...path, name] : path);
      } else if (a) {
        const url = a.getAttribute("href")?.trim();
        if (!url) continue;
        const tagsAttr = a.getAttribute("tags");
        const addDateAttr = a.getAttribute("add_date");
        entries.push({
          url,
          title: (a.textContent ?? url).trim() || url,
          folderPath: [...path],
          tags: tagsAttr
            ? tagsAttr
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          ...(addDateAttr ? { addDate: Number(addDateAttr) * 1000 } : {}),
        });
      }
    }
  }

  const root = doc.querySelector("dl");
  if (root) walk(root, []);
  return entries;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface Node {
  folders: Map<string, Node>;
  items: LinkNestExport["bookmarks"];
}

export function serializeNetscape(data: LinkNestExport): string {
  const root: Node = { folders: new Map(), items: [] };
  for (const b of data.bookmarks) {
    let node = root;
    for (const seg of b.folderPath) {
      if (!node.folders.has(seg))
        node.folders.set(seg, { folders: new Map(), items: [] });
      node = node.folders.get(seg)!;
    }
    node.items.push(b);
  }

  function render(node: Node, indent: string): string {
    let out = "";
    for (const [name, child] of node.folders) {
      out += `${indent}<DT><H3>${esc(name)}</H3>\n${indent}<DL><p>\n`;
      out += render(child, indent + "  ");
      out += `${indent}</DL><p>\n`;
    }
    for (const b of node.items) {
      const tags = b.tags.length ? ` TAGS="${esc(b.tags.join(","))}"` : "";
      const date = ` ADD_DATE="${Math.floor(b.createdAt / 1000)}"`;
      out += `${indent}<DT><A HREF="${esc(b.url)}"${date}${tags}>${esc(b.title)}</A>\n`;
    }
    return out;
  }

  return (
    `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n` +
    `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n` +
    `<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n` +
    render(root, "  ") +
    `</DL><p>\n`
  );
}
