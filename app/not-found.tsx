import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <p className="text-foreground-subtle font-mono text-6xl font-light">
          404
        </p>
        <div className="space-y-2">
          <h1 className="text-foreground text-lg font-medium">
            Page not found
          </h1>
          <p className="text-foreground-muted text-sm">
            This page doesn&apos;t exist or was moved.
          </p>
        </div>
        <Link
          href="/"
          className="bg-accent-blue text-foreground hover:bg-accent-blue/90 active:bg-accent-blue/80 inline-block rounded-md px-4 py-2 text-sm font-medium transition-colors duration-100 ease-out"
        >
          Back to LinkNest
        </Link>
      </div>
    </div>
  );
}
