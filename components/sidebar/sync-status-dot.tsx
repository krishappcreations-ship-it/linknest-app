"use client";
import { useStore, selectSyncDotState } from "@/store";
import { openSyncQueueDialog } from "@/store/slices/ui-slice";

export function SyncStatusDot() {
  const state = useStore(selectSyncDotState);
  const queueSize = useStore((s) => s.syncStatus.queueSize);

  if (state === "hidden") return null;

  const config = {
    synced: {
      dotClass: "bg-tone-success",
      label: "All synced",
    },
    pending: {
      dotClass: "bg-tone-warn",
      label: queueSize === 1 ? "1 pending" : `${queueSize} pending`,
    },
    disconnected: {
      dotClass: "bg-tone-error",
      label: "Offline",
    },
  }[state];

  const handleClick = () => {
    useStore.setState((s) => ({ ui: openSyncQueueDialog(s.ui) }));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-text-muted hover:text-foreground hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-100 ease-out active:scale-[0.99]"
      title={`${config.label} — click for details`}
    >
      <span aria-hidden className={`size-2 rounded-full ${config.dotClass}`} />
      <span className="tabular-nums">{config.label}</span>
    </button>
  );
}
