/**
 * Smart collections slice (feature 27) — local-only CRUD with optimistic
 * updates + inverse rollback. No cloud sync, no tombstone (hard delete).
 */

import {
  buildSmartCollection,
  type Rule,
  type SmartCollection,
  type SmartCollectionId,
  type SmartCollectionInput,
} from "@/types";
import type { SmartCollectionsAdapter } from "@/lib/db/smart-collections-adapter";

export interface SmartCollectionsState {
  byId: Record<string, SmartCollection>;
  order: SmartCollectionId[];
}

export const initialSmartCollectionsState: SmartCollectionsState = {
  byId: {},
  order: [],
};

export type Inverse = (s: SmartCollectionsState) => SmartCollectionsState;

/* ---------- Pure reducers ---------- */

export function addCollection(
  state: SmartCollectionsState,
  c: SmartCollection
): { next: SmartCollectionsState; inverse: Inverse } {
  const next: SmartCollectionsState = {
    byId: { ...state.byId, [c.id]: c },
    order: [...state.order, c.id],
  };
  const inverse: Inverse = (s) => {
    const byId = { ...s.byId };
    delete byId[c.id];
    return { byId, order: s.order.filter((id) => id !== c.id) };
  };
  return { next, inverse };
}

export function renameCollection(
  state: SmartCollectionsState,
  id: SmartCollectionId,
  name: string,
  now: number
): { next: SmartCollectionsState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: SmartCollection = {
    ...prev,
    name: name.trim(),
    updatedAt: now,
  };
  return {
    next: { byId: { ...state.byId, [id]: updated }, order: state.order },
    inverse: (s) => ({ byId: { ...s.byId, [id]: prev }, order: s.order }),
  };
}

export function setRules(
  state: SmartCollectionsState,
  id: SmartCollectionId,
  rules: Rule[],
  now: number
): { next: SmartCollectionsState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: SmartCollection = { ...prev, rules, updatedAt: now };
  return {
    next: { byId: { ...state.byId, [id]: updated }, order: state.order },
    inverse: (s) => ({ byId: { ...s.byId, [id]: prev }, order: s.order }),
  };
}

export function removeCollection(
  state: SmartCollectionsState,
  id: SmartCollectionId
): { next: SmartCollectionsState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const idx = state.order.indexOf(id);
  const byId = { ...state.byId };
  delete byId[id];
  const next: SmartCollectionsState = {
    byId,
    order: state.order.filter((x) => x !== id),
  };
  const inverse: Inverse = (s) => {
    const order = [...s.order];
    order.splice(idx, 0, id);
    return { byId: { ...s.byId, [id]: prev }, order };
  };
  return { next, inverse };
}

/* ---------- Selectors ---------- */

export function selectVisibleCollections(
  state: SmartCollectionsState
): SmartCollection[] {
  return state.order
    .map((id) => state.byId[id])
    .filter(Boolean) as SmartCollection[];
}

/* ---------- apply* (optimistic + adapter + rollback; no sync) ---------- */

export interface ApplyOptions {
  adapter: SmartCollectionsAdapter;
  now?: () => number;
}

export async function applyCreateCollection(
  state: SmartCollectionsState,
  input: SmartCollectionInput,
  opts: ApplyOptions
): Promise<{
  state: SmartCollectionsState;
  collection: SmartCollection;
  rolledBack: boolean;
  error?: unknown;
}> {
  const c = buildSmartCollection(input, { now: opts.now });
  const { next, inverse } = addCollection(state, c);
  try {
    await opts.adapter.put(c);
    return { state: next, collection: c, rolledBack: false };
  } catch (err) {
    return {
      state: inverse(next),
      collection: c,
      rolledBack: true,
      error: err,
    };
  }
}

export async function applyUpdateCollection(
  state: SmartCollectionsState,
  args: { id: SmartCollectionId; name?: string; rules?: Rule[] },
  opts: ApplyOptions
): Promise<{
  state: SmartCollectionsState;
  rolledBack: boolean;
  error?: unknown;
}> {
  const now = (opts.now ?? Date.now)();
  let working = state;
  let inverse: Inverse = (s) => s;
  if (args.name !== undefined) {
    const r = renameCollection(working, args.id, args.name, now);
    working = r.next;
    inverse = r.inverse;
  }
  if (args.rules !== undefined) {
    const r = setRules(working, args.id, args.rules, now);
    const prevInverse = inverse;
    working = r.next;
    inverse = (s) => prevInverse(r.inverse(s));
  }
  if (working === state) return { state, rolledBack: false };
  const updated = working.byId[args.id];
  if (!updated) return { state, rolledBack: false };
  try {
    await opts.adapter.put(updated);
    return { state: working, rolledBack: false };
  } catch (err) {
    return { state: inverse(working), rolledBack: true, error: err };
  }
}

export async function applyDeleteCollection(
  state: SmartCollectionsState,
  id: SmartCollectionId,
  opts: ApplyOptions
): Promise<{
  state: SmartCollectionsState;
  rolledBack: boolean;
  error?: unknown;
}> {
  const { next, inverse } = removeCollection(state, id);
  if (next === state) return { state, rolledBack: false };
  try {
    await opts.adapter.remove(id);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}
