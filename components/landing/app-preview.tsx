import Image from "next/image";

/**
 * Framed product screenshot for the hero. Fixed intrinsic dimensions + priority
 * load to avoid layout shift (Lighthouse CLS target). The frame's top bar is a
 * restrained window chrome — no glass, no glow.
 */
export function AppPreview() {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-2xl shadow-black/40">
      <div className="border-border bg-surface-elevated flex items-center gap-1.5 border-b px-3 py-2">
        <span className="bg-surface-hover size-2.5 rounded-full" aria-hidden />
        <span className="bg-surface-hover size-2.5 rounded-full" aria-hidden />
        <span className="bg-surface-hover size-2.5 rounded-full" aria-hidden />
      </div>
      <Image
        src="/landing/app-preview.png"
        alt="LinkNest library showing saved bookmarks as visual cards"
        width={1280}
        height={832}
        priority
        className="block h-auto w-full"
      />
    </div>
  );
}
