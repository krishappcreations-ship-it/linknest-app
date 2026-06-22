"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/store";
import { closeDialog } from "@/store/slices/ui-slice";
import { useSmartCollections } from "@/hooks/use-smart-collections";
import { selectVisibleTags } from "@/store/slices/tags-slice";
import type { Folder, Rule } from "@/types";

const FIELD_LABELS: Record<Rule["field"], string> = {
  readState: "Read state",
  captureStatus: "Capture status",
  tag: "Tag",
  untagged: "Untagged",
  folder: "Folder",
  readingMinutesGte: "Reading time ≥",
  createdWithinDays: "Saved within (days)",
};

function defaultRuleForField(field: Rule["field"]): Rule {
  switch (field) {
    case "readState":
      return { field, value: "inbox" };
    case "captureStatus":
      return { field, value: "ready" };
    case "tag":
      return { field, op: "has", value: "" };
    case "untagged":
      return { field };
    case "folder":
      return { field, op: "unfiled" };
    case "readingMinutesGte":
      return { field, value: 10 };
    case "createdWithinDays":
      return { field, value: 30 };
  }
}

const SELECT_CLASS =
  "border-border bg-surface text-foreground rounded-md border px-2 py-1 text-sm";

export function SmartCollectionDialog() {
  const dialog = useStore((s) => s.ui.dialog);
  const open = dialog.kind === "smart-collection";
  const editId = dialog.kind === "smart-collection" ? dialog.id : null;
  const { collections, create, rename, setRules, remove } =
    useSmartCollections();
  // Subscribe to the stable slice objects; derive arrays with useMemo. Returning
  // a fresh array straight from the selector makes useSyncExternalStore see a new
  // snapshot every render → infinite loop (React #185).
  const tagsState = useStore((s) => s.tags);
  const foldersState = useStore((s) => s.folders);
  const tags = useMemo(() => selectVisibleTags(tagsState), [tagsState]);
  const folders = useMemo(
    () =>
      Object.values(foldersState.byId).filter(
        (f) => f.deletedAt === null
      ) as Folder[],
    [foldersState]
  );

  const [name, setName] = useState("");
  const [rules, setRulesLocal] = useState<Rule[]>([]);

  useEffect(() => {
    if (!open) return;
    const existing = editId
      ? collections.find((c) => c.id === editId)
      : undefined;
    setName(existing?.name ?? "");
    setRulesLocal(existing?.rules ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const close = () => useStore.setState((s) => ({ ui: closeDialog(s.ui) }));

  const updateRule = (i: number, rule: Rule) =>
    setRulesLocal((rs) => rs.map((r, idx) => (idx === i ? rule : r)));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editId) {
      await rename(editId, trimmed);
      await setRules(editId, rules);
    } else {
      await create({ name: trimmed, rules });
    }
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="w-full max-w-md">
        <DialogTitle className="text-base font-semibold">
          {editId ? "Edit smart collection" : "New smart collection"}
        </DialogTitle>
        <DialogDescription className="text-foreground-muted mt-1 text-sm">
          A collection auto-populates with bookmarks matching all of its rules.
        </DialogDescription>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
          className="border-border bg-surface text-foreground mt-4 w-full rounded-md border px-3 py-2 text-sm outline-none"
        />

        <div className="mt-4 space-y-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={rule.field}
                onChange={(e) =>
                  updateRule(
                    i,
                    defaultRuleForField(e.target.value as Rule["field"])
                  )
                }
                className={SELECT_CLASS}
              >
                {(Object.keys(FIELD_LABELS) as Rule["field"][]).map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABELS[f]}
                  </option>
                ))}
              </select>

              {rule.field === "readState" && (
                <select
                  value={rule.value}
                  onChange={(e) =>
                    updateRule(i, {
                      field: "readState",
                      value: e.target.value as typeof rule.value,
                    })
                  }
                  className={SELECT_CLASS}
                >
                  {["inbox", "reading", "finished", "archived"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
              {rule.field === "captureStatus" && (
                <select
                  value={rule.value}
                  onChange={(e) =>
                    updateRule(i, {
                      field: "captureStatus",
                      value: e.target.value as typeof rule.value,
                    })
                  }
                  className={SELECT_CLASS}
                >
                  {["pending", "ready", "failed"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
              {rule.field === "tag" && (
                <>
                  <select
                    value={rule.op}
                    onChange={(e) =>
                      updateRule(i, {
                        ...rule,
                        op: e.target.value as "has" | "lacks",
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="has">has</option>
                    <option value="lacks">lacks</option>
                  </select>
                  <select
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(i, { ...rule, value: e.target.value })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="">— tag —</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {rule.field === "folder" && (
                <>
                  <select
                    value={rule.op}
                    onChange={(e) =>
                      updateRule(
                        i,
                        e.target.value === "unfiled"
                          ? { field: "folder", op: "unfiled" }
                          : { field: "folder", op: "in", value: "" }
                      )
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="unfiled">unfiled</option>
                    <option value="in">in folder</option>
                  </select>
                  {rule.op === "in" && (
                    <select
                      value={rule.value ?? ""}
                      onChange={(e) =>
                        updateRule(i, {
                          field: "folder",
                          op: "in",
                          value: e.target.value,
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="">— folder —</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
              {(rule.field === "readingMinutesGte" ||
                rule.field === "createdWithinDays") && (
                <input
                  type="number"
                  min={rule.field === "createdWithinDays" ? 1 : 0}
                  value={rule.value}
                  onChange={(e) =>
                    updateRule(i, {
                      field: rule.field,
                      value: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className={`${SELECT_CLASS} w-20`}
                />
              )}

              <button
                type="button"
                aria-label="Remove rule"
                onClick={() =>
                  setRulesLocal((rs) => rs.filter((_, idx) => idx !== i))
                }
                className="text-foreground-subtle hover:text-tone-error ml-auto text-sm"
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setRulesLocal((rs) => [...rs, { field: "untagged" }])
            }
            className="text-foreground-muted hover:text-foreground text-sm"
          >
            + Add rule
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {editId ? (
            <button
              type="button"
              onClick={async () => {
                await remove(editId);
                close();
              }}
              className="text-tone-error text-sm hover:underline"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="text-foreground-muted hover:bg-surface-hover rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!name.trim()}
              className="bg-accent-blue rounded-md px-3 py-1.5 text-sm text-white transition-colors active:scale-[0.97] disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
