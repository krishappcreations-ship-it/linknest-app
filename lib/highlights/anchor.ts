/**
 * Text-quote anchoring (feature 30). Serializes a DOM selection to a
 * quote + surrounding context, and resolves that anchor back to a live Range
 * against possibly-changed HTML. No DOM offsets are persisted, so anchors
 * survive re-sanitization, re-render, and markup tweaks. W3C-annotation style.
 */

const CONTEXT_LEN = 32;

export interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
}

interface NodeSpan {
  node: Text;
  start: number; // inclusive index into the flat string
  end: number; // exclusive
}

/** Walk all text nodes under root, building a flat string + node-offset map. */
function flatten(root: HTMLElement): { text: string; spans: NodeSpan[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const spans: NodeSpan[] = [];
  let text = "";
  let n = walker.nextNode() as Text | null;
  while (n) {
    const len = n.data.length;
    if (len > 0) {
      spans.push({ node: n, start: text.length, end: text.length + len });
      text += n.data;
    }
    n = walker.nextNode() as Text | null;
  }
  return { text, spans };
}

/** Map a flat-string index to a {node, offset} pair. */
function locate(
  spans: NodeSpan[],
  index: number
): { node: Text; offset: number } | null {
  for (const s of spans) {
    if (index >= s.start && index <= s.end) {
      return { node: s.node, offset: index - s.start };
    }
  }
  return null;
}

/** Length of the longest common suffix of a and b (chars adjacent to quote). */
function commonSuffix(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let l = 0;
  while (l < max && a[a.length - 1 - l] === b[b.length - 1 - l]) l++;
  return l;
}

/** Length of the longest common prefix of a and b (chars adjacent to quote). */
function commonPrefix(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let l = 0;
  while (l < max && a[l] === b[l]) l++;
  return l;
}

function flatIndexOf(spans: NodeSpan[], node: Text, offset: number): number {
  for (const s of spans) {
    if (s.node === node) return s.start + offset;
  }
  return 0;
}

export function createAnchor(range: Range, root: HTMLElement): TextAnchor {
  const { text, spans } = flatten(root);
  const startIdx = flatIndexOf(
    spans,
    range.startContainer as Text,
    range.startOffset
  );
  const endIdx = flatIndexOf(
    spans,
    range.endContainer as Text,
    range.endOffset
  );
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  return {
    quote: text.slice(lo, hi),
    prefix: text.slice(Math.max(0, lo - CONTEXT_LEN), lo),
    suffix: text.slice(hi, hi + CONTEXT_LEN),
  };
}

export function resolveAnchor(
  anchor: TextAnchor,
  root: HTMLElement
): Range | null {
  const { text, spans } = flatten(root);
  if (!anchor.quote) return null;

  // Collect every occurrence of the quote.
  const candidates: number[] = [];
  let from = text.indexOf(anchor.quote);
  while (from !== -1) {
    candidates.push(from);
    from = text.indexOf(anchor.quote, from + 1);
  }
  if (candidates.length === 0) return null;

  // Score by context overlap; highest wins, ties -> earliest.
  let best = candidates[0]!;
  let bestScore = -1;
  for (const idx of candidates) {
    const before = text.slice(0, idx);
    const after = text.slice(idx + anchor.quote.length);
    const score =
      commonSuffix(anchor.prefix, before) + commonPrefix(anchor.suffix, after);
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }

  const startPos = locate(spans, best);
  const endPos = locate(spans, best + anchor.quote.length);
  if (!startPos || !endPos) return null;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}
