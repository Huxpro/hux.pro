"use client";

import { Save, RotateCcw, Plus } from "lucide-react";

interface EditorToolbarProps {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  onAddTag: () => void;
}

export function EditorToolbar({
  isDirty,
  saving,
  onSave,
  onReset,
  onAddTag,
}: EditorToolbarProps) {
  return (
    <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium tracking-wide">
          log.json
        </span>
        {isDirty && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
            unsaved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAddTag}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Tag
        </button>

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>

        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-foreground text-background hover:bg-foreground/90"
        >
          <Save className="w-3 h-3" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
