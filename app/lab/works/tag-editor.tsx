"use client";

import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/log";
import { Tag as TagIcon, X } from "lucide-react";

interface TagEditorProps {
  tag: Tag;
  onUpdate: (tag: Tag) => void;
  onClose: () => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  dimmed,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dimmed?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-2", dimmed && "opacity-40")}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
      />
    </label>
  );
}

export function TagEditor({ tag, onUpdate, onClose }: TagEditorProps) {
  const update = (partial: Partial<Tag>) => {
    onUpdate({ ...tag, ...partial });
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 -mx-3 -mt-3 px-3 py-2 mb-1 border-b border-border">
        <div className="min-w-0 flex items-center gap-2">
          <TagIcon className="w-3.5 h-3.5 shrink-0 text-tertiary-foreground" />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
              chapter
            </div>
            <div className="text-sm truncate leading-tight">
              {tag.title.en || tag.id}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-tertiary-foreground hover:text-foreground rounded transition-colors shrink-0"
          title="Close inspector"
          aria-label="Close inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Field label="ID" value={tag.id} onChange={(v) => update({ id: v })} />
      <Field
        label="Title EN"
        value={tag.title.en}
        onChange={(v) => update({ title: { ...tag.title, en: v } })}
      />
      <Field
        label="Title ZH"
        value={tag.title.zh}
        onChange={(v) => update({ title: { ...tag.title, zh: v } })}
      />
      <Field
        label="Tagline EN"
        value={tag.tagline.en}
        onChange={(v) => update({ tagline: { ...tag.tagline, en: v } })}
      />
      <Field
        label="Tagline ZH"
        value={tag.tagline.zh}
        onChange={(v) => update({ tagline: { ...tag.tagline, zh: v } })}
      />
      <Field
        label="Start"
        value={tag.startDate}
        onChange={(v) => update({ startDate: v })}
        placeholder="YYYY-MM"
      />
      <Field
        label="End"
        value={tag.endDate ?? ""}
        onChange={(v) => update({ endDate: v || undefined })}
        placeholder="YYYY-MM or empty"
      />

      {/* Fields not yet rendered in /works */}
      <Field
        label="Color"
        value={tag.accentColor ?? ""}
        onChange={(v) => update({ accentColor: v || undefined })}
        placeholder="oklch(...)"
        dimmed
      />
      <Field
        label="Narr. EN"
        value={tag.narrative?.en ?? ""}
        onChange={(v) =>
          update({
            narrative: v || tag.narrative?.zh
              ? { en: v, zh: tag.narrative?.zh ?? "" }
              : undefined,
          })
        }
        placeholder="Not rendered yet"
        dimmed
      />
      <Field
        label="Narr. ZH"
        value={tag.narrative?.zh ?? ""}
        onChange={(v) =>
          update({
            narrative: v || tag.narrative?.en
              ? { en: tag.narrative?.en ?? "", zh: v }
              : undefined,
          })
        }
        placeholder="Not rendered yet"
        dimmed
      />
      <Field
        label="Keywords EN"
        value={tag.keywords?.en ?? ""}
        onChange={(v) =>
          update({
            keywords: v || tag.keywords?.zh
              ? { en: v, zh: tag.keywords?.zh ?? "" }
              : undefined,
          })
        }
        placeholder="Not rendered yet"
        dimmed
      />
      <Field
        label="Keywords ZH"
        value={tag.keywords?.zh ?? ""}
        onChange={(v) =>
          update({
            keywords: v || tag.keywords?.en
              ? { en: tag.keywords?.en ?? "", zh: v }
              : undefined,
          })
        }
        placeholder="Not rendered yet"
        dimmed
      />
    </div>
  );
}
