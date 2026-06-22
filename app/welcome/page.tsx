import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/landing-hero";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * Marketing landing page. Served at canonical `/` for anonymous visitors via the
 * proxy rewrite (see proxy.ts); authenticated users get the app at `/`
 * instead and are redirected off `/welcome`. Static server component for SEO +
 * Lighthouse; the only client islands are the hero CTAs / login dialog.
 */
export const metadata: Metadata = {
  title: "LinkNest — Save beautifully. Find instantly.",
  description:
    "A visual bookmark manager. Turn every saved link into a card — folders, tags, instant ⌘K search, three layouts, reading mode, and offline-ready snapshots.",
  openGraph: {
    title: "LinkNest — Save beautifully. Find instantly.",
    description:
      "A visual bookmark manager with folders, tags, instant search, and offline-ready snapshots.",
    type: "website",
  },
};

export default function WelcomePage() {
  return (
    <main id="top" className="bg-background text-foreground min-h-[100dvh]">
      <LandingHero />
      <FeatureGrid />
      <LandingFooter />
    </main>
  );
}
