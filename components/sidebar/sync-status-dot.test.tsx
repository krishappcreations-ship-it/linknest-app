/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useStore } from "@/store";
import { initialUiState } from "@/store/slices/ui-slice";
import { initialAuthState } from "@/store/slices/auth-slice";
import { SyncStatusDot } from "./sync-status-dot";

beforeEach(() => {
  useStore.setState({
    auth: initialAuthState,
    ui: initialUiState,
    syncStatus: { queueSize: 0, realtimeConnected: false },
  });
});

describe("SyncStatusDot (F18)", () => {
  it("renders nothing when anon", () => {
    const { container } = render(<SyncStatusDot />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders 'All synced' when signed in + queue empty + connected", () => {
    useStore.setState((s) => ({
      auth: { ...s.auth, userId: "u1", status: "signed-in" },
      syncStatus: { queueSize: 0, realtimeConnected: true },
    }));
    render(<SyncStatusDot />);
    expect(screen.getByText(/All synced/i)).toBeInTheDocument();
  });

  it("renders 'N pending' when queue non-empty", () => {
    useStore.setState((s) => ({
      auth: { ...s.auth, userId: "u1", status: "signed-in" },
      syncStatus: { queueSize: 3, realtimeConnected: true },
    }));
    render(<SyncStatusDot />);
    expect(screen.getByText(/3 pending/i)).toBeInTheDocument();
  });

  it("click opens sync-queue dialog", () => {
    useStore.setState((s) => ({
      auth: { ...s.auth, userId: "u1", status: "signed-in" },
      syncStatus: { queueSize: 0, realtimeConnected: true },
    }));
    render(<SyncStatusDot />);
    fireEvent.click(screen.getByRole("button"));
    expect(useStore.getState().ui.dialog).toEqual({ kind: "sync-queue" });
  });
});
