"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Commit, CommitType, Tag, Media, MediaType } from "@/lib/log";
import { X, Trash2, Plus } from "lucide-react";
import { commitIcons } from "@/components/log/icons";
import { toast } from "sonner";

interface CommitEditorProps {
  commit: Commit;
  tags: Tag[];
  onUpdate: (commit: Commit) => void;
  onDelete: () => void;
  onClose: () => void;
  /** When set, scroll to and highlight this media item (media-level inspect). */
  focusMediaIndex?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared field components
// ─────────────────────────────────────────────────────────────────────────────

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
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right pt-1.5">
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40 pt-2">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// String-list section — repeatable add/remove rows for a string[] field,
// styled to match the Media section so plural fields feel consistent.
// ─────────────────────────────────────────────────────────────────────────────

function StringListSection({
  label,
  items,
  onChange,
  placeholder,
  addTitle,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addTitle?: string;
}) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const deleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <button
          onClick={addItem}
          className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors"
          title={addTitle ?? `Add ${label.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {items.length === 0 && (
        <div className="text-xs text-muted-foreground/40 font-mono pl-[88px]">
          No {label.toLowerCase()}
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 pl-[88px]">
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
          />
          <button
            onClick={() => deleteItem(i)}
            className="p-0.5 text-muted-foreground/30 hover:text-red-500 rounded transition-colors"
            title={`Remove ${label.toLowerCase()}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific field defaults for when changing commit type
// ─────────────────────────────────────────────────────────────────────────────

function defaultFieldsForType(type: CommitType): Partial<Commit> {
  switch (type) {
    case "project":
      return {};
    case "talk":
      return { conference: { name: "" } };
    case "post":
      return { url: "", publication: { name: "" } };
    case "role":
      return {
        company: { en: "", zh: "" },
      };
    case "social":
      return { platform: "" };
    case "event":
      return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

export function CommitEditor({
  commit,
  tags,
  onUpdate,
  onDelete,
  onClose,
  focusMediaIndex = null,
}: CommitEditorProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(commit, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Media-level inspection always lands on the form (the JSON blob can't be
  // scrolled to a single media item meaningfully).
  useEffect(() => {
    if (focusMediaIndex != null) setTab("form");
  }, [focusMediaIndex]);

  const TypeIcon = commitIcons[commit.type];

  // Sync JSON text when switching to JSON tab or when commit changes externally
  const switchToJson = () => {
    setJsonText(JSON.stringify(commit, null, 2));
    setJsonError(null);
    setTab("json");
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.id || !parsed.type || !parsed.tagId) {
        throw new Error("Missing required fields: id, type, tagId");
      }
      onUpdate(parsed as Commit);
      setJsonError(null);
      setTab("form");
      toast.success("JSON applied");
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const update = (partial: Record<string, unknown>) => {
    onUpdate({ ...commit, ...partial } as Commit);
  };

  const handleTypeChange = (newType: CommitType) => {
    const base = {
      id: commit.id,
      tagId: commit.tagId,
      date: commit.date,
      endDate: commit.endDate,
      title: commit.title,
      description: commit.description,
      commentary: commit.commentary,
      tags: commit.tags,
      listed: commit.listed,
    };
    onUpdate({
      ...base,
      type: newType,
      ...defaultFieldsForType(newType),
    } as Commit);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Inspector header — identifies the selection; × deselects (stays in
          inspect mode). Leaving inspect entirely is the toolbar toggle. */}
      <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <TypeIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
              {commit.type}
            </div>
            <div className="text-sm truncate leading-tight">
              {commit.title.en || commit.id}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex border border-border/50 rounded overflow-hidden">
            <button
              onClick={() => setTab("form")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                tab === "form"
                  ? "bg-muted/30 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              Form
            </button>
            <button
              onClick={switchToJson}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                tab === "json"
                  ? "bg-muted/30 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              JSON
            </button>
          </div>
          <button
            onClick={onDelete}
            className="p-1 text-muted-foreground/40 hover:text-red-500 rounded transition-colors"
            title="Delete commit"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground/50 hover:text-foreground rounded transition-colors"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === "json" ? (
          <div className="space-y-2">
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError(null);
              }}
              className="w-full h-[60vh] bg-transparent border border-border/50 rounded p-2 font-mono text-xs resize-y focus:outline-none focus:border-foreground/30"
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-500 font-mono">{jsonError}</p>
            )}
            <button
              onClick={applyJson}
              className="px-3 py-1.5 text-xs font-mono bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
            >
              Apply JSON
            </button>
          </div>
        ) : (
          <FormFields
            commit={commit}
            tags={tags}
            onUpdate={update}
            onTypeChange={handleTypeChange}
            focusMediaIndex={focusMediaIndex}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form fields
// ─────────────────────────────────────────────────────────────────────────────

function FormFields({
  commit,
  tags,
  onUpdate,
  onTypeChange,
  focusMediaIndex,
}: {
  commit: Commit;
  tags: Tag[];
  onUpdate: (partial: Record<string, unknown>) => void;
  onTypeChange: (type: CommitType) => void;
  focusMediaIndex?: number | null;
}) {
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "social", "event"];

  return (
    <div className="space-y-2">
      {/* Core fields */}
      <Field label="ID" value={commit.id} onChange={(v) => onUpdate({ id: v })} />
      <SelectField
        label="Type"
        value={commit.type}
        options={commitTypes.map((t) => ({ value: t, label: t }))}
        onChange={(v) => onTypeChange(v as CommitType)}
      />
      <SelectField
        label="Tag"
        value={commit.tagId}
        options={tags.map((t) => ({ value: t.id, label: t.title.en }))}
        onChange={(v) => onUpdate({ tagId: v })}
      />
      <Field
        label="Date"
        value={commit.date}
        onChange={(v) => onUpdate({ date: v })}
        placeholder="YYYY-MM or YYYY-MM-DD"
      />
      <Field
        label="End Date"
        value={commit.endDate ?? ""}
        onChange={(v) => onUpdate({ endDate: v || undefined })}
        placeholder="YYYY-MM or empty"
      />
      <CheckField
        label="Listed"
        checked={commit.listed !== false}
        onChange={(v) => onUpdate({ listed: v ? undefined : false })}
      />
      <CheckField
        label="Hide Date"
        checked={commit.hideDate === true}
        onChange={(v) => onUpdate({ hideDate: v ? true : undefined })}
      />
      <SelectField
        label="Sort By"
        value={commit.sortBy ?? ""}
        options={[
          { value: "", label: "default (endDate for roles, date otherwise)" },
          { value: "date", label: "date (start)" },
          { value: "endDate", label: "endDate" },
        ]}
        onChange={(v) =>
          onUpdate({
            sortBy: v === "" ? undefined : (v as "date" | "endDate"),
          })
        }
      />
      <SelectField
        label="Icon"
        value={commit.icon ?? ""}
        options={[
          { value: "", label: "default (by type)" },
          { value: "graduation-cap", label: "graduation-cap" },
        ]}
        onChange={(v) =>
          onUpdate({ icon: v === "" ? undefined : (v as "graduation-cap") })
        }
      />

      <SectionLabel>Title</SectionLabel>
      <Field
        label="EN"
        value={commit.title.en}
        onChange={(v) => onUpdate({ title: { ...commit.title, en: v } })}
      />
      <Field
        label="ZH"
        value={commit.title.zh}
        onChange={(v) => onUpdate({ title: { ...commit.title, zh: v } })}
      />

      <SectionLabel>Description</SectionLabel>
      <Field
        label="EN"
        value={commit.description.en}
        onChange={(v) => onUpdate({ description: { ...commit.description, en: v } })}
        multiline
      />
      <Field
        label="ZH"
        value={commit.description.zh}
        onChange={(v) => onUpdate({ description: { ...commit.description, zh: v } })}
        multiline
      />

      <SectionLabel>Commentary</SectionLabel>
      <Field
        label="EN"
        value={commit.commentary?.en ?? ""}
        onChange={(v) =>
          onUpdate({
            commentary: v || commit.commentary?.zh
              ? { en: v, zh: commit.commentary?.zh ?? "" }
              : undefined,
          })
        }
        multiline
      />
      <Field
        label="ZH"
        value={commit.commentary?.zh ?? ""}
        onChange={(v) =>
          onUpdate({
            commentary: v || commit.commentary?.en
              ? { en: commit.commentary?.en ?? "", zh: v }
              : undefined,
          })
        }
        multiline
      />

      <StringListSection
        label="Tags"
        items={commit.tags ?? []}
        onChange={(tags) =>
          onUpdate({ tags: tags.length > 0 ? tags : undefined })
        }
        placeholder="keyword"
        addTitle="Add tag"
      />

      {/* Type-specific fields */}
      <TypeSpecificFields commit={commit} onUpdate={onUpdate} />

      {/* Media */}
      <MediaSection
        media={commit.media ?? []}
        onChange={(media) => onUpdate({ media: media.length > 0 ? media : undefined })}
        focusIndex={focusMediaIndex}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific field sections
// ─────────────────────────────────────────────────────────────────────────────

function TypeSpecificFields({
  commit,
  onUpdate,
}: {
  commit: Commit;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  switch (commit.type) {
    case "project":
      return (
        <>
          <SectionLabel>Project</SectionLabel>
          <Field
            label="Stars"
            value={commit.stats?.stars?.toString() ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: {
                  ...commit.stats,
                  stars: v ? parseInt(v, 10) || undefined : undefined,
                },
              })
            }
          />
          <Field
            label="Users"
            value={commit.stats?.users ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: { ...commit.stats, users: v || undefined },
              })
            }
          />
        </>
      );

    case "talk":
      return (
        <>
          <SectionLabel>Talk</SectionLabel>
          <Field
            label="Conference"
            value={commit.conference.name}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, name: v },
              })
            }
          />
          <Field
            label="City"
            value={commit.conference.city ?? ""}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, city: v || undefined },
              })
            }
          />
          <Field
            label="Conf URL"
            value={commit.conference.url ?? ""}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, url: v || undefined },
              })
            }
          />
        </>
      );

    case "post":
      return (
        <>
          <SectionLabel>Post</SectionLabel>
          <Field
            label="URL"
            value={commit.url}
            onChange={(v) => onUpdate({ url: v })}
          />
          <Field
            label="Publication"
            value={commit.publication.name}
            onChange={(v) =>
              onUpdate({
                publication: { ...commit.publication, name: v },
              })
            }
          />
        </>
      );

    case "role":
      return (
        <>
          <SectionLabel>Role</SectionLabel>
          <Field
            label="Company EN"
            value={commit.company.en}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, en: v } })
            }
          />
          <Field
            label="Company ZH"
            value={commit.company.zh}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, zh: v } })
            }
          />
          <Field
            label="Location"
            value={commit.location ?? ""}
            onChange={(v) => onUpdate({ location: v || undefined })}
          />
          <Field
            label="URL"
            value={commit.url ?? ""}
            onChange={(v) => onUpdate({ url: v || undefined })}
          />
        </>
      );

    case "social":
      return (
        <>
          <SectionLabel>Social</SectionLabel>
          <Field
            label="Platform"
            value={commit.platform}
            onChange={(v) => onUpdate({ platform: v })}
          />
        </>
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Media section
// ─────────────────────────────────────────────────────────────────────────────

const mediaTypes: MediaType[] = ["video", "embed", "link", "image"];

function defaultMedia(type: MediaType): Media {
  switch (type) {
    case "video":
      return { type: "video", url: "", platform: "youtube" };
    case "embed":
      return { type: "embed", url: "" };
    case "link":
      return { type: "link", url: "" };
    case "image":
      return { type: "image", url: "" };
  }
}

function MediaSection({
  media,
  onChange,
  focusIndex,
}: {
  media: Media[];
  onChange: (media: Media[]) => void;
  focusIndex?: number | null;
}) {
  const updateItem = (index: number, updated: Media) => {
    const next = [...media];
    next[index] = updated;
    onChange(next);
  };

  const deleteItem = (index: number) => {
    onChange(media.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...media, { type: "link", url: "" }]);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Media</SectionLabel>
        <button
          onClick={addItem}
          className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors"
          title="Add media"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {media.length === 0 && (
        <div className="text-xs text-muted-foreground/40 font-mono pl-[88px]">
          No media attached
        </div>
      )}
      {media.map((item, i) => (
        <MediaItemEditor
          key={i}
          item={item}
          onChange={(updated) => updateItem(i, updated)}
          onDelete={() => deleteItem(i)}
          focused={focusIndex === i}
        />
      ))}
    </>
  );
}

