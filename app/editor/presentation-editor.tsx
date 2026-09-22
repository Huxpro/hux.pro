"use client";

/**
 * The inspector for a presentation: the fold, and the switch that
 * turns it off. Members stay commits — this edits the view, and the
 * canvas beside it is /works, so the switch is the whole point.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Commit, LocalizedString, Presentation, PresentationSlot } from "@/lib/log";
import { localize } from "@/lib/log";
import {
  presentationHeading,
  presentationWarnings,
  type PresentationWarning,
} from "@/lib/presentation";
import { useLocale } from "@/services";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors";
  return (
    <label className="flex items-start gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right pt-1.5">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(cls, "resize-y")}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

function localized(value: LocalizedString | undefined, key: "en" | "zh"): string {
  return value?.[key] ?? "";
}

function setLocalized(
  value: LocalizedString | undefined,
  key: "en" | "zh",
  next: string,
): LocalizedString | undefined {
  const en = key === "en" ? next : value?.en ?? "";
  const zh = key === "zh" ? next : value?.zh ?? "";
  if (!en && !zh) return undefined;
  return { en, zh };
}

function commitSlot(slot: PresentationSlot): slot is PresentationSlot & { commitId: string } {
  return typeof slot.commitId === "string";
}

interface PresentationEditorProps {
  presentation: Presentation;
  presentations: Presentation[];
  commits: Commit[];
  warnings: PresentationWarning[];
  onUpdate: (presentation: Presentation) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PresentationEditor({
  presentation,
  presentations,
  commits,
  warnings,
  onUpdate,
  onDelete,
  onClose,
}: PresentationEditorProps) {
  const { locale } = useLocale();
  const enabled = presentation.enabled !== false;
  const mine = warnings.filter((w) => w.presentationId === presentation.id);

  const commitOptions = useMemo(
    () =>
      commits
        .filter((c) => c.type !== "role")
        .map((c) => ({
          id: c.id,
          label: `${c.date}  ${localize(c.title, locale)}`,
        })),
    [commits, locale],
  );

  const otherPresentations = presentations.filter((p) => p.id !== presentation.id);

  const patch = (partial: Partial<Presentation>) =>
    onUpdate({ ...presentation, ...partial });

  const setMember = (index: number, slot: PresentationSlot) => {
    const members = presentation.members.map((m, i) => (i === index ? slot : m));
    patch({ members });
  };

  const removeMember = (index: number) => {
    patch({ members: presentation.members.filter((_, i) => i !== index) });
  };

  const moveMember = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= presentation.members.length) return;
    const members = [...presentation.members];
    const [slot] = members.splice(index, 1);
    members.splice(next, 0, slot);
    patch({ members });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-background/90 backdrop-blur">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground">
            Presentation
          </div>
          <div className="text-sm truncate">
            {presentationHeading(presentation, commits, locale)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-tertiary-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
            Fold
          </span>
          <button
            type="button"
            onClick={() => patch({ enabled: !enabled })}
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors",
              enabled
                ? "border-foreground/40 text-foreground"
                : "border-border text-tertiary-foreground",
            )}
          >
            {enabled ? "On — one row" : "Off — each commit"}
          </button>
        </label>

        <Field
          label="Id"
          value={presentation.id}
          onChange={(id) => patch({ id })}
        />

        <Field
          label="Title EN"
          value={localized(presentation.title, "en")}
          onChange={(en) => patch({ title: setLocalized(presentation.title, "en", en) })}
          placeholder="Borrow a venue, or the anchor"
        />
        <Field
          label="Title ZH"
          value={localized(presentation.title, "zh")}
          onChange={(zh) => patch({ title: setLocalized(presentation.title, "zh", zh) })}
          placeholder="空着则沿用会场或锚点"
        />
        <Field
          label="About EN"
          value={localized(presentation.description, "en")}
          onChange={(en) =>
            patch({ description: setLocalized(presentation.description, "en", en) })
          }
          placeholder="The sentence this row says. Optional."
          multiline
        />
        <Field
          label="About ZH"
          value={localized(presentation.description, "zh")}
          onChange={(zh) =>
            patch({ description: setLocalized(presentation.description, "zh", zh) })
          }
          placeholder="这一行要说的那句话。可空。"
          multiline
        />

        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
            Anchor
          </span>
          <select
            value={presentation.anchor ?? ""}
            onChange={(e) => patch({ anchor: e.target.value || undefined })}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm"
          >
            <option value="">Latest member</option>
            {commitOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
            Members
          </div>
          {presentation.members.map((slot, index) => (
            <div key={index} className="border border-border/40 rounded p-2 space-y-2">
              {commitSlot(slot) ? (
                <select
                  value={slot.commitId}
                  onChange={(e) =>
                    setMember(index, { ...slot, commitId: e.target.value })
                  }
                  className="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-sm"
                >
                  {commitOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={slot.presentationId}
                  onChange={(e) =>
                    setMember(index, { ...slot, presentationId: e.target.value })
                  }
                  className="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-sm"
                >
                  {otherPresentations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}
                    </option>
                  ))}
                </select>
              )}
              <Field
                label="Note EN"
                value={localized(slot.caption, "en")}
                onChange={(en) =>
                  setMember(index, { ...slot, caption: setLocalized(slot.caption, "en", en) })
                }
                placeholder="中文版, the earlier telling…"
              />
              <Field
                label="Note ZH"
                value={localized(slot.caption, "zh")}
                onChange={(zh) =>
                  setMember(index, { ...slot, caption: setLocalized(slot.caption, "zh", zh) })
                }
                placeholder="这一位在这一行里是什么"
              />
              <div className="flex items-center gap-2 pl-[5.5rem]">
                <button
                  type="button"
                  onClick={() => moveMember(index, -1)}
                  className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveMember(index, 1)}
                  className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="ml-auto text-tertiary-foreground hover:text-foreground"
                  aria-label="Remove member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const first = commitOptions[0];
                if (!first) return;
                patch({
                  members: [...presentation.members, { commitId: first.id }],
                });
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground"
            >
              <Plus className="w-3 h-3" /> Commit
            </button>
            <button
              type="button"
              disabled={otherPresentations.length === 0}
              onClick={() => {
                const first = otherPresentations[0];
                if (!first) return;
                patch({
                  members: [
                    ...presentation.members,
                    { presentationId: first.id },
                  ],
                });
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Presentation
            </button>
          </div>
        </div>

        {mine.length > 0 && (
          <div className="space-y-1">
            {mine.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-tertiary-foreground">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete presentation
        </button>
      </div>
    </div>
  );
}

export function presentationLabel(
  presentation: Presentation,
  commits: Commit[],
  locale: "en" | "zh",
): string {
  return presentationHeading(presentation, commits, locale);
}

export function PresentationList({
  presentations,
  commits,
  onToggle,
  onSelect,
  onCreate,
}: {
  presentations: Presentation[];
  commits: Commit[];
  onToggle: (presentation: Presentation) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { locale } = useLocale();
  const warnings = useMemo(
    () => presentationWarnings(presentations, commits),
    [presentations, commits],
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground">
        Presentations
      </div>
      <p className="text-xs text-tertiary-foreground leading-relaxed">
        A presentation folds commits into one row on /works. The commits stay
        commits — a widget or a post still renders each one alone. Off, and the
        timeline prints them separately again.
      </p>
      {presentations.length === 0 && (
        <div className="text-sm text-tertiary-foreground">None yet.</div>
      )}
      <div className="space-y-1">
        {presentations.map((p) => {
          const on = p.enabled !== false;
          const warned = warnings.some((w) => w.presentationId === p.id);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggle(p)}
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wider w-10 shrink-0 py-1 rounded border",
                  on
                    ? "border-foreground/40 text-foreground"
                    : "border-border text-tertiary-foreground",
                )}
              >
                {on ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="min-w-0 flex-1 text-left text-sm truncate hover:text-foreground text-foreground/80"
              >
                {presentationLabel(p, commits, locale)}
                {warned && (
                  <AlertTriangle className="inline w-3 h-3 ml-1 text-tertiary-foreground" />
                )}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground hover:text-foreground"
      >
        <Plus className="w-3 h-3" /> New presentation
      </button>
    </div>
  );
}
