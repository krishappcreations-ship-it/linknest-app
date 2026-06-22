/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useStore } from "@/store";
import { initialUiState } from "@/store/slices/ui-slice";
import { SyncQueueDialog } from "./sync-queue-dialog";

const { flushMock } = vi.hoisted(() => ({
  flushMock: vi.fn(async () => undefined),
}));

vi.mock("@/lib/sync/sync-runtime", () => ({
  flushOpportunistic: flushMock,
}));

function seedQueue(
  rows: { entity: string; id: string; attempts: number; createdAt: number }[]
) {
  const adapter = {
    async list() {
      return rows.map((r) => ({
        key: `${r.entity}:${r.id}`,
        entity: r.entity as "bookmark" | "folder" | "tag" | "preferences",
        createdAt: r.createdAt,
        attempts: r.attempts,
        payload: {} as any,
      }));
    },
    async enqueue() {},
    async size() {
      return rows.length;
    },
    async dequeue() {},
    async incrementAttempts() {
      return 0;
    },
  };
  useStore.setState({ syncQueueAdapter: adapter as any });
}

describe("SyncQueueDialog (F14)", () => {
  beforeEach(() => {
    flushMock.mockClear();
    useStore.setState({ ui: initialUiState });
  });

  it("is not rendered when dialog kind is closed", () => {
    render(<SyncQueueDialog />);
    expect(screen.queryByText("Sync queue")).not.toBeInTheDocument();
  });

  it("renders empty state when queue empty + Flush disabled", async () => {
    seedQueue([]);
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "sync-queue" } },
    }));
    render(<SyncQueueDialog />);
    await waitFor(() => {
      expect(screen.getByText(/Nothing pending/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Flush now/i })).toBeDisabled();
  });

  it("renders table rows when queue non-empty", async () => {
    seedQueue([
      {
        entity: "bookmark",
        id: "b1",
        attempts: 2,
        createdAt: Date.now() - 5000,
      },
    ]);
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "sync-queue" } },
    }));
    render(<SyncQueueDialog />);
    await waitFor(() => {
      expect(screen.getByText("bookmark")).toBeInTheDocument();
      expect(screen.getByText("2 / 5")).toBeInTheDocument();
    });
  });

  it("Flush button calls flushOpportunistic + refetches", async () => {
    seedQueue([
      { entity: "bookmark", id: "b1", attempts: 0, createdAt: Date.now() },
    ]);
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "sync-queue" } },
    }));
    render(<SyncQueueDialog />);
    await waitFor(() => screen.getByText("bookmark"));
    fireEvent.click(screen.getByRole("button", { name: /Flush now/i }));
    await waitFor(() => expect(flushMock).toHaveBeenCalled());
  });

  it("Close button transitions dialog to closed", async () => {
    seedQueue([]);
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "sync-queue" } },
    }));
    render(<SyncQueueDialog />);
    await waitFor(() => screen.getByText("Sync queue"));
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    await waitFor(() => {
      expect(useStore.getState().ui.dialog).toEqual({ kind: "closed" });
    });
  });

  it("singular/plural copy reflects count", async () => {
    seedQueue([
      { entity: "bookmark", id: "b1", attempts: 0, createdAt: Date.now() },
    ]);
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "sync-queue" } },
    }));
    render(<SyncQueueDialog />);
    await waitFor(() => {
      expect(screen.getByText(/1 pending write\./i)).toBeInTheDocument();
    });
  });
});
