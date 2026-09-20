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
  type InspectMode,
} from "@/components/log/timeline-edit-context";
import { t, useLocale } from "@/services";
import { DEFAULT_FORM, formOpensRows, type LogForm } from "@/lib/log-view";
import { toast } from "sonner";
import { MousePointer2 } from "lucide-react";
import { EditorToolbar } from "./toolbar";
import { CommitEditor } from "./commit-editor";
import { TagEditor } from "./tag-editor";

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
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null,
  );
  const [inspectDisabled, setInspectDisabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LogForm>(DEFAULT_FORM);
  const { locale } = useLocale();

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
  const previewData = useMemo(
    () =>
      buildTimelineData(
        enrichLogDataWithPreviews(data, ogSnapshot),
        inspecting ? undefined : locale,
        inspecting ? { includeAll: true } : undefined,
      ),
    [data, inspecting, locale],
  );

  const selectedCommit = useMemo(
    () => data.commits.find((c) => c.id === selectedCommitId) ?? null,
    [data.commits, selectedCommitId]
  );

  const editingTagObj = useMemo(
    () => data.tags.find((t) => t.id === editingTag) ?? null,
    [data.tags, editingTag],
  );

  const clearSelection = useCallback(() => {
    setSelectedCommitId(null);
    setEditingTag(null);
    setSelectedMediaIndex(null);
  }, []);

  const selectCommit = useCallback((id: string) => {
    setSelectedCommitId(id);
    setEditingTag(null);
    setSelectedMediaIndex(null);
  }, []);

  const selectMedia = useCallback((commitId: string, mediaIndex: number) => {
    setSelectedCommitId(commitId);
    setEditingTag(null);
    setSelectedMediaIndex(mediaIndex);
  }, []);

  const selectTag = useCallback((id: string) => {
    setEditingTag(id);
    setSelectedCommitId(null);
    setSelectedMediaIndex(null);
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
      onSelectCommit: selectCommit,
      onSelectTag: selectTag,
      onSelectMedia: selectMedia,
      onAddCommit: handleAddCommit,
    }),
    [
      effectiveMode,
      selectedCommitId,
      editingTag,
      selectedMediaIndex,
      selectCommit,
      selectTag,
      selectMedia,
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
        form={form}
        onFormChange={setForm}
        onModeChange={handleModeChange}
        onSave={handleSave}
        onReset={handleReset}
        onAddTag={handleAddTag}
      />

      {/* Preview canvas + optional inspector. The column is /works'
          (`--page-col` / `--page-gutter`); the extra left pad on `lg`
          is the gutter the row pulls into (`GUTTER_PULL`), so the hash
          and the rail hang in a real margin instead of clipping. */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-y-auto" onClick={handleCanvasClick}>
          <div className="mx-auto w-full max-w-[calc(var(--page-col)+6.5rem)] px-[var(--page-gutter)] py-8 lg:pl-[calc(var(--page-gutter)+6.5rem)]">
            <TimelineEditProvider value={editContext}>
              <LogTimeline
                data={previewData}
                locale={locale}
                identities={data.identities}
                form={form}
                expandAll={formOpensRows(form)}
              />
            </TimelineEditProvider>
            <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
              {t(locale, "logInit")}
            </div>
          </div>
        </div>

        {inspecting && (
          <aside className="w-[480px] shrink-0 border-l border-border flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
            {selectedCommit ? (
              <CommitEditor
                commit={selectedCommit}
                tags={data.tags}
                commits={data.commits}
                identities={data.identities ?? {}}
                onUpdate={handleUpdateCommit}
                onDelete={() => handleDeleteCommit(selectedCommit.id)}
                onClose={clearSelection}
                focusMediaIndex={selectedMediaIndex}
                onFocusMediaIndexChange={setSelectedMediaIndex}
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
      <MousePointer2 className="w-6 h-6 text-quaternary-foreground" />
      <div className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground">
        Inspect mode
      </div>
      <div className="text-sm text-tertiary-foreground">No selection</div>
    </div>
  );
}
