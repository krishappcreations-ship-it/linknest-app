"use client";

interface Props {
  url: string | null | undefined;
  email: string | null | undefined;
  size?: "sm" | "md";
}

export function Avatar({ url, email, size = "sm" }: Props) {
  const sizeClass = size === "sm" ? "size-6" : "size-7";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (email?.charAt(0) ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`bg-accent-blue text-foreground inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full text-xs font-semibold`}
    >
      {initial}
    </span>
  );
}
