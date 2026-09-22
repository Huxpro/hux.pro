"use client";

import { Check, GalleryVertical, LayoutList, List, MousePointer2, Plus, RotateCcw, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectMode } from "@/components/log/timeline-edit-context";
import { Segmented } from "@/components/ui/controls";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { EditorNav } from "./nav";

const FORM_CHIP: Record<LogForm, { icon: LucideIcon; label: string }> = {
  index: { icon: List, label: "index" },
  covers: { icon: LayoutList, label: "covers" },
  feed: { icon: GalleryVertical, label: "feed" },
};

interface EditorToolbarProps {
  isDirty: boolean;
  saving: boolean;
  mode: InspectMode;
  inspectDisabled: boolean;
  form: LogForm;
  onFormChange: (form: LogForm) => void;
  onModeChange: (mode: InspectMode) => void;
  onSave: () => void;
  onReset: () => void;
  onAddTag: () => void;
}

export function EditorToolbar({
  isDirty,
  saving,
  mode,
  inspectDisabled,
  form,
  onFormChange,
  onModeChange,
  onSave,
  onReset,
  onAddTag,
}: EditorToolbarProps) {
  const inspecting = mode === "inspect";

  return (
    <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/5">
      <div className="flex items-center gap-3">
        <EditorNav />
        {isDirty && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
            unsaved
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange("inspect")}
            disabled={inspecting || inspectDisabled}
            title={
              inspectDisabled
                ? "Inspect mode is disabled on small screens"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors disabled:cursor-default disabled:opacity-45",
              inspecting
                ? "border-foreground/30 bg-foreground text-background"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/20",
            )}
          >
            <MousePointer2 className="w-3 h-3" />
            {inspecting ? "Inspecting" : "Inspect"}
          </button>
          {inspecting && (
            <button
              type="button"
              onClick={() => onModeChange("preview")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <Check className="w-3 h-3" />
              Done
            </button>
          )}
        </div>
        <Segmented
          tone="bare"
          value={form}
          onChange={onFormChange}
          options={LOG_FORMS.map((id) => {
            const { icon: Icon, label } = FORM_CHIP[id];
            return {
              value: id,
              label: <Icon className="h-3.5 w-3.5" />,
              title: label,
              ariaLabel: label,
            };
          })}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddTag}
          disabled={inspectDisabled}
          title={
            inspectDisabled
              ? "Adding tags is disabled on small screens"
              : undefined
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Tag
        </button>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>

        <button
          type="button"
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