function MediaItemEditor({
  item,
  onChange,
  onDelete,
  focused = false,
}: {
  item: Media;
  onChange: (item: Media) => void;
  onDelete: () => void;
  focused?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Media-level inspect: when this item becomes the focus, bring it into view.
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  const handleTypeChange = (newType: MediaType) => {
    if (newType === item.type) return;
    onChange({ ...defaultMedia(newType), url: item.url });
  };

  return (
    <div
      ref={ref}
      className={cn(
        "border rounded p-2 space-y-1.5 relative transition-colors",
        focused
          ? "border-foreground/40 ring-1 ring-inset ring-foreground/30 bg-muted/15"
          : "border-border/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          {item.type}
        </span>
        <button
          onClick={onDelete}
          className="p-0.5 text-muted-foreground/30 hover:text-red-500 rounded transition-colors"
          title="Remove media"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <SelectField
        label="Type"
        value={item.type}
        options={mediaTypes.map((t) => ({ value: t, label: t }))}
        onChange={(v) => handleTypeChange(v as MediaType)}
      />
      <Field
        label="URL"
        value={item.url}
        onChange={(v) => onChange({ ...item, url: v } as Media)}
        placeholder="https://..."
      />

      {/* Type-specific fields */}
      {item.type === "video" && (
        <>
          <SelectField
            label="Platform"
            value={item.platform}
            options={[
              { value: "youtube", label: "YouTube" },
              { value: "bilibili", label: "Bilibili" },
              { value: "vimeo", label: "Vimeo" },
            ]}
            onChange={(v) => onChange({ ...item, platform: v as "youtube" | "bilibili" | "vimeo" })}
          />
          <Field
            label="Thumbnail"
            value={item.thumbnail ?? ""}
            onChange={(v) => onChange({ ...item, thumbnail: v || undefined })}
            placeholder="Thumbnail URL (optional)"
          />
        </>
      )}

      {item.type === "embed" && (
        <>
          <SelectField
            label="Platform"
            value={item.platform ?? ""}
            options={[
              { value: "", label: "(auto-detect)" },
              { value: "twitter", label: "Twitter / X" },
              { value: "instagram", label: "Instagram" },
              { value: "tiktok", label: "TikTok" },
            ]}
            onChange={(v) => onChange({ ...item, platform: (v || undefined) as "twitter" | "x" | "instagram" | "tiktok" | undefined })}
          />
          <CheckField
            label="Show folded"
            checked={item.defaultShown ?? false}
            onChange={(v) => onChange({ ...item, defaultShown: v || undefined })}
          />
        </>
      )}

      {item.type === "link" && (
        <>
          <Field
            label="Label"
            value={item.label ?? ""}
            onChange={(v) => onChange({ ...item, label: v || undefined })}
            placeholder="Display text"
          />
          <Field
            label="Icon"
            value={item.icon ?? ""}
            onChange={(v) => onChange({ ...item, icon: v || undefined })}
            placeholder="github, globe, slides..."
          />
          <CheckField
            label="Preview"
            checked={item.showPreview ?? false}
            onChange={(v) => onChange({ ...item, showPreview: v || undefined })}
          />
        </>
      )}

      {item.type === "image" && (
        <Field
          label="Alt"
          value={item.alt ?? ""}
          onChange={(v) => onChange({ ...item, alt: v || undefined })}
          placeholder="Alt text"
        />
      )}
    </div>
  );
}
