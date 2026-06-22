import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useStore } from "@/store";
import { initialUiState } from "@/store/slices/ui-slice";
import { MobileDrawer } from "./mobile-drawer";

beforeEach(() => {
  useStore.setState({ ui: initialUiState });
});

describe("MobileDrawer (Mobile UX)", () => {
  it("renders nothing when mobileDrawerOpen=false", () => {
    render(
      <MobileDrawer>
        <div>Sidebar content</div>
      </MobileDrawer>
    );
    expect(screen.queryByText("Sidebar content")).not.toBeInTheDocument();
  });

  it("renders children + dialog panel when mobileDrawerOpen=true", () => {
    useStore.setState((s) => ({ ui: { ...s.ui, mobileDrawerOpen: true } }));
    render(
      <MobileDrawer>
        <div>Sidebar content</div>
      </MobileDrawer>
    );
    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Library" })).toBeInTheDocument();
  });

  it("clicking the backdrop closes the drawer", () => {
    useStore.setState((s) => ({ ui: { ...s.ui, mobileDrawerOpen: true } }));
    const { container } = render(
      <MobileDrawer>
        <div>Sidebar content</div>
      </MobileDrawer>
    );
    const backdrop = container.querySelector('[data-testid="drawer-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(useStore.getState().ui.mobileDrawerOpen).toBe(false);
  });

  it("pressing Escape closes the drawer", () => {
    useStore.setState((s) => ({ ui: { ...s.ui, mobileDrawerOpen: true } }));
    render(
      <MobileDrawer>
        <div>Sidebar content</div>
      </MobileDrawer>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useStore.getState().ui.mobileDrawerOpen).toBe(false);
  });
});
