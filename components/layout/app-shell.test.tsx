import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStore } from "@/store";
import { initialUiState } from "@/store/slices/ui-slice";
import { AppShell } from "./app-shell";

beforeEach(() => {
  useStore.setState({ ui: initialUiState });
});

describe("AppShell (Mobile UX)", () => {
  it("renders sidebar, topbar and children", () => {
    render(
      <AppShell sidebar={<div>Sidebar</div>} topbar={<div>Topbar</div>}>
        <div>Main content</div>
      </AppShell>
    );
    expect(screen.getByText("Topbar")).toBeInTheDocument();
    expect(screen.getByText("Main content")).toBeInTheDocument();
    // "Sidebar" appears twice: desktop <aside> + MobileDrawer (closed, but
    // children still render — only hidden via CSS in the real browser).
    expect(screen.getAllByText("Sidebar").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the bottom nav", () => {
    render(
      <AppShell sidebar={<div>Sidebar</div>} topbar={<div>Topbar</div>}>
        <div>Main content</div>
      </AppShell>
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" })
    ).toBeInTheDocument();
  });

  it("does not render the mobile drawer dialog when closed", () => {
    render(
      <AppShell sidebar={<div>Sidebar</div>} topbar={<div>Topbar</div>}>
        <div>Main content</div>
      </AppShell>
    );
    expect(
      screen.queryByRole("dialog", { name: "Library" })
    ).not.toBeInTheDocument();
  });
});
