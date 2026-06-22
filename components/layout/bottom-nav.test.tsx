import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useStore } from "@/store";
import { initialUiState } from "@/store/slices/ui-slice";
import { BottomNav } from "./bottom-nav";

beforeEach(() => {
  useStore.setState({ ui: initialUiState });
});

describe("BottomNav (Mobile UX)", () => {
  it("renders 4 nav buttons", () => {
    render(<BottomNav />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("'All bookmarks' button is active by default", () => {
    render(<BottomNav />);
    expect(
      screen.getByRole("button", { name: "All bookmarks" })
    ).toHaveAttribute("data-active", "true");
  });

  it("clicking 'All bookmarks' sets selectedFolderFilter to {kind: 'all'}", () => {
    useStore.setState((s) => ({
      ui: { ...s.ui, selectedFolderFilter: { kind: "unfiled" } },
    }));
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "All bookmarks" }));
    expect(useStore.getState().ui.selectedFolderFilter).toEqual({
      kind: "all",
    });
  });

  it("clicking 'Search' opens the command palette", () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(useStore.getState().ui.commandPaletteOpen).toBe(true);
  });

  it("renders the Add menu trigger (4-option menu, not a direct bookmark add)", () => {
    render(<BottomNav />);
    // The center + is now the AddMenu fab trigger (bookmark/PDF/image/prompt),
    // opened on click — it no longer opens the add dialog directly.
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(useStore.getState().ui.dialog).toEqual({ kind: "closed" });
  });

  it("clicking 'Folders' opens the mobile drawer", () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "Folders" }));
    expect(useStore.getState().ui.mobileDrawerOpen).toBe(true);
  });

  it("'Folders' button reflects active state when drawer is open", () => {
    useStore.setState((s) => ({ ui: { ...s.ui, mobileDrawerOpen: true } }));
    render(<BottomNav />);
    expect(screen.getByRole("button", { name: "Folders" })).toHaveAttribute(
      "data-active",
      "true"
    );
  });
});
