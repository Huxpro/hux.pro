"use client";

import { useState, useMemo, useCallback } from "react";
import type { LogData, Commit, Tag } from "@/lib/log";
import { buildTimelineData } from "@/lib/log";
import { LogTimeline } from "@/components/log/log-timeline";
import { useLocale } from "@/services";
import { toast } from "sonner";
import { EditorToolbar } from "./toolbar";
import { CommitList } from "./commit-list";
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

  // Derive preview data — same function used by /works
  const previewData = useMemo(() => buildTimelineData(data), [data]);

  const selectedCommit = useMemo(
    () => data.commits.find((c) => c.id === selectedCommitId) ?? null,
    [data.commits, selectedCommitId]
  );

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
      setSelectedCommitId(null);
      setEditingTag(null);
      toast.success("Reloaded from disk");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }, []);

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
        setSelectedCommitId(null);
      }
    },
    [selectedCommitId]
  );

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
      setSelectedCommitId(id);
    },
    []
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
  }, []);

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

      {/* Split pane */}
      <div className="flex-1 flex min-h-0">
        {/* Editor panel */}
        <div className="w-[480px] shrink-0 border-r border-border flex flex-col min-h-0">
          {/* Tag editing */}
          {editingTag && (
            <div className="border-b border-border">
              <TagEditor
                tag={data.tags.find((t) => t.id === editingTag)!}
                onUpdate={handleUpdateTag}
                onClose={() => setEditingTag(null)}
              />
            </div>
          )}

          {/* Commit list + editor */}
          {selectedCommit ? (
            <CommitEditor
              commit={selectedCommit}
              tags={data.tags}
              onUpdate={handleUpdateCommit}
              onDelete={() => handleDeleteCommit(selectedCommit.id)}
              onBack={() => setSelectedCommitId(null)}
            />
          ) : (
            <CommitList
              data={data}
              locale={locale}
              selectedId={selectedCommitId}
              onSelect={setSelectedCommitId}
              onAddCommit={handleAddCommit}
              onEditTag={setEditingTag}
            />
          )}
        </div>

        {/* Preview panel */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <LogTimeline data={previewData} locale={locale} />
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
      </div>
    </div>
  );
}
