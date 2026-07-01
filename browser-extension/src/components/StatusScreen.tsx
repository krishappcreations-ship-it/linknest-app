interface StatusScreenProps {
  phase: "saved" | "duplicate" | "error" | "offline";
  onRetry?: () => void;
}

export function StatusScreen({ phase, onRetry }: StatusScreenProps) {
  if (phase === "saved") {
    return (
      <div className="status-screen status-saved">
        <span className="status-icon">✓</span>
        <p>Saved to LinkNest</p>
      </div>
    );
  }
  if (phase === "duplicate") {
    return (
      <div className="status-screen status-duplicate">
        <p>Already in LinkNest</p>
        <button
          className="btn-secondary"
          onClick={() =>
            chrome.tabs.create({
              url:
                (import.meta.env.VITE_LINKNEST_URL as string) ||
                "https://linknest-inky.vercel.app",
            })
          }
        >
          Open LinkNest
        </button>
      </div>
    );
  }
  return (
    <div className="status-screen status-error">
      <p>{phase === "offline" ? "No connection" : "Couldn't save"}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
