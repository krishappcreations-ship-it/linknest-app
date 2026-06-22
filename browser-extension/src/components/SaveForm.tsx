import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFolders } from "../hooks/useFolders";
import { useTags } from "../hooks/useTags";
import { normalizeUrl, extractDomain } from "../lib/domain";
import { buildBookmarkRow } from "../lib/build-row";
import { StatusScreen } from "./StatusScreen";

type Phase = "ready" | "saving" | "saved" | "duplicate" | "error" | "offline";

interface SaveFormProps {
  userId: string;
  tab: { url: string; title: string };
}

export function SaveForm({ userId, tab }: SaveFormProps) {
  const folders = useFolders();
  const tags = useTags();
  const [title, setTitle] = useState(tab.title);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("ready");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  async function handleSave() {
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("saving");

    const normalizedUrl = normalizeUrl(tab.url);
    const domain = extractDomain(normalizedUrl);

    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("url", normalizedUrl)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      setPhase("duplicate");
      return;
    }

    const row = buildBookmarkRow(
      {
        url: normalizedUrl,
        title: title.trim() || domain,
        domain,
        folderId,
        tagIds: selectedTagIds,
      },
      userId,
      Date.now()
    );
    const { error } = await supabase.rpc("upsert_bookmarks_lww", {
      rows: [row],
    });

    if (error) {
      setPhase("error");
      return;
    }

    setPhase("saved");
    setTimeout(() => window.close(), 1500);
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  if (phase !== "ready" && phase !== "saving") {
    return (
      <StatusScreen
        phase={phase}
        onRetry={
          phase === "error" || phase === "offline"
            ? () => setPhase("ready")
            : undefined
        }
      />
    );
  }

  const unselectedTags = tags.filter((t) => !selectedTagIds.includes(t.id));

  return (
    <div className="save-form">
      <div className="field">
        <span className="field-label">URL</span>
        <p className="url-display" title={tab.url}>
          {tab.url}
        </p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="title-input">
          Title
        </label>
        <input
          id="title-input"
          className="text-input"
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="folder-select">
          Folder
        </label>
        <select
          id="folder-select"
          className="select-input"
          value={folderId ?? ""}
          onChange={(e) => setFolderId(e.target.value || null)}
        >
          <option value="">— None —</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {"— ".repeat(f.depth)}
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field-label">Tags</span>
        <div className="tag-area">
          {selectedTagIds.map((id) => {
            const tag = tags.find((t) => t.id === id);
            return tag ? (
              <span key={id} className="tag-chip">
                {tag.name}
                <button
                  className="tag-remove"
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => toggleTag(id)}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
          {unselectedTags.length > 0 && (
            <button
              className="add-tag-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              + Add
            </button>
          )}
          {dropdownOpen && (
            <div className="tag-dropdown">
              {unselectedTags.map((t) => (
                <button
                  key={t.id}
                  className="tag-option"
                  onClick={() => {
                    toggleTag(t.id);
                    setDropdownOpen(false);
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className="btn-primary save-btn"
        onClick={handleSave}
        disabled={phase === "saving"}
      >
        {phase === "saving" ? "Saving…" : "Save to LinkNest"}
      </button>
    </div>
  );
}
