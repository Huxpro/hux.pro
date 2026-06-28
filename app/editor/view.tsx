"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { LogData, Commit, Tag } from "@/lib/log";
import { buildTimelineData } from "@/lib/log";
import { LogTimeline } from "@/components/log/log-timeline";
import {
  TimelineEditProvider,
  type InspectMode,
} from "@/components/log/timeline-edit-context";
import { useLocale } from "@/services";
import { toast } from "sonner";
import { MousePointer2 } from "lucide-react";
import { EditorToolbar } from "./toolbar";
import { CommitEditor } from "./commit-editor";
import { TagEditor } from "./tag-editor";
import {
  type EditorSelection,
  createCommitSelection,
  createTagSelection,
  isCommitSelection,
  selectionCommitId,
  selectionMediaIndex,
  selectionTagId,
} from "./selection";

interface EditorViewProps {
  initialData: LogData;
}

export function EditorView({ initialData }: EditorViewProps) {
  const [data, setData] = useState<LogData>(initialData);
  const [savedData, setSavedData] = useState<LogData>(initialData);
  const [mode, setMode] = useState<InspectMode>("inspect");
  // One selection at a time — commit (optionally focused on a media item) or
  // tag — modelled as a union so the states can't contradict each other.
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [saving, setSaving] = useState(false);
  const { locale } = useLocale();

  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData);
  const inspecting = mode === "inspect";

  const selectedCommitId = selectionCommitId(selection);
  const selectedTagId = selectionTagId(selection);
  const selectedMediaIndex = selectionMediaIndex(selection);

  // Derive preview data. `includeAll` surfaces every commit — including
  // `listed: false` ones — so unlisted entries stay selectable on the canvas
  // (there's no separate list to reach them from).
  const previewData = useMemo(
    () => buildTimelineData(data, undefined, { includeAll: true }),
    [data]
  );

  const selectedCommit = useMemo(
    () => data.commits.find((c) => c.id === selectedCommitId) ?? null,
    [data.commits, selectedCommitId]
  );

  const editingTagObj = useMemo(
    () => data.tags.find((t) => t.id === selectedTagId) ?? null,
    [data.tags, selectedTagId]
  );

  // --- Selection. Mutual exclusion is structural (the union can only hold
  //     one kind), so each setter is a single assignment. ---

  const selectCommit = useCallback((id: string) => {
    setSelection(createCommitSelection(id));
  }, []);

  const selectMedia = useCallback((commitId: string, mediaIndex: number) => {
    setSelection(createCommitSelection(commitId, mediaIndex));
  }, []);

  const selectTag = useCallback((id: string) => {
    setSelection(createTagSelection(id));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handleModeChange = useCallback(
    (next: InspectMode) => {
      setMode(next);
      // Leaving inspect drops the selection so Preview is a clean public view.
      if (next === "preview") clearSelection();
    },
    [clearSelection]
  );

  // Esc clears the current selection (returns to the empty inspector).
  useEffect(() => {
    if (!inspecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspecting, clearSelection]);

  // --- Mutations ---

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

  const handleUpdateCommit = useCallback((updated: Commit) => {
    setData((prev) => ({
      ...prev,
      commits: prev.commits.map((c) => (c.id === updated.id ? updated : c)),
    }));
  }, []);

  const handleDeleteCommit = useCallback((commitId: string) => {
    setData((prev) => ({
      ...prev,
      commits: prev.commits.filter((c) => c.id !== commitId),
    }));
    // Drop the selection only if it pointed at the deleted commit.
    setSelection((current) =>
      isCommitSelection(current, commitId) ? null : current
    );
  }, []);

  const handleAddCommit = useCallback(
    (tagId: string) => {
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
    [selectCommit]
  );

  const handleUpdateTag = useCallback((updated: Tag) => {
    setData((prev) => ({
      ...prev,
      tags: prev.tags.map((t) => (t.id === updated.id ? updated : t)),
    }));
  }, []);

  const handleAddTag = useCallback(() => {
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
  }, [selectTag]);

  const editContext = useMemo(
    () => ({
      mode,
      selectedCommitId,
      editingTagId: selectedTagId,
      selectedMediaIndex,
      onSelectCommit: selectCommit,
      onSelectTag: selectTag,
      onSelectMedia: selectMedia,
      onAddCommit: handleAddCommit,
    }),
    [
      mode,
      selectedCommitId,
      selectedTagId,
      selectedMediaIndex,
      selectCommit,
      selectTag,
      selectMedia,
      handleAddCommit,
    ]
  );

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <EditorToolbar
        isDirty={isDirty}
        saving={saving}
        mode={mode}
        onModeChange={handleModeChange}
        onSave={handleSave}
        onReset={handleReset}
        onAddTag={handleAddTag}
      />

      {/* Canvas + Inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Preview canvas — selection surface in inspect mode, live public
            render in preview mode. */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <TimelineEditProvider value={editContext}>
              <LogTimeline data={previewData} locale={locale} />
            </TimelineEditProvider>

            {/* Footer marker, matching works page */}
            <div className="mt-16 flex items-center gap-4">
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
              </div>
              <span className="font-mono text-xs text-muted-foreground/40 tracking-wide">
                git init
              </span>
            </div>
          </div>
        </div>

        {/* Inspector — docked whenever inspect mode is on. Shows an empty
            prompt until something on the canvas is selected. */}
        {inspecting && (
          <aside className="w-[480px] shrink-0 border-l border-border flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
            {selectedCommit ? (
              <CommitEditor
                commit={selectedCommit}
                tags={data.tags}
                onUpdate={handleUpdateCommit}
                onDelete={() => handleDeleteCommit(selectedCommit.id)}
                onClose={clearSelection}
                focusMediaIndex={selectedMediaIndex}
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
              <EmptyInspector locale={locale} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function EmptyInspector({ locale }: { locale: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
      <MousePointer2 className="w-6 h-6 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground/60 max-w-[16rem]">
        {locale === "zh"
          ? "在左侧画布点击任意条目、章节或媒体即可在此编辑"
          : "Click an entry, chapter, or media item on the canvas to edit it here"}
      </p>
      <p className="font-mono text-[11px] text-muted-foreground/35 max-w-[16rem]">
        {locale === "zh"
          ? "章节旁的 + 可新增条目 · 切到 Preview 可预览真实效果"
          : "Use + beside a chapter to add · switch to Preview to see the live result"}
      </p>
    </div>
  );
}
