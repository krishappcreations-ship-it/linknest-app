export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        aria-hidden
        className="from-accent-blue to-accent-cyan size-10 rounded-xl bg-gradient-to-br"
      />
      <h1 className="text-foreground text-lg font-medium">
        You&apos;re offline
      </h1>
      <p className="text-foreground-muted max-w-xs text-sm">
        Your saved bookmarks are still here — reconnect to sync.
      </p>
      <a href="/" className="text-accent-blue text-sm hover:underline">
        Try again
      </a>
    </div>
  );
}
