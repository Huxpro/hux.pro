"use client";

import { Check, GalleryVertical, LayoutList, List, MousePointer2, Plus, RotateCcw, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InspectMode } from "@/components/log/timeline-edit-context";
import { Segmented } from "@/components/ui/controls";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { TYPE } from "@/lib/typography";
import { useLabStrings, LabButton, LabChip, LabUnsaved } from "@/systems/lab";
import { cn } from "@/lib/utils";
import { WORKS_STRINGS } from "./strings";

const FORM_CHIP: Record<LogForm, { icon: LucideIcon; label: "formIndex" | "formCovers" | "formFeed" }> = {
  index: { icon: List, label: "formIndex" },
  covers: { icon: LayoutList, label: "formCovers" },
  feed: { icon: GalleryVertical, label: "formFeed" },
};

/**
 * The Works Lab's part of the lab bar. Tools: which form the timeline prints
 * in, for everyone. Actions: the editing (Inspect, a new tag, reload, save),
 * drawn from `lg` only: the inspector needs 480px beside the timeline, and a
 * phone is here to look at the log, not to write it (the lab's info says so).
 */
export function WorksTools({
  form,
  isDirty,
  onFormChange,
}: {
  form: LogForm;
  isDirty: boolean;
  onFormChange: (form: LogForm) => void;
}) {
  const S = useLabStrings(WORKS_STRINGS);
  return (
    <>
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
      <span className={cn(TYPE.meta, "hidden sm:inline")}>{S[FORM_CHIP[form].label]}</span>
      {isDirty && <LabUnsaved />}
    </>
  );
}

export function WorksActions({
  isDirty,
  saving,
  mode,
  inspectDisabled,
  onModeChange,
  onSave,
  onReset,
  onAddTag,
}: {
  isDirty: boolean;
  saving: boolean;
  mode: InspectMode;
  inspectDisabled: boolean;
  onModeChange: (mode: InspectMode) => void;
  onSave: () => void;
  onReset: () => void;
  onAddTag: () => void;
}) {
  const S = useLabStrings(WORKS_STRINGS);
  const inspecting = mode === "inspect";
  return (
    <div className="hidden items-center gap-1 lg:flex">
      <LabChip
        on={inspecting}
        onClick={() => onModeChange(inspecting ? "preview" : "inspect")}
        disabled={inspectDisabled}
        className="mr-1"
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
  );
}
