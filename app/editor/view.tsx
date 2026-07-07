"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  type MouseEvent,
} from "react";
import type { LogData, Commit, Tag } from "@/lib/log";
import { buildTimelineData } from "@/lib/log";
import {
  enrichLogDataWithPreviews,
  type OGSnapshot,
} from "@/lib/og-enrich";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { LogTimeline } from "@/components/log/log-timeline";
import {
  TimelineEditProvider,
  type InspectField,
  type InspectMode,
} from "@/components/log/timeline-edit-context";
import { useLocale } from "@/services";
import { toast } from "sonner";
import { MousePointer2 } from "lucide-react";
import type { Identity } from "@/lib/log";
import { EditorToolbar } from "./toolbar";
import { CommitEditor } from "./commit-editor";
import { TagEditor } from "./tag-editor";
import { IdentityEditor } from "./identity-editor";

// Static-import the snapshot so the editor preview can resolve previews and
// video covers client-side — the same merging /works does server-side. URLs
// not in the snapshot still need `pnpm og:snapshot` to gain a baked preview;
// the LinkCard component's runtime fetch is the third-tier fallback.
const ogSnapshot = ogSnapshotJson as OGSnapshot;
const INSPECT_MIN_WIDTH = 1024;

interface EditorViewProps {
  initialData: LogData;
}

