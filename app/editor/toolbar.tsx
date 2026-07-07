"use client";

import {
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectMode } from "@/components/log/timeline-edit-context";
import type { Locale } from "@/lib/i18n";
import { EditorSurfaceNav } from "./surface-nav";

interface EditorToolbarProps {
  isDirty: boolean;
  saving: boolean;
  mode: InspectMode;
  inspectDisabled: boolean;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  /** Inspect-mode flag: reveal hidden/unlisted rows as annotated ghosts. */
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  onModeChange: (mode: InspectMode) => void;
  onSave: () => void;
  onReset: () => void;
  onAddTag: () => void;
  /** Open the IdentityEditor (identities are the non-commit data layer). */
  onOpenIdentity: () => void;
}

export function EditorToolbar({
  isDirty,
  saving,
  mode,
  inspectDisabled,
  locale,
  onLocaleChange,
  showHidden,
  onShowHiddenChange,
  onModeChange,
  onSave,
  onReset,
  onAddTag,
  onOpenIdentity,
}: EditorToolbarProps) {
  const inspecting = mode === "inspect";

  return (
    <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/5">
      <div className="flex items-center gap-3">
        <EditorSurfaceNav current="log" />
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
      </div>

      <div className="flex items-center gap-2">
        {/* Hidden-content switch — inspect-only. On: unlisted commits,
            locale-scoped rows and hidden roles render as annotated
            ghosts. Off: the canvas is exactly the public /works. */}
        {inspecting && (
          <button
            type="button"
            onClick={() => onShowHiddenChange(!showHidden)}
            aria-pressed={showHidden}
            title={
              showHidden
                ? "Showing hidden rows (unlisted / hidden roles) — click to preview as production"
                : "Hidden rows are excluded, matching production — click to reveal them"
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors",
              showHidden
                ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/20",
            )}
          >
            {showHidden ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            Hidden
          </button>
        )}

        {/* Preview-locale switch — flip the canvas between EN and 中文 so
            editing a ZH field shows its effect without leaving the editor.
            Same locale service the site nav uses; the choice persists. */}
        <div
          className="flex border border-border/60 rounded overflow-hidden"
          role="group"
          aria-label="Preview locale"
        >
          {(["en", "zh"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLocaleChange(l)}
              className={cn(
                "px-2.5 py-1 text-xs font-mono transition-colors",
                locale === l
                  ? "bg-muted/40 text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              {l === "en" ? "EN" : "中文"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenIdentity}
          disabled={inspectDisabled}
          title={
            inspectDisabled
              ? "Identity editor is disabled on small screens"
              : "Inspect identities — the non-commit data layer (handle / company / tenures)"
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Fingerprint className="w-3 h-3" />
          Identity
        </button>

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
