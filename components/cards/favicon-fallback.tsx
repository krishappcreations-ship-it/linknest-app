"use client";

import { useState } from "react";

interface Props {
  url: string | null;
  domain: string;
  size?: number;
  className?: string;
}

export function FaviconFallback({ url, domain, size, className }: Props) {
  const [errored, setErrored] = useState(false);
  const px = size ?? 12;
  const fontSize = Math.max(8, Math.round(px * 0.6));
  if (!url || errored) {
    return (
      <span
        aria-hidden
        className={`bg-surface-hover text-foreground-muted inline-flex items-center justify-center rounded-sm font-semibold ${className ?? ""}`}
        style={{ width: px, height: px, fontSize }}
      >
        {domain.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={px}
      height={px}
      onError={() => setErrored(true)}
      className={`inline-block rounded-sm ${className ?? ""}`}
      style={{ width: px, height: px }}
    />
  );
}
