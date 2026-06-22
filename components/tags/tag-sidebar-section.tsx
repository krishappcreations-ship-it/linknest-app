"use client";

import { useTags } from "@/hooks/use-tags";
import { TagSidebarRow } from "./tag-sidebar-row";

export function TagSidebarSection() {
  const { tags } = useTags();
  return (
    <>
      <div className="text-foreground-subtle px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Tags
      </div>
      {tags.length === 0 ? (
        <div className="text-foreground-subtle px-3 text-xs italic">
          No tags yet
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tags.map((tag) => (
            <TagSidebarRow key={tag.id} tag={tag} />
          ))}
        </div>
      )}
    </>
  );
}
