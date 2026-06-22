"use client";

import { FaviconFallback } from "./favicon-fallback";

interface Props {
  domain: string;
  faviconUrl: string | null;
  title: string;
  className?: string;
}

function domainHue(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function PreviewPlaceholder({
  domain,
  faviconUrl,
  title,
  className,
}: Props) {
  const hue = domainHue(domain);
  const letter = (domain[0] ?? "?").toUpperCase();

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden ${className ?? ""}`}
      style={{
        background: `linear-gradient(135deg, oklch(0.22 0.02 ${hue}) 0%, oklch(0.18 0.03 ${hue + 30}) 100%)`,
      }}
    >
      <span
        className="pointer-events-none absolute text-[120px] leading-none font-black select-none"
        style={{ color: `oklch(0.25 0.03 ${hue})` }}
      >
        {letter}
      </span>
      <div className="z-10 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
          <FaviconFallback url={faviconUrl} domain={domain} size={24} />
        </div>
        <span className="max-w-[80%] truncate text-center text-xs font-medium text-white/70">
          {domain}
        </span>
      </div>
    </div>
  );
}
