import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockMaybeSingle, mockRpc, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
  }));
  return { mockMaybeSingle, mockRpc, mockFrom };
});

vi.mock("../lib/supabase", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

vi.mock("../hooks/useFolders", () => ({
  useFolders: () => [
    { id: "f1", name: "Design", depth: 0 },
    { id: "f2", name: "Sub", depth: 1 },
  ],
}));

vi.mock("../hooks/useTags", () => ({
  useTags: () => [
    { id: "t1", name: "react", color: "cyan" },
    { id: "t2", name: "design", color: "blue" },
  ],
}));

import { SaveForm } from "../components/SaveForm";

const TAB = { url: "https://github.com/vercel/next.js", title: "Next.js" };

describe("SaveForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("pre-fills URL display and title input from tab prop", () => {
    render(<SaveForm userId="u1" tab={TAB} />);
    expect(screen.getByText(TAB.url)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Next.js")).toBeInTheDocument();
  });

  it("renders folder options including depth-indented subfolder", () => {
    render(<SaveForm userId="u1" tab={TAB} />);
    expect(screen.getByRole("option", { name: "Design" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "— Sub" })).toBeInTheDocument();
  });

  it("adds tag chip when existing tag selected from dropdown", async () => {
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByText("+ Add"));
    await user.click(screen.getByRole("button", { name: "react" }));
    expect(screen.getByText("react")).toBeInTheDocument();
  });

  it("Save button disabled and shows Saving… while in flight", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockRpc.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByRole("button", { name: "Save to LinkNest" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("transitions to duplicate state when URL already exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "existing-id" } });
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByRole("button", { name: "Save to LinkNest" }));
    await waitFor(() =>
      expect(screen.getByText("Already in LinkNest")).toBeInTheDocument()
    );
  });

  it("transitions to error state on insert failure", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockRpc.mockResolvedValue({ error: new Error("DB error") });
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByRole("button", { name: "Save to LinkNest" }));
    await waitFor(() =>
      expect(screen.getByText("Couldn't save")).toBeInTheDocument()
    );
  });

  it("transitions to offline state when navigator.onLine false", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByRole("button", { name: "Save to LinkNest" }));
    await waitFor(() =>
      expect(screen.getByText("No connection")).toBeInTheDocument()
    );
  });

  it("Retry button returns to ready state from error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockRpc.mockResolvedValue({ error: new Error("fail") });
    const user = userEvent.setup();
    render(<SaveForm userId="u1" tab={TAB} />);
    await user.click(screen.getByRole("button", { name: "Save to LinkNest" }));
    await waitFor(() => screen.getByText("Couldn't save"));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      screen.getByRole("button", { name: "Save to LinkNest" })
    ).toBeInTheDocument();
  });
});
