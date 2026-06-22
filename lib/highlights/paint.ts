/**
 * Paint resolved highlights into the reader DOM (feature 30). Idempotent:
 * clearHighlights unwraps prior marks before each repaint. Returns the
 * highlights whose anchors could not be resolved against the current HTML.
 */

import type { Highlight } from "@/types";
import { resolveAnchor } from "./anchor";

export function clearHighlights(root: HTMLElement): void {
  const marks = root.querySelectorAll("mark[data-hl-id]");
  marks.forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

export function paintHighlights(
  root: HTMLElement,
  highlights: Highlight[]
): Highlight[] {
  clearHighlights(root);
  const unresolved: Highlight[] = [];
  for (const h of highlights) {
    const range = resolveAnchor(h, root);
    if (!range) {
      unresolved.push(h);
      continue;
    }
    const mark = document.createElement("mark");
    mark.setAttribute("data-hl-id", h.id);
    mark.setAttribute("data-color", h.color);
    if (h.annotation && h.annotation.length > 0) {
      mark.setAttribute("data-annotated", "true");
    }
    try {
      range.surroundContents(mark);
    } catch {
      // surroundContents throws when the range crosses element boundaries;
      // fall back to extract + wrap + reinsert.
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
  }
  return unresolved;
}
