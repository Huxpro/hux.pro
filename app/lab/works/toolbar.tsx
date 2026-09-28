"use client";

import { Check, GalleryVertical, LayoutList, List, MousePointer2, Plus, RotateCcw, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InspectMode } from "@/components/log/timeline-edit-context";
import { Segmented } from "@/components/ui/controls";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { TYPE } from "@/lib/typography";
import { useLabStrings } from "@/app/lab/i18n";
import { LabButton, LabChip, LabToolbar, LabUnsaved } from "../shell";
import { WORKS_STRINGS } from "./strings";

const FORM_CHIP: Record<LogForm, { icon: LucideIcon; label: "formIndex" | "formCovers" | "formFeed" }> = {
  index: { icon: List, label: "formIndex" },
  covers: { icon: LayoutList, label: "formCovers" },
  feed: { icon: GalleryVertical, label: "formFeed" },
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
  const S = useLabStrings(WORKS_STRINGS);
  const inspecting = mode === "inspect";

  return (
    <LabToolbar className="justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          tone="bare"
          value={form}
          onChange={onFormChange}
          options={LOG_FORMS.map((id) => {
            const { icon: Icon, label: key } = FORM_CHIP[id];
            const label = S[key];
            return {
              value: id,
              label: <Icon className="h-3.5 w-3.5" />,
              title: label,
              ariaLabel: label,
            };
          })}
        />
        <span className={TYPE.meta}>{S[FORM_CHIP[form].label]}</span>
        {isDirty && <LabUnsaved />}
      </div>

      <span className={`${TYPE.rowMeta} lg:hidden`}>{S.needsWideScreen}</span>

      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        <LabChip
          on={inspecting}
          onClick={() => onModeChange(inspecting ? "preview" : "inspect")}
          disabled={inspectDisabled}
        >
          {inspecting ? <Check /> : <MousePointer2 />}
          {inspecting ? S.done : S.inspect}
        </LabChip>
        <LabButton onClick={onAddTag} disabled={inspectDisabled}>
          <Plus />
          {S.addTag}
        </LabButton>
        <LabButton onClick={onReset}>
          <RotateCcw />
          {S.reset}
        </LabButton>
        <LabButton tone="primary" onClick={onSave} disabled={!isDirty || saving}>
          <Save />
          {saving ? S.saving : S.save}
        </LabButton>
      </div>
    </LabToolbar>
  );
}
