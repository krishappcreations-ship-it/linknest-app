"use client";

import type { ReactNode } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useDragDrop } from "@/hooks/use-drag-drop";
import { DragOverlayContent } from "./drag-overlay-content";

/**
 * Mounts the single DndContext at the dashboard layout level so sidebar +
 * grid share one drag event stream. autoScroll threshold 0.15 of viewport
 * height per dnd-kit defaults. dropAnimation bezier matches the ease.out
 * token from app/styles/motion.ts.
 */
export function DndProvider({ children }: { children: ReactNode }) {
  const dnd = useDragDrop();
  return (
    <DndContext
      sensors={dnd.sensors}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
      accessibility={{ announcements: dnd.announcements }}
      autoScroll={{ enabled: true, threshold: { x: 0, y: 0.15 } }}
    >
      {children}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <DragOverlayContent />
      </DragOverlay>
    </DndContext>
  );
}
