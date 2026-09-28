"use client";

import { Check, GalleryVertical, LayoutList, List, MousePointer2, Plus, RotateCcw, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InspectMode } from "@/components/log/timeline-edit-context";
import { Segmented } from "@/components/ui/controls";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { TYPE } from "@/lib/typography";
import { LabButton, LabChip, LabToolbar, LabUnsaved } from "../shell";

const FORM_CHIP: Record<LogForm, { icon: LucideIcon; label: string }> = {
  index: { icon: List, label: "index" },
  covers: { icon: LayoutList, label: "covers" },
  feed: { icon: GalleryVertical, label: "feed" },
};

interface WorksToolbarProps {
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

/**
 * The Works Lab's strip: which form the timeline prints in, for everyone;
 * and, on a screen wide enough to hold the inspector beside it, the editing —
 * Inspect, a new tag, reload, save. Below `lg` the editing is not drawn at
 * all: the inspector needs 480px beside the timeline, and a phone is here to
 * look at the log, not to write it.
 */
export function WorksToolbar({
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
}: WorksToolbarProps) {
  const inspecting = mode === "inspect";

  return (
    <LabToolbar className="justify-between">
      <div className="flex flex-wrap items-center gap-3">
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
        <span className={TYPE.meta}>{FORM_CHIP[form].label}</span>
        {isDirty && <LabUnsaved />}
      </div>

      <span className={`${TYPE.rowMeta} lg:hidden`}>editing needs a wide screen</span>

      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        <LabChip
          on={inspecting}
          onClick={() => onModeChange(inspecting ? "preview" : "inspect")}
          disabled={inspectDisabled}
        >
          {inspecting ? <Check /> : <MousePointer2 />}
          {inspecting ? "Done" : "Inspect"}
        </LabChip>
        <LabButton onClick={onAddTag} disabled={inspectDisabled}>
          <Plus />
          Tag
        </LabButton>
        <LabButton onClick={onReset}>
          <RotateCcw />
          Reset
        </LabButton>
        <LabButton tone="primary" onClick={onSave} disabled={!isDirty || saving}>
          <Save />
          {saving ? "Saving..." : "Save"}
        </LabButton>
      </div>
    </LabToolbar>
  );
}
