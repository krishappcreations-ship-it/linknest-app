import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

describe("app/error.tsx", () => {
  const reset = vi.fn();

  beforeEach(() => {
    reset.mockClear();
    vi.stubGlobal("location", { reload: vi.fn() });
    vi.stubGlobal("indexedDB", {
      deleteDatabase: vi.fn(() => {
        const req = {
          onsuccess: null as (() => void) | null,
          onerror: null,
          onblocked: null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    });
  });

  it("renders error heading", () => {
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("reload button calls reset()", () => {
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("clear local data button deletes linknest DB", async () => {
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /clear local data/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(indexedDB.deleteDatabase).toHaveBeenCalledWith("linknest");
  });

  it("shows error.message in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<ErrorPage error={new Error("boom details")} reset={reset} />);
    expect(screen.getByText("boom details")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
