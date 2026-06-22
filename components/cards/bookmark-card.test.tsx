import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStore } from "@/store";
import { BookmarkCard } from "./bookmark-card";
import { asBookmarkId, type Bookmark } from "@/types";

const bm: Bookmark = {
  id: asBookmarkId("bk_1"),
  url: "https://e.com",
  title: "Title",
  description: "Desc",
  previewImageUrl: null,
  faviconUrl: null,
  domain: "e.com",
  previewStatus: "ready",
  folderId: null,
  tagIds: [],
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  previewFailureKind: null,
  previewAttempt: 0,
  readState: "inbox",
  captureStatus: "pending",
  captureFailureKind: null,
  captureAttempt: 0,
  readProgress: 0,
  note: null,
} as Bookmark;

beforeEach(() => {
  useStore.setState({
    snapshotByBookmarkId: { bk_1: "data:image/png;base64,AA" },
  });
});

describe("BookmarkCard snapshot (F31)", () => {
  it("renders the snapshot image when no og:image but a snapshot exists", () => {
    const { container } = render(
      <BookmarkCard
        bookmark={bm}
        isSelected={false}
        isFocused={false}
        onToggle={() => {}}
      />
    );
    const img = container.querySelector('img[src^="data:image/png"]');
    expect(img).not.toBeNull();
  });
});

describe("BookmarkCard link badge (F34)", () => {
  it("renders a Broken badge when linkStatus is broken", () => {
    render(
      <BookmarkCard
        bookmark={{ ...bm, linkStatus: "broken" } as typeof bm}
        isSelected={false}
        isFocused={false}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("Broken")).toBeInTheDocument();
  });

  it("renders Moved + Update when redirected", () => {
    render(
      <BookmarkCard
        bookmark={
          {
            ...bm,
            linkStatus: "redirected",
            linkRedirectUrl: "https://new.com",
          } as typeof bm
        }
        isSelected={false}
        isFocused={false}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText("Moved")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
  });
});
