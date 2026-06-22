import {
  PlusCircledIcon,
  ImageIcon,
  LayersIcon,
  MagnifyingGlassIcon,
  DashboardIcon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import type { ComponentType } from "react";

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  span: string;
};

const FEATURES: Feature[] = [
  {
    icon: PlusCircledIcon,
    title: "Save anything",
    body: "Paste a URL, drag a link onto the grid, or save from the browser extension. Articles, videos, repos, docs — it all lands instantly.",
    span: "md:col-span-4",
  },
  {
    icon: ImageIcon,
    title: "Visual cards",
    body: "Every link becomes a card with preview image, title, description, and favicon.",
    span: "md:col-span-2",
  },
  {
    icon: LayersIcon,
    title: "Folders & tags",
    body: "Nest collections, color-code tags, and drag cards to organize.",
    span: "md:col-span-2",
  },
  {
    icon: MagnifyingGlassIcon,
    title: "Instant search",
    body: "Hit ⌘K and search titles, tags, domains, and full text in milliseconds.",
    span: "md:col-span-2",
  },
  {
    icon: DashboardIcon,
    title: "Three layouts",
    body: "Masonry, list, or gallery — switch instantly without losing your place.",
    span: "md:col-span-2",
  },
  {
    icon: ReaderIcon,
    title: "Read & keep",
    body: "Distraction-free reader with highlights, plus saved snapshots that stay readable offline and even if the original goes down.",
    span: "md:col-span-6",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-16 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px]">
        <h2 className="text-foreground max-w-[20ch] text-3xl font-semibold tracking-tighter md:text-4xl">
          Everything you need to organize the web
        </h2>
        <p className="text-foreground-muted mt-3 max-w-[55ch] text-base leading-relaxed">
          A focused toolkit for saving, sorting, and rediscovering what you find
          — built to feel fast and stay calm.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          {FEATURES.map(({ icon: Icon, title, body, span }) => (
            <article
              key={title}
              className={`group border-border bg-surface rounded-xl border p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5 ${span}`}
            >
              <span className="bg-surface-elevated grid size-9 place-items-center rounded-md">
                <Icon className="text-accent-cyan size-5" />
              </span>
              <h3 className="text-foreground mt-4 text-base font-medium">
                {title}
              </h3>
              <p className="text-foreground-muted mt-1.5 text-sm leading-relaxed">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
