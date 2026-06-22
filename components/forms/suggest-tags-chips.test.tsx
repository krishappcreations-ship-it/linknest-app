/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useStore } from "@/store";
import { initialTagsState, addTag } from "@/store/slices/tags-slice";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { buildTag, asTagId, type TagId } from "@/types";
import { SuggestTagsChips } from "./suggest-tags-chips";

const { suggestTagsMock } = vi.hoisted(() => ({
  suggestTagsMock: vi.fn(),
}));
vi.mock("@/lib/ai/suggest-tags-client", () => ({
  suggestTags: suggestTagsMock,
}));

beforeEach(() => {
  suggestTagsMock.mockReset();
  useStore.setState({
    tags: initialTagsState,
    tagsAdapter: memoryTagsAdapter(),
  });
});

const baseProps = {
  url: "https://x/",
  title: "Test",
  description: null,
  currentTagIds: [] as TagId[],
  onApply: vi.fn(),
};

describe("SuggestTagsChips (F17)", () => {
  it("renders 'Suggest tags' button in idle state", () => {
    render(<SuggestTagsChips {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /Suggest tags/i })
    ).toBeInTheDocument();
  });

  it("renders chips after successful API call", async () => {
    suggestTagsMock.mockResolvedValue({
      ok: true,
      suggestions: [
        { name: "react", kind: "existing" },
        { name: "framework", kind: "new" },
      ],
    });
    render(<SuggestTagsChips {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Suggest tags/i }));
    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("framework")).toBeInTheDocument();
    });
  });

  it("renders Retry button on error", async () => {
    suggestTagsMock.mockResolvedValue({ ok: false, error: "network" });
    render(<SuggestTagsChips {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Suggest tags/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Retry/i })
      ).toBeInTheDocument();
    });
  });

  it("clicking existing-tag chip calls onApply with tag id", async () => {
    const reactTag = buildTag(
      { name: "react" },
      { now: () => 1, id: () => asTagId("tag_react") }
    );
    useStore.setState((s) => ({ tags: addTag(s.tags, reactTag).next }));
    suggestTagsMock.mockResolvedValue({
      ok: true,
      suggestions: [{ name: "react", kind: "existing" }],
    });
    const onApply = vi.fn();
    render(<SuggestTagsChips {...baseProps} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: /Suggest tags/i }));
    await waitFor(() => screen.getByText("react"));
    fireEvent.click(screen.getByText("react"));
    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(reactTag.id);
    });
  });
});
