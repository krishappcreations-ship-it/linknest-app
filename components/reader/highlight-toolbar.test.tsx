import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HighlightToolbar } from "./highlight-toolbar";

describe("HighlightToolbar (F30)", () => {
  it("renders nothing when no position", () => {
    const { container } = render(
      <HighlightToolbar position={null} onPick={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 4 color swatches and fires onPick", () => {
    const onPick = vi.fn();
    render(
      <HighlightToolbar position={{ top: 10, left: 10 }} onPick={onPick} />
    );
    expect(screen.getByLabelText("yellow")).toBeInTheDocument();
    expect(screen.getByLabelText("green")).toBeInTheDocument();
    expect(screen.getByLabelText("blue")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("pink"));
    expect(onPick).toHaveBeenCalledWith("pink");
  });
});
