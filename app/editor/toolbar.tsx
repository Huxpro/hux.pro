"use client";

import { Save, RotateCcw, Plus, MousePointer2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectMode } from "@/components/log/timeline-edit-context";

interface EditorToolbarProps {
  isDirty: boolean;
  saving: boolean;
  mode: InspectMode;
  onModeChange: (mode: InspectMode) => void;
  onSave: () => void;
  onReset: () => void;
  onAddTag: () => void;
}

export function EditorToolbar({
  isDirty,
  saving,
  mode,
  onModeChange,
  onSave,
  onReset,
  onAddTag,
}: EditorToolbarProps) {
  return (
    <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium tracking-wide">
          log.json
        </span>
        {isDirty && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
            unsaved
          </span>
        )}

        {/* Mode toggle — the formal way to enter/leave the selection surface.
            Inspect = click anything on the canvas to edit it; Preview = the
            canvas behaves exactly like the live public site. Kept in the left
            group so it never collides with the centered ambient widgets. */}
        <div
          className="ml-1 flex items-center border border-border/60 rounded-md overflow-hidden"
          role="radiogroup"
          aria-label="Canvas mode"
        >
          <ModeButton
            active={mode === "inspect"}
            onClick={() => onModeChange("inspect")}
            icon={<MousePointer2 className="w-3 h-3" />}
            label="Inspect"
          />
          <ModeButton
            active={mode === "preview"}
            onClick={() => onModeChange("preview")}
            icon={<Eye className="w-3 h-3" />}
            label="Preview"
          />
        </div>
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

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/20",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
