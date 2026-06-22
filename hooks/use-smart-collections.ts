"use client";

import { useStore } from "@/store";
import {
  applyCreateCollection,
  applyUpdateCollection,
  applyDeleteCollection,
  selectVisibleCollections,
} from "@/store/slices/smart-collections-slice";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { selectFolderSubtreeIds } from "@/store/slices/folders-slice";
import { setActiveSmartCollection, closeDialog } from "@/store/slices/ui-slice";
import {
  matchesRules,
  type RuleContext,
} from "@/lib/collections/evaluate-rules";
import type {
  FolderId,
  Rule,
  SmartCollection,
  SmartCollectionId,
  SmartCollectionInput,
} from "@/types";

export interface UseSmartCollections {
  collections: SmartCollection[];
  activeId: SmartCollectionId | null;
  create: (input: SmartCollectionInput) => Promise<SmartCollectionId>;
  rename: (id: SmartCollectionId, name: string) => Promise<void>;
  setRules: (id: SmartCollectionId, rules: Rule[]) => Promise<void>;
  remove: (id: SmartCollectionId) => Promise<void>;
  select: (id: SmartCollectionId | null) => void;
  count: (id: SmartCollectionId) => number;
}

function ruleContext(): RuleContext {
  const s = useStore.getState();
  return {
    readingMinutes: (id) => s.articleReadingMinutes[id],
    inFolderSubtree: (id: string, folderId: FolderId) => {
      const b = s.bookmarks.byId[id];
      return (
        b?.folderId != null &&
        selectFolderSubtreeIds(s.folders, folderId).has(b.folderId)
      );
    },
    now: Date.now(),
  };
}

export function getUseSmartCollectionsApi(): UseSmartCollections {
  const adapter = () => useStore.getState().smartCollectionsAdapter;
  const read = () => useStore.getState().smartCollections;

  return {
    get collections() {
      return selectVisibleCollections(useStore.getState().smartCollections);
    },
    get activeId() {
      return useStore.getState().ui.activeSmartCollectionId;
    },
    async create(input) {
      const r = await applyCreateCollection(read(), input, {
        adapter: adapter(),
      });
      useStore.setState({ smartCollections: r.state });
      return r.collection.id;
    },
    async rename(id, name) {
      const r = await applyUpdateCollection(
        read(),
        { id, name },
        { adapter: adapter() }
      );
      useStore.setState({ smartCollections: r.state });
    },
    async setRules(id, rules) {
      const r = await applyUpdateCollection(
        read(),
        { id, rules },
        { adapter: adapter() }
      );
      useStore.setState({ smartCollections: r.state });
    },
    async remove(id) {
      const r = await applyDeleteCollection(read(), id, { adapter: adapter() });
      useStore.setState({ smartCollections: r.state });
      // If the removed collection was active, clear the filter + any open dialog.
      useStore.setState((s) => ({
        ui:
          s.ui.activeSmartCollectionId === id
            ? setActiveSmartCollection(closeDialog(s.ui), null)
            : closeDialog(s.ui),
      }));
    },
    select(id) {
      useStore.setState((s) => ({ ui: setActiveSmartCollection(s.ui, id) }));
    },
    count(id) {
      const coll = read().byId[id];
      if (!coll) return 0;
      const ctx = ruleContext();
      return selectVisibleBookmarks(useStore.getState().bookmarks).filter((b) =>
        matchesRules(coll.rules, b, ctx)
      ).length;
    },
  };
}

export function useSmartCollections(): UseSmartCollections {
  // Subscribe so consumers re-render on relevant changes.
  useStore((s) => s.smartCollections);
  useStore((s) => s.ui.activeSmartCollectionId);
  useStore((s) => s.bookmarks);
  return getUseSmartCollectionsApi();
}
