import { InlinePasteInput } from "@/components/forms/inline-paste-input";
import { ContentTypeFilter } from "@/components/layout/content-type-filter";
import { BookmarkGrid } from "@/components/cards/bookmark-grid";

/**
 * Bookmark dashboard at /.
 *
 * Server component shell with client islands: InlinePasteInput (above grid for
 * fast capture), ContentTypeFilter (Links/Images/PDFs pills), and BookmarkGrid
 * (cards + hydration + shortcuts).
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <InlinePasteInput />
      <ContentTypeFilter />
      <BookmarkGrid />
    </div>
  );
}