export function EditorView({ initialData }: EditorViewProps) {
  const [data, setData] = useState<LogData>(initialData);
  const [savedData, setSavedData] = useState<LogData>(initialData);
  const [mode, setMode] = useState<InspectMode>("preview");
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(
    null,
  );
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null,
  );
  const [selectedField, setSelectedField] = useState<InspectField | null>(
    null,
  );
  const [inspectDisabled, setInspectDisabled] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bumped on out-of-band commit replacement (revert) so form sections
  // holding local draft state (MediaSection) remount and re-hydrate —
  // their `commit.id` key alone can't see the data change.
  const [formEpoch, setFormEpoch] = useState(0);
  // Inspect-mode global flag: reveal what production hides (unlisted /
  // locale-scoped commits, hidden-role rows) as annotated ghost rows.
  // Off = the canvas is exactly the public /works.
  const [showHidden, setShowHidden] = useState(true);
  const { locale, setLocale } = useLocale();

  // Reference equality is enough: every edit clones the slice it touches,
  // so `data === savedData` exactly tracks "no unsaved changes" without
  // re-serializing the whole log on every keystroke.
  const isDirty = data !== savedData;
  const effectiveMode: InspectMode = inspectDisabled ? "preview" : mode;
  const inspecting = effectiveMode === "inspect";

  // Derive preview data — runs the snapshot enrichment (same as /works does
  // server-side) so flipping a media item to `present:"card"` immediately
  // surfaces the OG cover in the hover/peek view, provided the URL is in the
  // snapshot. URLs that aren't snapshotted yet need `pnpm og:snapshot`.
  // includeAll (unlisted + locale-scoped commits in the flow) is gated
  // on BOTH inspect mode and the "show hidden" toggle — flipping the
  // toggle off makes the canvas production-faithful even while inspecting.
  const revealHidden = inspecting && showHidden;
  const previewData = useMemo(
    () =>
      buildTimelineData(
        enrichLogDataWithPreviews(data, ogSnapshot),
        revealHidden ? undefined : locale,
        revealHidden ? { includeAll: true } : undefined,
      ),
    [data, revealHidden, locale],
  );

  const selectedCommit = useMemo(
    () => data.commits.find((c) => c.id === selectedCommitId) ?? null,
    [data.commits, selectedCommitId]
  );

  // The on-disk version of the selected commit — feeds the inspector's
  // dirty-field indicators ("what did I change?") and per-commit revert.
  const savedCommit = useMemo(
    () => savedData.commits.find((c) => c.id === selectedCommitId) ?? null,
    [savedData.commits, selectedCommitId],
  );

  const editingTagObj = useMemo(
    () => data.tags.find((t) => t.id === editingTag) ?? null,
    [data.tags, editingTag],
  );

  const clearSelection = useCallback(() => {
    setSelectedCommitId(null);
    setEditingTag(null);
    setSelectedMediaIndex(null);
    setSelectedField(null);
    setSelectedIdentityId(null);
  }, []);

  const selectCommit = useCallback((id: string) => {
    setSelectedCommitId(id);
    setEditingTag(null);
    setSelectedMediaIndex(null);
    setSelectedField(null);
    setSelectedIdentityId(null);
  }, []);

  const selectMedia = useCallback((commitId: string, mediaIndex: number) => {
    setSelectedCommitId(commitId);
    setEditingTag(null);
    setSelectedMediaIndex(mediaIndex);
    setSelectedField(null);
    setSelectedIdentityId(null);
  }, []);

  const selectField = useCallback((commitId: string, field: InspectField) => {
    setSelectedCommitId(commitId);
    setEditingTag(null);
    setSelectedMediaIndex(null);
    setSelectedField(field);
    setSelectedIdentityId(null);
  }, []);

  // Selecting an identity is exclusive with commit/tag selection — it
  // swaps the inspector to the IdentityEditor.
  const selectIdentity = useCallback((id: string) => {
    setSelectedIdentityId(id);
    setSelectedCommitId(null);
    setEditingTag(null);
    setSelectedMediaIndex(null);
    setSelectedField(null);
  }, []);

  const selectTag = useCallback((id: string) => {
    setEditingTag(id);
    setSelectedCommitId(null);
    setSelectedMediaIndex(null);
    setSelectedField(null);
    setSelectedIdentityId(null);
  }, []);

  const handleModeChange = useCallback(
    (next: InspectMode) => {
      if (next === "inspect" && inspectDisabled) return;
      setMode(next);
      if (next === "preview") clearSelection();
    },
    [inspectDisabled, clearSelection],
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${INSPECT_MIN_WIDTH - 1}px)`);
    const syncInspectAvailability = () => setInspectDisabled(query.matches);
    syncInspectAvailability();
    query.addEventListener("change", syncInspectAvailability);
    return () => query.removeEventListener("change", syncInspectAvailability);
  }, []);

  useEffect(() => {
    if (!inspectDisabled || mode !== "inspect") return;
    setMode("preview");
    clearSelection();
  }, [inspectDisabled, mode, clearSelection]);

  // --- Handlers ---

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      setSavedData(data);
      toast.success("Saved to content/log.json");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [data]);

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch("/api/log");
      if (!res.ok) throw new Error("Failed to load");
      const fresh: LogData = await res.json();
      setData(fresh);
      setSavedData(fresh);
      clearSelection();
      toast.success("Reloaded from disk");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }, [clearSelection]);

  const handleUpdateCommit = useCallback(
    (updated: Commit) => {
      setData((prev) => ({
        ...prev,
        commits: prev.commits.map((c) => (c.id === updated.id ? updated : c)),
      }));
    },
    []
  );

  // Per-commit undo: restore the selected commit to its on-disk state
  // without touching other unsaved edits. Complements the dirty-field
  // dots — "I see what I changed, and I can take just this back."
  const handleRevertCommit = useCallback(
    (commitId: string) => {
      const saved = savedData.commits.find((c) => c.id === commitId);
      if (!saved) return;
      setData((prev) => {
        const next = {
          ...prev,
          commits: prev.commits.map((c) => (c.id === commitId ? saved : c)),
        };
        // isDirty is reference equality — if this revert undid the LAST
        // remaining change, snap back to the savedData reference so the
        // "unsaved" chip clears. One JSON pass, only on revert.
        return JSON.stringify(next) === JSON.stringify(savedData)
          ? savedData
          : next;
      });
      setFormEpoch((e) => e + 1);
      toast.success("Commit reverted to saved state");
    },
    [savedData],
  );

  const handleDeleteCommit = useCallback(
    (commitId: string) => {
      setData((prev) => ({
        ...prev,
        commits: prev.commits.filter((c) => c.id !== commitId),
      }));
      if (selectedCommitId === commitId) {
        clearSelection();
      }
    },
    [selectedCommitId, clearSelection]
  );

  const handleAddCommit = useCallback(
    (tagId: string) => {
      if (inspectDisabled) return;
      const id = `new-${Date.now()}`;
      const newCommit: Commit = {
        type: "post",
        id,
        tagId,
        date: new Date().toISOString().slice(0, 7),
        title: { en: "New Entry", zh: "新条目" },
        description: { en: "", zh: "" },
        url: "",
        publication: { name: "" },
        tags: [],
      };
      setData((prev) => ({
        ...prev,
        commits: [...prev.commits, newCommit],
      }));
      setMode("inspect");
      selectCommit(id);
    },
    [inspectDisabled, selectCommit]
  );

  const handleUpdateTag = useCallback(
    (updated: Tag) => {
      setData((prev) => ({
        ...prev,
        tags: prev.tags.map((t) => (t.id === updated.id ? updated : t)),
      }));
    },
    []
  );

  const selectedIdentity = useMemo(
    () =>
      selectedIdentityId
        ? data.identities?.[selectedIdentityId] ?? null
        : null,
    [data.identities, selectedIdentityId],
  );

  // Identity metadata (handle / company / accentColor) lives on the
  // `identities` map — its role ranges are separate commits. Editing
  // here updates the map; denormalizeLogData re-nests on save.
  const handleUpdateIdentity = useCallback(
    (id: string, partial: Partial<Identity>) => {
      setData((prev) => {
        const cur = prev.identities?.[id];
        if (!cur) return prev;
        return {
          ...prev,
          identities: { ...prev.identities, [id]: { ...cur, ...partial } },
        };
      });
    },
    [],
  );

  const handleOpenIdentity = useCallback(() => {
    if (inspectDisabled) return;
    const first = selectedCommit?.type === "role"
      ? (selectedCommit.identityId as string)
      : Object.keys(data.identities ?? {})[0];
    if (!first) return;
    setMode("inspect");
    selectIdentity(first);
  }, [inspectDisabled, data.identities, selectedCommit, selectIdentity]);

  const handleAddTag = useCallback(() => {
    if (inspectDisabled) return;
    const id = `tag-${Date.now()}`;
    const newTag: Tag = {
      id,
      title: { en: "New Tag", zh: "新标签" },
      tagline: { en: "", zh: "" },
      startDate: new Date().toISOString().slice(0, 7),
    };
    setData((prev) => ({
      ...prev,
      tags: [newTag, ...prev.tags],
    }));
    setMode("inspect");
    selectTag(id);
  }, [inspectDisabled, selectTag]);

  const editContext = useMemo(
    () => ({
      mode: effectiveMode,
      selectedCommitId,
      editingTagId: editingTag,
      selectedMediaIndex,
      selectedField,
      selectedIdentityId,
      showHidden,
      onSelectCommit: selectCommit,
      onSelectTag: selectTag,
      onSelectMedia: selectMedia,
      onSelectField: selectField,
      onSelectIdentity: selectIdentity,
      onAddCommit: handleAddCommit,
    }),
    [
      effectiveMode,
      selectedCommitId,
      editingTag,
      selectedMediaIndex,
      selectedField,
      selectedIdentityId,
      showHidden,
      selectCommit,
      selectTag,
      selectMedia,
      selectField,
      selectIdentity,
      handleAddCommit,
    ],
  );

  const handleCanvasClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!inspecting) return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const interactive = target.closest(
        [
          "button",
          "a",
          "input",
          "textarea",
          "select",
          "[role='button']",
          "[data-editor-interactive]",
        ].join(","),
      );
      if (interactive) return;

      clearSelection();
    },
    [inspecting, clearSelection],
  );

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <EditorToolbar
        isDirty={isDirty}
        saving={saving}
        mode={effectiveMode}
        inspectDisabled={inspectDisabled}
        locale={locale}
        onLocaleChange={setLocale}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        onModeChange={handleModeChange}
        onSave={handleSave}
        onReset={handleReset}
        onAddTag={handleAddTag}
        onOpenIdentity={handleOpenIdentity}
      />

      {/* Preview canvas + optional inspector */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-y-auto p-8" onClick={handleCanvasClick}>
          <div className="max-w-2xl mx-auto">
            <TimelineEditProvider value={editContext}>
              {/* identities must flow here just like /works does it —
                  without the map every byline resolves null and the
                  author block falls back to a bare <hux>. */}
              <LogTimeline
                data={previewData}
                locale={locale}
                identities={data.identities}
              />
            </TimelineEditProvider>
            {/* Footer marker, matching works page */}
            <div className="mt-16 flex items-center gap-4">
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
              </div>
              <span className="font-mono text-xs text-muted-foreground/40 tracking-wide">
                {locale === "zh" ? "git init" : "git init"}
              </span>
            </div>
          </div>
        </div>

        {inspecting && (
          <aside className="w-[480px] shrink-0 border-l border-border flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
            {selectedCommit ? (
              <CommitEditor
                commit={selectedCommit}
                formEpoch={formEpoch}
                savedCommit={savedCommit}
                tags={data.tags}
                commits={data.commits}
                identities={data.identities}
                onUpdate={handleUpdateCommit}
                onDelete={() => handleDeleteCommit(selectedCommit.id)}
                onRevert={() => handleRevertCommit(selectedCommit.id)}
                onClose={clearSelection}
                focusMediaIndex={selectedMediaIndex}
                onFocusMediaIndexChange={setSelectedMediaIndex}
                focusField={selectedField}
                onFocusFieldChange={setSelectedField}
              />
            ) : selectedIdentity && selectedIdentityId ? (
              <IdentityEditor
                identityId={selectedIdentityId}
                identity={selectedIdentity}
                identities={data.identities ?? {}}
                commits={data.commits}
                locale={locale}
                onUpdate={(partial) =>
                  handleUpdateIdentity(selectedIdentityId, partial)
                }
                onSelectIdentity={selectIdentity}
                onSelectCommit={selectCommit}
                onClose={clearSelection}
              />
            ) : editingTagObj ? (
              <div className="flex-1 overflow-y-auto">
                <TagEditor
                  tag={editingTagObj}
                  onUpdate={handleUpdateTag}
                  onClose={clearSelection}
                />
              </div>
            ) : (
              <EmptyInspector />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
      <MousePointer2 className="w-6 h-6 text-muted-foreground/30" />
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40">
        Inspect mode
      </div>
      <div className="text-sm text-muted-foreground/60">No selection</div>
    </div>
  );
}
