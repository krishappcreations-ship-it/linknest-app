import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStore } from "@/store";
import { ImportExportDialog } from "./import-export-dialog";

beforeEach(() => {
  useStore.setState((s) => ({
    ui: { ...s.ui, dialog: { kind: "import-export" } },
  }));
});

describe("ImportExportDialog (F32)", () => {
  it("renders import drop-zone + export buttons when open", () => {
    render(<ImportExportDialog />);
    expect(screen.getByText(/Drop a .html or .json file/i)).toBeInTheDocument();
    expect(screen.getByText("Export JSON")).toBeInTheDocument();
    expect(screen.getByText("Export HTML")).toBeInTheDocument();
  });

  it("renders nothing when the dialog is closed", () => {
    useStore.setState((s) => ({ ui: { ...s.ui, dialog: { kind: "closed" } } }));
    render(<ImportExportDialog />);
    expect(screen.queryByText("Export JSON")).not.toBeInTheDocument();
  });
});
