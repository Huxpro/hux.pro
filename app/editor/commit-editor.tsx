"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  Commit,
  CommitType,
  CommitLanguage,
  Identity,
  Tag,
  Media,
  MediaKind,
  LinkPresent,
  VideoPlatform,
  SocialEmbedPlatform,
} from "@/lib/log";
import { X, Trash2, Plus } from "lucide-react";
import { commitIcons } from "@/components/log/icons";
import { toast } from "sonner";

interface CommitEditorProps {
  commit: Commit;
  tags: Tag[];
  /** All commits in the log — feeds the "Attach To" anchor picker. */
  commits: Commit[];
  /** Runtime identity map — feeds the "Identity" (identityId) picker. */
  identities?: Record<string, Identity>;
  onUpdate: (commit: Commit) => void;
  onDelete: () => void;
  onClose: () => void;
  focusMediaIndex?: number | null;
  onFocusMediaIndexChange?: (index: number | null) => void;
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

/**
 * One-of-N picker for editor rows. Visually auto-adapts:
 *   - options.length ≤ 4  → inline segmented control (one-click reach)
 *   - options.length > 4   → native <select> (avoids the segmented row
 *                            blowing past the panel width)
 *
 * The threshold lives here rather than at each call site so the editor's
 * choice surface is consistent. Pass `variant="dropdown"` or `"segmented"`
 * to override when a specific call site needs a fixed treatment.
 *
 * Generic T extends string lets each call site preserve its own union type
 * (CommitType, MediaKind, LinkPresent, …) without unsafe casts.
 */
function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = "auto",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  variant?: "auto" | "dropdown" | "segmented";
}) {
  const resolved =
    variant === "auto" ? (options.length <= 4 ? "segmented" : "dropdown") : variant;

  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
        {label}
      </span>
      {resolved === "segmented" ? (
        <div className="flex border border-border/50 rounded overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                value === o.value
                  ? "bg-muted/30 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
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
  commits,
  identities,
  onUpdate,
  onDelete,
  onClose,
  focusMediaIndex = null,
  onFocusMediaIndexChange,
}: CommitEditorProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(commit, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
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
    // Carry every type-agnostic BaseCommit field across the switch — only
    // the discriminated, type-specific fields (conference / publication /
    // stats / …) are replaced by `defaultFieldsForType`. Anything omitted
    // here would be silently dropped when the user flips the type.
    const base = {
      id: commit.id,
      tagId: commit.tagId,
      date: commit.date,
      endDate: commit.endDate,
      title: commit.title,
      description: commit.description,
      commentary: commit.commentary,
      team: commit.team,
      tags: commit.tags,
      listed: commit.listed,
      listedIn: commit.listedIn,
      language: commit.language,
      hideDate: commit.hideDate,
      sortBy: commit.sortBy,
      icon: commit.icon,
      identityId: commit.identityId,
      attachedTo: commit.attachedTo,
      media: commit.media,
    };
    onUpdate({
      ...base,
      type: newType,
      ...defaultFieldsForType(newType),
    } as Commit);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
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
              type="button"
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
              type="button"
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
            type="button"
            onClick={onDelete}
            className="p-1 text-muted-foreground/40 hover:text-red-500 rounded transition-colors"
            title="Delete commit"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
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
            commits={commits}
            identities={identities}
            onUpdate={update}
            onTypeChange={handleTypeChange}
            focusMediaIndex={focusMediaIndex}
            onFocusMediaIndexChange={onFocusMediaIndexChange}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form fields
// ─────────────────────────────────────────────────────────────────────────────

/** Sentinel select-value for `attachedTo: null` (force-detach). Commit ids
 *  are kebab strings, so this never collides with a real id. */
const DETACH = "—detach—";

function FormFields({
  commit,
  tags,
  commits,
  identities,
  onUpdate,
  onTypeChange,
  focusMediaIndex,
  onFocusMediaIndexChange,
}: {
  commit: Commit;
  tags: Tag[];
  commits: Commit[];
  identities?: Record<string, Identity>;
  onUpdate: (partial: Record<string, unknown>) => void;
  onTypeChange: (type: CommitType) => void;
  focusMediaIndex?: number | null;
  onFocusMediaIndexChange?: (index: number | null) => void;
}) {
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "social", "event"];

  // Localized helper: write an optional LocalizedString field, collapsing
  // back to `undefined` when both variants go empty (keeps log.json sparse).
  const setLocalizedOptional = (
    key: string,
    current: { en: string; zh: string } | undefined,
    lang: "en" | "zh",
    value: string,
  ) => {
    const other = lang === "en" ? current?.zh ?? "" : current?.en ?? "";
    const next = value || other ? { en: "", zh: "", ...current, [lang]: value } : undefined;
    onUpdate({ [key]: next });
  };

  // Anchor candidates for `attachedTo`: roles / events / projects (the row
  // types the connector can actually land on), excluding self. Labeled by
  // title + type so the picker reads clearly.
  const attachOptions: { value: string; label: string }[] = [
    { value: "", label: "auto (tenure)" },
    { value: DETACH, label: "detach (none)" },
    ...commits
      .filter(
        (c) =>
          c.id !== commit.id &&
          (c.type === "role" || c.type === "event" || c.type === "project"),
      )
      .map((c) => ({ value: c.id, label: `${c.title.en || c.id} · ${c.type}` })),
  ];
  const attachValue =
    commit.attachedTo === null ? DETACH : commit.attachedTo ?? "";

  const identityOptions: { value: string; label: string }[] = [
    { value: "", label: "auto" },
    ...Object.entries(identities ?? {}).map(([id, meta]) => ({
      value: id,
      label: `${id} · ${meta.company.en}`,
    })),
  ];

  return (
    <div className="space-y-2">
      {/* ── Identity ─────────────────────────────────────────────── */}
      <Field label="ID" value={commit.id} onChange={(v) => onUpdate({ id: v })} />
      <ChoiceField<CommitType>
        label="Type"
        value={commit.type}
        options={commitTypes.map((t) => ({ value: t, label: t }))}
        onChange={onTypeChange}
      />
      <ChoiceField
        label="Tag"
        value={commit.tagId}
        options={tags.map((t) => ({ value: t.id, label: t.title.en }))}
        onChange={(v) => onUpdate({ tagId: v })}
      />
      <ChoiceField<"" | "graduation-cap">
        label="Icon"
        value={commit.icon ?? ""}
        options={[
          { value: "", label: "default" },
          { value: "graduation-cap", label: "grad-cap" },
        ]}
        onChange={(v) => onUpdate({ icon: v === "" ? undefined : v })}
      />

      {/* ── Schedule ─────────────────────────────────────────────── */}
      <SectionLabel>Schedule</SectionLabel>
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
        placeholder="YYYY-MM, present, or empty"
      />
      <ChoiceField<"" | "date" | "endDate">
        label="Sort By"
        value={commit.sortBy ?? ""}
        options={[
          { value: "", label: "default" },
          { value: "date", label: "date" },
          { value: "endDate", label: "endDate" },
        ]}
        onChange={(v) => onUpdate({ sortBy: v === "" ? undefined : v })}
      />
      <CheckField
        label="Hide Date"
        checked={commit.hideDate === true}
        onChange={(v) => onUpdate({ hideDate: v ? true : undefined })}
      />

      {/* ── Visibility & language ────────────────────────────────── */}
      <SectionLabel>Visibility</SectionLabel>
      <CheckField
        label="Listed"
        checked={commit.listed !== false}
        onChange={(v) => onUpdate({ listed: v ? undefined : false })}
      />
      <ChoiceField<"" | CommitLanguage>
        label="Listed In"
        value={commit.listedIn ?? ""}
        options={[
          { value: "", label: "both" },
          { value: "en", label: "EN only" },
          { value: "zh", label: "ZH only" },
        ]}
        onChange={(v) => onUpdate({ listedIn: v === "" ? undefined : v })}
      />
      <ChoiceField<"" | CommitLanguage>
        label="Language"
        value={commit.language ?? ""}
        options={[
          { value: "", label: "—" },
          { value: "en", label: "EN" },
          { value: "zh", label: "中文" },
          { value: "both", label: "both" },
        ]}
        onChange={(v) => onUpdate({ language: v === "" ? undefined : v })}
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
        onChange={(v) => setLocalizedOptional("commentary", commit.commentary, "en", v)}
        multiline
      />
      <Field
        label="ZH"
        value={commit.commentary?.zh ?? ""}
        onChange={(v) => setLocalizedOptional("commentary", commit.commentary, "zh", v)}
        multiline
      />

      <SectionLabel>Team</SectionLabel>
      <Field
        label="EN"
        value={commit.team?.en ?? ""}
        onChange={(v) => setLocalizedOptional("team", commit.team, "en", v)}
        placeholder="Subtitle chip — e.g. Lynx @ ByteDance"
      />
      <Field
        label="ZH"
        value={commit.team?.zh ?? ""}
        onChange={(v) => setLocalizedOptional("team", commit.team, "zh", v)}
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

      {/* ── Rail: identity clustering & explicit attachment ──────── */}
      <SectionLabel>Rail</SectionLabel>
      <ChoiceField
        label="Identity"
        value={commit.identityId ?? ""}
        options={identityOptions}
        onChange={(v) => onUpdate({ identityId: v === "" ? undefined : v })}
      />
      <ChoiceField
        label="Attach To"
        value={attachValue}
        options={attachOptions}
        onChange={(v) =>
          onUpdate({
            attachedTo: v === "" ? undefined : v === DETACH ? null : v,
          })
        }
      />

      {/* Media — keyed by commit id so the section remounts and re-hydrates
          its fat drafts when the user switches commits. */}
      <MediaSection
        key={commit.id}
        media={commit.media ?? []}
        onChange={(media) => onUpdate({ media: media.length > 0 ? media : undefined })}
        focusIndex={focusMediaIndex}
        onFocusIndexChange={onFocusMediaIndexChange}
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
          <Field
            label="Downloads"
            value={commit.stats?.downloads ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: { ...commit.stats, downloads: v || undefined },
              })
            }
            placeholder="e.g. 1.2M"
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
          <Field
            label="Logo"
            value={commit.publication.logo ?? ""}
            onChange={(v) =>
              onUpdate({
                publication: { ...commit.publication, logo: v || undefined },
              })
            }
            placeholder="Logo URL (optional)"
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
            label="Co. Ovr EN"
            value={commit.companyOverride?.en ?? ""}
            onChange={(v) =>
              onUpdate({
                companyOverride:
                  v || commit.companyOverride?.zh
                    ? { en: v, zh: commit.companyOverride?.zh ?? "" }
                    : undefined,
              })
            }
            placeholder="Per-range label override"
          />
          <Field
            label="Co. Ovr ZH"
            value={commit.companyOverride?.zh ?? ""}
            onChange={(v) =>
              onUpdate({
                companyOverride:
                  v || commit.companyOverride?.en
                    ? { en: commit.companyOverride?.en ?? "", zh: v }
                    : undefined,
              })
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
          <CheckField
            label="Hide Row"
            checked={commit.hideRow === true}
            onChange={(v) => onUpdate({ hideRow: v ? true : undefined })}
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

const mediaKinds: { value: MediaKind; label: string }[] = [
  { value: "link", label: "link" },
  { value: "social-embed", label: "social-embed" },
  { value: "video", label: "video" },
  { value: "image", label: "image" },
];

/**
 * Fat working state for the media-item editor.
 *
 * Two reasons we don't edit `Media` directly:
 *  1. Switching kinds shouldn't drop sibling-kind fields. A user who pasted a
 *     URL, picked a Bilibili platform, and then flipped to "link" should not
 *     lose `url` and `platform` — flipping back must restore them.
 *  2. Each kind's optional fields live side-by-side here without the
 *     discriminated union narrowing them away. We serialize down to the active
 *     `Media` shape only on output (`draftToMedia`), so saved JSON stays clean.
 */
interface MediaDraft {
  kind: MediaKind;
  url: string;
  // link
  present?: LinkPresent;
  preview?: { title?: string; description?: string; image?: string };
  label?: string;
  icon?: string;
  // social-embed
  socialPlatform?: SocialEmbedPlatform;
  // video
  videoPlatform?: VideoPlatform;
  thumbnail?: string;
  // image
  alt?: string;
  // shared
  pinned?: boolean;
}

function mediaToDraft(m: Media): MediaDraft {
  const base = { url: m.url, pinned: m.pinned };
  switch (m.kind) {
    case "link":
      return {
        kind: "link",
        ...base,
        present: m.present,
        preview: m.preview,
        label: m.label,
        icon: m.icon,
      };
    case "social-embed":
      return {
        kind: "social-embed",
        ...base,
        socialPlatform: m.platform,
      };
    case "video":
      return {
        kind: "video",
        ...base,
        videoPlatform: m.platform,
        thumbnail: m.thumbnail,
      };
    case "image":
      return { kind: "image", ...base, alt: m.alt };
  }
}

/** Narrow a fat draft down to the discriminated Media shape on save. */
function draftToMedia(d: MediaDraft): Media {
  // Pin only appears in saved JSON when explicitly true — matching `Pinned`'s
  // `pinned?: true` shape and keeping log.json minimal.
  const pinned = d.pinned ? { pinned: true as const } : {};
  switch (d.kind) {
    case "link":
      return {
        kind: "link",
        url: d.url,
        present: d.present ?? "pill",
        ...(d.preview ? { preview: d.preview } : {}),
        ...(d.label ? { label: d.label } : {}),
        ...(d.icon ? { icon: d.icon } : {}),
        ...pinned,
      };
    case "social-embed":
      return {
        kind: "social-embed",
        url: d.url,
        ...(d.socialPlatform ? { platform: d.socialPlatform } : {}),
        ...pinned,
      };
    case "video":
      return {
        kind: "video",
        url: d.url,
        platform: d.videoPlatform ?? "youtube",
        ...(d.thumbnail ? { thumbnail: d.thumbnail } : {}),
        ...pinned,
      };
    case "image":
      return {
        kind: "image",
        url: d.url,
        ...(d.alt ? { alt: d.alt } : {}),
        ...pinned,
      };
  }
}

function emptyDraft(): MediaDraft {
  return { kind: "link", url: "", present: "pill" };
}

function MediaSection({
  media,
  onChange,
  focusIndex,
  onFocusIndexChange,
}: {
  media: Media[];
  onChange: (media: Media[]) => void;
  focusIndex?: number | null;
  onFocusIndexChange?: (index: number | null) => void;
}) {
  // Working draft state — one per row, hydrated once at mount.
  //
  // Drafts hold sibling-kind fields beyond what the narrowed Media union
  // exposes (e.g. a `videoPlatform` survives the user flipping to `link` and
  // back). The parent keys this section by commit id, so switching commits
  // remounts and re-hydrates from that commit's media.
  const [drafts, setDrafts] = useState<MediaDraft[]>(() => media.map(mediaToDraft));

  const propagate = (nextDrafts: MediaDraft[]) => {
    setDrafts(nextDrafts);
    onChange(nextDrafts.map(draftToMedia));
  };

  const updateItem = (index: number, updated: MediaDraft) => {
    const next = [...drafts];
    next[index] = updated;
    propagate(next);
  };

  const deleteItem = (index: number) => {
    if (focusIndex != null) {
      if (focusIndex === index) {
        onFocusIndexChange?.(null);
      } else if (focusIndex > index) {
        onFocusIndexChange?.(focusIndex - 1);
      }
    }
    propagate(drafts.filter((_, i) => i !== index));
  };

  const addItem = () => {
    propagate([...drafts, emptyDraft()]);
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
      {drafts.length === 0 && (
        <div className="text-xs text-muted-foreground/40 font-mono pl-[88px]">
          No media attached
        </div>
      )}
      {drafts.map((draft, i) => (
        <MediaItemEditor
          key={i}
          draft={draft}
          onChange={(updated) => updateItem(i, updated)}
          onDelete={() => deleteItem(i)}
          focused={focusIndex === i}
        />
      ))}
    </>
  );
}

const presentOptions: { value: LinkPresent; label: string }[] = [
  { value: "pill", label: "pill" },
  { value: "card", label: "card" },
];


function MediaItemEditor({
  draft,
  onChange,
  onDelete,
  focused = false,
}: {
  draft: MediaDraft;
  onChange: (draft: MediaDraft) => void;
  onDelete: () => void;
  focused?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<MediaDraft>) => onChange({ ...draft, ...patch });

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  return (
    <div
      ref={ref}
      className={cn(
        "border rounded p-2 space-y-1.5 relative transition-colors",
        focused
          ? "border-sky-500/70 ring-1 ring-inset ring-sky-500/35 bg-sky-500/[0.05]"
          : "border-border/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          {draft.kind}
          {draft.kind === "link" && draft.present ? ` · ${draft.present}` : ""}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="p-0.5 text-muted-foreground/30 hover:text-red-500 rounded transition-colors"
          title="Remove media"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <ChoiceField<MediaKind>
        label="Kind"
        value={draft.kind}
        options={mediaKinds}
        onChange={(v) => set({ kind: v })}
      />
      <Field
        label="URL"
        value={draft.url}
        onChange={(v) => set({ url: v })}
        placeholder="https://..."
      />

      {/* Kind-specific fields. Sibling-kind values live in the draft and are
          preserved across kind switches — only the active inputs are shown. */}
      {draft.kind === "link" && (
        <>
          <ChoiceField<LinkPresent>
            label="Present"
            value={draft.present ?? "pill"}
            options={presentOptions}
            onChange={(v) => set({ present: v })}
          />
          <Field
            label="Label"
            value={draft.label ?? ""}
            onChange={(v) => set({ label: v || undefined })}
            placeholder="Display text (pill)"
          />
          <Field
            label="Icon"
            value={draft.icon ?? ""}
            onChange={(v) => set({ icon: v || undefined })}
            placeholder="github, globe, slides... (pill)"
          />
          {draft.present === "card" && (
            <>
              <Field
                label="Preview title"
                value={draft.preview?.title ?? ""}
                onChange={(v) =>
                  set({
                    preview: {
                      ...draft.preview,
                      title: v || undefined,
                    },
                  })
                }
                placeholder="Card title override"
              />
              <Field
                label="Preview image"
                value={draft.preview?.image ?? ""}
                onChange={(v) =>
                  set({
                    preview: {
                      ...draft.preview,
                      image: v || undefined,
                    },
                  })
                }
                placeholder="Card image URL override"
              />
            </>
          )}
        </>
      )}

      {draft.kind === "social-embed" && (
        <ChoiceField<"" | SocialEmbedPlatform>
          label="Platform"
          value={draft.socialPlatform ?? ""}
          options={[
            { value: "", label: "auto" },
            { value: "twitter", label: "X" },
            { value: "instagram", label: "IG" },
            { value: "tiktok", label: "TikTok" },
          ]}
          onChange={(v) => set({ socialPlatform: v || undefined })}
        />
      )}

      {draft.kind === "video" && (
        <>
          <ChoiceField<VideoPlatform>
            label="Platform"
            value={draft.videoPlatform ?? "youtube"}
            options={[
              { value: "youtube", label: "YouTube" },
              { value: "bilibili", label: "Bilibili" },
              { value: "vimeo", label: "Vimeo" },
            ]}
            onChange={(v) => set({ videoPlatform: v })}
          />
          <Field
            label="Thumbnail"
            value={draft.thumbnail ?? ""}
            onChange={(v) => set({ thumbnail: v || undefined })}
            placeholder="Thumbnail URL (optional)"
          />
        </>
      )}

      {draft.kind === "image" && (
        <Field
          label="Alt"
          value={draft.alt ?? ""}
          onChange={(v) => set({ alt: v || undefined })}
          placeholder="Alt text"
        />
      )}

      <CheckField
        label="Pinned"
        checked={draft.pinned === true}
        onChange={(v) => set({ pinned: v || undefined })}
      />
    </div>
  );
}
