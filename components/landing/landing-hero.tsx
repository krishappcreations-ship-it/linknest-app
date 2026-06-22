import { HeroContent } from "./hero-content";
import { AppPreview } from "./app-preview";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Hero — asymmetric split: copy + CTAs on the left, product screenshot on the
 * right (single column on mobile). Server component; the interactive/animated
 * left column is the HeroContent client leaf.
 */
export function LandingHero() {
  return (
    <section className="relative px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      <div className="absolute top-5 right-6">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <HeroContent />
        <div className="lg:pl-4">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}
