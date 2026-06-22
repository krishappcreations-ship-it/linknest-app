/**
 * LinkNest logo mark — the gradient rounded square + white bookmark (mirrors
 * public/icon.svg, the favicon + extension icon). Inline SVG so it stays crisp
 * and needs no network request; server-component safe. Pass a unique
 * `gradientId` per page to avoid duplicate SVG def ids.
 */
export function LogoMark({
  className = "size-6",
  gradientId = "ln-logo",
}: {
  className?: string;
  gradientId?: string;
}) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradientId})`} />
      <path
        d="M176 132h160a28 28 0 0 1 28 28v220l-108-72-108 72V160a28 28 0 0 1 28-28z"
        fill="#fff"
        fillOpacity="0.95"
      />
    </svg>
  );
}
