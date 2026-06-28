"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { LogData, Commit, Tag } from "@/lib/log";
import { buildTimelineData } from "@/lib/log";
import { LogTimeline } from "@/components/log/log-timeline";
import { TimelineEditProvider } from "@/components/log/timeline-edit-context";
import { useLocale } from "@/services";
import { toast } from "sonner";
import { EditorToolbar } from "./toolbar";
import { CommitEditor } from "./commit-editor";
import { TagEditor } from "./tag-editor";

interface EditorViewProps {
  initialData: LogData;
}

export function EditorView({ initialData }: EditorViewProps) {
  const [data, setData] = useState<LogData>(initialData);
  const [savedData, setSavedData] = useState<LogData>(initialData);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { locale } = useLocale();

  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData);

  // Derive preview data. `includeAll` surfaces every commit — including
  // `listed: false` ones — so unlisted entries stay clickable on the canvas
  // now that there's no left-hand list to reach them from.
  const previewData = useMemo(
    () => buildTimelineData(data, undefined, { includeAll: true }),
    [data]
  );

  const selectedCommit = useMemo(
    () => data.commits.find((c) => c.id === selectedCommitId) ?? null,
    [data.commits, selectedCommitId]
  );

  const editingTagObj = useMemo(
    () => data.tags.find((t) => t.id === editingTag) ?? null,
    [data.tags, editingTag]
  );

  const drawerOpen = !!selectedCommit || !!editingTagObj;

  // --- Selection (commit and tag editors are mutually exclusive) ---

  const handleEditCommit = useCallback((id: string) => {
    setSelectedCommitId(id);
    setEditingTag(null);
  }, []);

  const handleEditTag = useCallback((id: string) => {
    setEditingTag(id);
    setSelectedCommitId(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedCommitId(null);
    setEditingTag(null);
  }, []);

  // Esc closes the editor drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

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
      setSelectedCommitId(null);
      setEditingTag(null);
      toast.success("Reloaded from disk");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }, []);

  const handleUpdateCommit = useCallback((updated: Commit) => {
    setData((prev) => ({
      ...prev,
      commits: prev.commits.map((c) => (c.id === updated.id ? updated : c)),
    }));
  }, []);

  const handleDeleteCommit = useCallback(
    (commitId: string) => {
      setData((prev) => ({
        ...prev,
        commits: prev.commits.filter((c) => c.id !== commitId),
      }));
      if (selectedCommitId === commitId) {
        setSelectedCommitId(null);
      }
    },
    [selectedCommitId]
  );

  const handleAddCommit = useCallback((tagId: string) => {
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
    setSelectedCommitId(id);
    setEditingTag(null);
  }, []);

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
    setEditingTag(id);
    setSelectedCommitId(null);
  }, []);

  const editContext = useMemo(
    () => ({
      selectedCommitId,
      editingTagId: editingTag,
      onEditCommit: handleEditCommit,
      onEditTag: handleEditTag,
      onAddCommit: handleAddCommit,
    }),
    [selectedCommitId, editingTag, handleEditCommit, handleEditTag, handleAddCommit]
  );

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <EditorToolbar
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        onAddTag={handleAddTag}
      />

      {/* Canvas + editor drawer */}
      <div className="flex-1 flex min-h-0">
        {/* Preview canvas — the only way to pick what to edit. */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {/* Hint: with no list, clicking the canvas is the way in. */}
            <p className="mb-6 font-mono text-[11px] text-muted-foreground/40">
              {locale === "zh"
                ? "点击任意条目或章节即可编辑 · 章节旁的 + 可新增条目"
                : "Click any entry or chapter to edit · use + beside a chapter to add"}
            </p>

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

        {/* Editor drawer — docked right, slides in when something is selected. */}
        {drawerOpen && (
          <aside className="w-[480px] shrink-0 border-l border-border flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
            {selectedCommit ? (
              <CommitEditor
                commit={selectedCommit}
                tags={data.tags}
                onUpdate={handleUpdateCommit}
                onDelete={() => handleDeleteCommit(selectedCommit.id)}
                onBack={closeDrawer}
              />
            ) : editingTagObj ? (
              <div className="flex-1 overflow-y-auto">
                <TagEditor
                  tag={editingTagObj}
                  onUpdate={handleUpdateTag}
                  onClose={closeDrawer}
                />
              </div>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}
