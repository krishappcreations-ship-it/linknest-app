/**
 * Generate an on-device, text-only PNG snapshot for an image-less bookmark
 * (feature 31). No remote images → no CORS canvas taint. buildSnapshotNode is
 * pure; generateSnapshot renders it via html-to-image (double-call warms fonts).
 */

export interface SnapshotInput {
  title: string;
  excerpt: string;
  domain: string;
}

/** Deterministic 0–359 hue from a string. */
export function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

export function buildSnapshotNode(input: SnapshotInput): HTMLDivElement {
  const hue = hashHue(input.domain);
  const node = document.createElement("div");
  Object.assign(node.style, {
    width: "600px",
    height: "400px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxSizing: "border-box",
    padding: "44px",
    overflow: "hidden",
    background: `linear-gradient(135deg, hsl(${hue} 60% 32%), hsl(${(hue + 40) % 360} 60% 20%))`,
    color: "#fff",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });

  const top = document.createElement("div");
  Object.assign(top.style, {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflow: "hidden",
  });

  const title = document.createElement("div");
  Object.assign(title.style, {
    fontSize: "40px",
    fontWeight: "650",
    lineHeight: "1.15",
    letterSpacing: "-0.02em",
  });
  title.textContent = input.title;

  const excerpt = document.createElement("div");
  Object.assign(excerpt.style, {
    fontSize: "20px",
    lineHeight: "1.4",
    opacity: "0.85",
  });
  excerpt.textContent = input.excerpt;

  const domain = document.createElement("div");
  Object.assign(domain.style, { fontSize: "18px", opacity: "0.7" });
  domain.textContent = input.domain;

  top.appendChild(title);
  top.appendChild(excerpt);
  node.appendChild(top);
  node.appendChild(domain);
  return node;
}

export interface GenerateOpts {
  toPng?: (node: HTMLElement) => Promise<string>;
}

export async function generateSnapshot(
  input: SnapshotInput,
  opts: GenerateOpts = {}
): Promise<string> {
  const toPng = opts.toPng ?? realToPng;
  const node = buildSnapshotNode(input);
  Object.assign(node.style, { position: "fixed", left: "-99999px", top: "0" });
  document.body.appendChild(node);
  try {
    await toPng(node); // 1st pass warms fonts
    return await toPng(node); // 2nd pass is clean
  } finally {
    node.remove();
  }
}

async function realToPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(node, { width: 600, height: 400, pixelRatio: 1 });
}
