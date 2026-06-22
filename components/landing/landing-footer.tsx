import { LogoMark } from "@/components/brand/logo-mark";

/**
 * Landing footer — static. Brand + tagline + in-page nav. No external/fake links.
 */
export function LandingFooter() {
  return (
    <footer className="border-border border-t px-6 py-12">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="size-6" gradientId="ln-logo-footer" />
          <span className="text-foreground font-semibold tracking-tight">
            LinkNest
          </span>
          <span className="text-foreground-subtle ml-2 text-sm">
            Save beautifully. Find instantly.
          </span>
        </div>
        <nav className="text-foreground-muted flex items-center gap-6 text-sm">
          <a
            href="#features"
            className="hover:text-foreground transition-colors duration-100 ease-out"
          >
            Features
          </a>
          <span className="text-foreground-subtle">© 2026 LinkNest</span>
        </nav>
      </div>
    </footer>
  );
}
