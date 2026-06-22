import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalErrorPage from "./global-error";

describe("app/global-error.tsx", () => {
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
    render(<GlobalErrorPage error={new Error("root crash")} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("reload button calls reset()", () => {
    render(<GlobalErrorPage error={new Error("root crash")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("clear local data button deletes linknest DB", async () => {
    render(<GlobalErrorPage error={new Error("root crash")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /clear local data/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(indexedDB.deleteDatabase).toHaveBeenCalledWith("linknest");
  });

  it("uses inline styles (no Tailwind class attributes)", () => {
    const { container } = render(
      <GlobalErrorPage error={new Error("root crash")} reset={reset} />
    );
    // At least one element must have a style attribute (inline styles confirmed)
    const styledEl = container.querySelector("[style]");
    expect(styledEl).toBeInTheDocument();
    // The root rendered element must not use Tailwind classes
    const withClass = container.querySelector("[class]");
    expect(withClass).toBeNull();
  });
});
