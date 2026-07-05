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
import {
  X,
  Trash2,
  Plus,
  Undo2,
  GitCommitHorizontal,
  CaseSensitive,
  CalendarDays,
  Eye,
  AlignLeft,
  Quote,
  Users,
  Hash,
  GitBranch,
  Images,
  Film,
  Image as ImageIcon,
  Link2,
  Code,
  type LucideIcon,
} from "lucide-react";
import { commitIcons } from "@/components/log/icons";
import type { InspectField } from "@/components/log/timeline-edit-context";
import { toast } from "sonner";

interface CommitEditorProps {
  commit: Commit;
  /** Bumped by the parent on out-of-band commit replacement (revert)
   *  so draft-holding sections remount and re-hydrate. */
  formEpoch?: number;
  /** On-disk version of this commit — powers dirty-field indicators
   *  and per-commit revert. Null for commits created since last save. */
  savedCommit?: Commit | null;
  tags: Tag[];
  /** All commits in the log — feeds the "Attach To" anchor picker. */
  commits: Commit[];
  /** Runtime identity map — feeds the "Identity" (identityId) picker. */
  identities?: Record<string, Identity>;
  onUpdate: (commit: Commit) => void;
  onDelete: () => void;
  /** Restore this commit to its saved state (only shown when dirty). */
  onRevert?: () => void;
  onClose: () => void;
  focusMediaIndex?: number | null;
  onFocusMediaIndexChange?: (index: number | null) => void;
  /** Form field to scroll to / flash — set by preview sub-element clicks. */
  focusField?: InspectField | null;
  onFocusFieldChange?: (field: InspectField | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dirty tracking — "what did I change since the last save?"
// ─────────────────────────────────────────────────────────────────────────────

/** Deep-compare one commit field against its saved counterpart. */
function fieldDirty(commit: Commit, saved: Commit | null | undefined, key: string): boolean {
  if (!saved) return false; // new commit: everything is "new", dots would be noise
  const a = (commit as unknown as Record<string, unknown>)[key];
  const b = (saved as unknown as Record<string, unknown>)[key];
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/** Count top-level fields that differ between working and saved commit. */
function countDirtyFields(commit: Commit, saved: Commit | null | undefined): number {
  if (!saved) return 0;
  const keys = new Set([...Object.keys(commit), ...Object.keys(saved)]);
  let n = 0;
  for (const k of keys) {
    if (fieldDirty(commit, saved, k)) n += 1;
  }
  return n;
}

/** Amber "modified" dot — the same signal Figma/VS Code use for unsaved
 *  deltas. Sits inline after a field or section label. */
function DirtyDot({ title = "Modified since last save" }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/90 shrink-0"
    />
  );
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
  dirty = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Show the amber "modified since save" dot next to the label. */
  dirty?: boolean;
}) {
  const cls =
    "flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors";

  return (
    <label className="flex items-start gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right pt-1.5 inline-flex items-center justify-end gap-1">
        {dirty && <DirtyDot />}
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
  dirty = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  variant?: "auto" | "dropdown" | "segmented";
  /** Show the amber "modified since save" dot next to the label. */
  dirty?: boolean;
}) {
  const resolved =
    variant === "auto" ? (options.length <= 4 ? "segmented" : "dropdown") : variant;

  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right inline-flex items-center justify-end gap-1">
        {dirty && <DirtyDot />}
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
  dirty = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Show the amber "modified since save" dot next to the label. */
  dirty?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right inline-flex items-center justify-end gap-1">
        {dirty && <DirtyDot />}
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

function SectionLabel({
  children,
  dirty = false,
  icon: Icon,
  trailing,
}: {
  children: React.ReactNode;
  dirty?: boolean;
  /** Functional wayfinding icon — matches what this group controls in
   *  the preview (calendar → date column, eye → visibility, etc.). */
  icon?: LucideIcon;
  /** Trailing status chips (e.g. Visibility's active "unlisted" state). */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40 pt-2 flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3" />}
      {children}
      {dirty && <DirtyDot title="Section has unsaved changes" />}
      {trailing}
    </div>
  );
}

/**
 * Dashed amber state chip — the SAME visual token the preview uses for
 * its "unlisted" / "hidden row" / "zh only" row badges. Reusing it in
 * the form links the two panels: see the badge on the canvas, find the
 * identical chip on the section that controls it.
 */
function StateChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80 border border-dashed border-amber-500/40 rounded px-1 py-px leading-none">
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section — an anchored, flash-highlightable field group.
//
// Every logical group in the form is a Section keyed by `anchor`; preview
// sub-element clicks resolve to an anchor (see FIELD_ANCHORS) and the form
// scrolls the target into view with a selection ring — the inspector-side
// half of the Figma-style "click the canvas, land on the property".
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  anchor,
  focused = false,
  className,
  children,
}: {
  anchor: string;
  focused?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  return (
    <section
      ref={ref}
      data-field-anchor={anchor}
      className={cn(
        "space-y-2 rounded-md transition-colors duration-300 scroll-mt-3",
        focused && "ring-1 ring-inset ring-sky-500/50 bg-sky-500/[0.05] -mx-1.5 px-1.5 pb-1.5",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Map a preview sub-element (InspectField) to its form Section anchor. */
const FIELD_ANCHORS: Record<InspectField, string> = {
  title: "title",
  description: "description",
  commentary: "commentary",
  tags: "tags",
  team: "team",
  // The language badge renders inline right after the title, so its
  // control lives in the Title section — click badge, land next to it.
  language: "title",
  date: "schedule",
  meta: "type",
  stats: "type",
  // The author block is derived from identity resolution — its knobs
  // live in the Rail section (identityId / attachedTo).
  author: "rail",
};

/**
 * Per-type accent recipe for the type-scoped section card. The base
 * schema renders flat (labels + fields on the panel background); the
 * type-specific group sits inside a tinted, bordered card headed by the
 * commit-type icon — so "these fields exist because this is a project"
 * is legible at a glance, Figma component-property style.
 */
const TYPE_ACCENTS: Record<
  CommitType,
  { border: string; bg: string; text: string }
> = {
  project: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/[0.04]",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  talk: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/[0.04]",
    text: "text-violet-600 dark:text-violet-400",
  },
  post: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.04]",
    text: "text-amber-600 dark:text-amber-400",
  },
  role: {
    border: "border-sky-600/30",
    bg: "bg-sky-600/[0.04]",
    text: "text-sky-700 dark:text-sky-400",
  },
  social: {
    border: "border-pink-500/30",
    bg: "bg-pink-500/[0.04]",
    text: "text-pink-600 dark:text-pink-400",
  },
  event: {
    border: "border-border/60",
    bg: "bg-muted/20",
    text: "text-muted-foreground",
  },
};

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
  dirty = false,
  icon,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addTitle?: string;
  dirty?: boolean;
  icon?: LucideIcon;
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
        <SectionLabel icon={icon} dirty={dirty}>{label}</SectionLabel>
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
  formEpoch = 0,
  savedCommit = null,
  tags,
  commits,
  identities,
  onUpdate,
  onDelete,
  onRevert,
  onClose,
  focusMediaIndex = null,
  onFocusMediaIndexChange,
  focusField = null,
  onFocusFieldChange,
}: CommitEditorProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(commit, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  // JSON-apply replaces the commit wholesale — same out-of-band shape as
  // a revert, so it also bumps the draft-remount epoch.
  const [jsonEpoch, setJsonEpoch] = useState(0);
  const TypeIcon = commitIcons[commit.type];
  const dirtyCount = countDirtyFields(commit, savedCommit);

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
      setJsonEpoch((e) => e + 1);
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
          {/* Type icon + label wear the type's accent — the same color
              the type-fields card uses below, so "what am I editing"
              reads consistently from header to card. */}
          <TypeIcon
            className={cn(
              "w-3.5 h-3.5 shrink-0",
              TYPE_ACCENTS[commit.type].text,
            )}
          />
          <div className="min-w-0">
            <div
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                TYPE_ACCENTS[commit.type].text,
              )}
            >
              {commit.type}
            </div>
            <div className="text-sm truncate leading-tight">
              {commit.title.en || commit.id}
            </div>
          </div>
          {dirtyCount > 0 && (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"
              title="Fields changed since last save"
            >
              <DirtyDot />
              {dirtyCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirtyCount > 0 && onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="p-1 text-muted-foreground/40 hover:text-foreground rounded transition-colors"
              title="Revert this commit to saved state"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
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
            savedCommit={savedCommit}
            draftsEpoch={formEpoch + jsonEpoch}
            tags={tags}
            commits={commits}
            identities={identities}
            onUpdate={update}
            onTypeChange={handleTypeChange}
            focusMediaIndex={focusMediaIndex}
            onFocusMediaIndexChange={onFocusMediaIndexChange}
            focusField={focusField}
            onFocusFieldChange={onFocusFieldChange}
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
  savedCommit,
  draftsEpoch = 0,
  tags,
  commits,
  identities,
  onUpdate,
  onTypeChange,
  focusMediaIndex,
  onFocusMediaIndexChange,
  focusField,
}: {
  commit: Commit;
  savedCommit?: Commit | null;
  /** Part of MediaSection's remount key — bumped on revert/JSON-apply. */
  draftsEpoch?: number;
  tags: Tag[];
  commits: Commit[];
  identities?: Record<string, Identity>;
  onUpdate: (partial: Record<string, unknown>) => void;
  onTypeChange: (type: CommitType) => void;
  focusMediaIndex?: number | null;
  onFocusMediaIndexChange?: (index: number | null) => void;
  focusField?: InspectField | null;
  onFocusFieldChange?: (field: InspectField | null) => void;
}) {
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "social", "event"];

  // Dirty helpers, bound to this commit's saved counterpart.
  const dirty = (key: string) => fieldDirty(commit, savedCommit, key);
  const langDirty = (key: string, lang: "en" | "zh") => {
    if (!savedCommit) return false;
    const a =
      ((commit as unknown as Record<string, unknown>)[key] as
        | Record<string, string>
        | undefined)?.[lang] ?? "";
    const b =
      ((savedCommit as unknown as Record<string, unknown>)[key] as
        | Record<string, string>
        | undefined)?.[lang] ?? "";
    return a !== b;
  };

  // Which Section should scroll + highlight, resolved from the preview's
  // sub-element click.
  const focusAnchor = focusField ? FIELD_ANCHORS[focusField] : null;

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

  // Section order mirrors the row's actual render order — the panel
  // reads top-to-bottom the way the canvas does:
  //   hash/icon → title(+badge) → date → meta line (type) → team →
  //   byline/author (rail) → media → description → commentary → tags.
  // Publishing controls (Visibility) affect *whether* the row renders,
  // not how — they close the form.
  return (
    <div className="space-y-3">
      {/* ── Commit: hash (id), row icon (type), chapter (tag) ────── */}
      <Section anchor="identity" focused={focusAnchor === "identity"}>
        <SectionLabel
          icon={GitCommitHorizontal}
          dirty={
            dirty("id") || dirty("type") || dirty("tagId") || dirty("icon")
          }
        >
          Commit
        </SectionLabel>
        <Field
          label="ID"
          value={commit.id}
          onChange={(v) => onUpdate({ id: v })}
          dirty={dirty("id")}
        />
        <ChoiceField<CommitType>
          label="Type"
          value={commit.type}
          options={commitTypes.map((t) => ({ value: t, label: t }))}
          onChange={onTypeChange}
          dirty={dirty("type")}
        />
        <ChoiceField
          label="Tag"
          value={commit.tagId}
          options={tags.map((t) => ({ value: t.id, label: t.title.en }))}
          onChange={(v) => onUpdate({ tagId: v })}
          dirty={dirty("tagId")}
        />
        <ChoiceField<"" | "graduation-cap">
          label="Icon"
          value={commit.icon ?? ""}
          options={[
            { value: "", label: "default" },
            { value: "graduation-cap", label: "grad-cap" },
          ]}
          onChange={(v) => onUpdate({ icon: v === "" ? undefined : v })}
          dirty={dirty("icon")}
        />
      </Section>

      {/* ── Title line: text + inline language badge ─────────────── */}
      <Section anchor="title" focused={focusAnchor === "title"}>
        <SectionLabel
          icon={CaseSensitive}
          dirty={dirty("title") || dirty("language")}
        >
          Title
        </SectionLabel>
        <Field
          label="EN"
          value={commit.title.en}
          onChange={(v) => onUpdate({ title: { ...commit.title, en: v } })}
          dirty={langDirty("title", "en")}
        />
        <Field
          label="ZH"
          value={commit.title.zh}
          onChange={(v) => onUpdate({ title: { ...commit.title, zh: v } })}
          dirty={langDirty("title", "zh")}
        />
        {/* The work's own language — renders as the EN/中文 badge right
            after the title text, so its control lives right here. */}
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
          dirty={dirty("language")}
        />
      </Section>

      {/* ── Date column (right edge of the title line) ───────────── */}
      <Section anchor="schedule" focused={focusAnchor === "schedule"}>
        <SectionLabel
          icon={CalendarDays}
          dirty={
            dirty("date") ||
            dirty("endDate") ||
            dirty("sortBy") ||
            dirty("hideDate")
          }
        >
          Schedule
        </SectionLabel>
        <Field
          label="Date"
          value={commit.date}
          onChange={(v) => onUpdate({ date: v })}
          placeholder="YYYY-MM or YYYY-MM-DD"
          dirty={dirty("date")}
        />
        <Field
          label="End Date"
          value={commit.endDate ?? ""}
          onChange={(v) => onUpdate({ endDate: v || undefined })}
          placeholder="YYYY-MM, present, or empty"
          dirty={dirty("endDate")}
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
          dirty={dirty("sortBy")}
        />
        <CheckField
          label="Hide Date"
          checked={commit.hideDate === true}
          onChange={(v) => onUpdate({ hideDate: v ? true : undefined })}
          dirty={dirty("hideDate")}
        />
      </Section>

      {/* ── Meta line: the type-scoped fields (venue / publication /
          company / platform) print as the row's second line. Tinted
          card marks "these exist because this is a {type}". */}
      {commit.type !== "event" && (
        <Section
          anchor="type"
          focused={focusAnchor === "type"}
          className={cn(
            "border rounded-md p-2.5",
            TYPE_ACCENTS[commit.type].border,
            TYPE_ACCENTS[commit.type].bg,
          )}
        >
          <TypeSectionHeader commit={commit} savedCommit={savedCommit} />
          <TypeSpecificFields
            commit={commit}
            savedCommit={savedCommit}
            onUpdate={onUpdate}
          />
        </Section>
      )}

      {/* ── Subtitle row (left): team chip for projects ──────────── */}
      <Section anchor="team" focused={focusAnchor === "team"}>
        <SectionLabel icon={Users} dirty={dirty("team")}>
          Team
        </SectionLabel>
        <Field
          label="EN"
          value={commit.team?.en ?? ""}
          onChange={(v) => setLocalizedOptional("team", commit.team, "en", v)}
          placeholder="Subtitle chip — e.g. Lynx @ ByteDance"
          dirty={langDirty("team", "en")}
        />
        <Field
          label="ZH"
          value={commit.team?.zh ?? ""}
          onChange={(v) => setLocalizedOptional("team", commit.team, "zh", v)}
          dirty={langDirty("team", "zh")}
        />
      </Section>

      {/* ── Subtitle row (right) + expanded author block ─────────── */}
      <Section anchor="rail" focused={focusAnchor === "rail"}>
        <SectionLabel
          icon={GitBranch}
          dirty={dirty("identityId") || dirty("attachedTo")}
        >
          Rail
        </SectionLabel>
        <ChoiceField
          label="Identity"
          value={commit.identityId ?? ""}
          options={identityOptions}
          onChange={(v) => onUpdate({ identityId: v === "" ? undefined : v })}
          dirty={dirty("identityId")}
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
          dirty={dirty("attachedTo")}
        />
      </Section>

      {/* ── Media: pinned below the fold, rest at top of expand.
          Keyed by commit id (+ epoch) so the section remounts and
          re-hydrates its fat drafts when the user switches commits OR
          the commit is replaced out-of-band (revert / JSON apply). */}
      <MediaSection
        key={`${commit.id}:${draftsEpoch}`}
        media={commit.media ?? []}
        dirty={dirty("media")}
        onChange={(media) => onUpdate({ media: media.length > 0 ? media : undefined })}
        focusIndex={focusMediaIndex}
        onFocusIndexChange={onFocusMediaIndexChange}
      />

      {/* ── Expanded body text ────────────────────────────────────── */}
      <Section anchor="description" focused={focusAnchor === "description"}>
        <SectionLabel icon={AlignLeft} dirty={dirty("description")}>
          Description
        </SectionLabel>
        <Field
          label="EN"
          value={commit.description.en}
          onChange={(v) => onUpdate({ description: { ...commit.description, en: v } })}
          multiline
          dirty={langDirty("description", "en")}
        />
        <Field
          label="ZH"
          value={commit.description.zh}
          onChange={(v) => onUpdate({ description: { ...commit.description, zh: v } })}
          multiline
          dirty={langDirty("description", "zh")}
        />
      </Section>

      <Section anchor="commentary" focused={focusAnchor === "commentary"}>
        <SectionLabel icon={Quote} dirty={dirty("commentary")}>
          Commentary
        </SectionLabel>
        <Field
          label="EN"
          value={commit.commentary?.en ?? ""}
          onChange={(v) => setLocalizedOptional("commentary", commit.commentary, "en", v)}
          multiline
          dirty={langDirty("commentary", "en")}
        />
        <Field
          label="ZH"
          value={commit.commentary?.zh ?? ""}
          onChange={(v) => setLocalizedOptional("commentary", commit.commentary, "zh", v)}
          multiline
          dirty={langDirty("commentary", "zh")}
        />
      </Section>

      <Section anchor="tags" focused={focusAnchor === "tags"}>
        <StringListSection
          label="Tags"
          icon={Hash}
          dirty={dirty("tags")}
          items={commit.tags ?? []}
          onChange={(tags) =>
            onUpdate({ tags: tags.length > 0 ? tags : undefined })
          }
          placeholder="keyword"
          addTitle="Add tag"
        />
      </Section>

      {/* ── Publishing: controls whether the row appears at all —
          not part of the row's anatomy, so it closes the form. The
          amber chips echo the canvas badges 1:1. */}
      <Section anchor="visibility" focused={focusAnchor === "visibility"}>
        <SectionLabel
          icon={Eye}
          dirty={dirty("listed") || dirty("listedIn")}
          trailing={
            <>
              {commit.listed === false && <StateChip>unlisted</StateChip>}
              {commit.listedIn === "en" && <StateChip>en only</StateChip>}
              {commit.listedIn === "zh" && <StateChip>zh only</StateChip>}
            </>
          }
        >
          Visibility
        </SectionLabel>
        <CheckField
          label="Listed"
          checked={commit.listed !== false}
          onChange={(v) => onUpdate({ listed: v ? undefined : false })}
          dirty={dirty("listed")}
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
          dirty={dirty("listedIn")}
        />
      </Section>
    </div>
  );
}

/**
 * Header row of the type-scoped card: type icon + name in the type's
 * accent color, plus a dirty dot when any type-specific field changed.
 */
function TypeSectionHeader({
  commit,
  savedCommit,
}: {
  commit: Commit;
  savedCommit?: Commit | null;
}) {
  const TypeIcon = commitIcons[commit.type];
  const typeKeys: Record<CommitType, string[]> = {
    project: ["stats"],
    talk: ["conference"],
    post: ["url", "publication"],
    role: ["company", "companyOverride", "location", "url", "hideRow"],
    social: ["platform"],
    event: [],
  };
  const typeDirty = typeKeys[commit.type].some((k) =>
    fieldDirty(commit, savedCommit, k),
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider",
        TYPE_ACCENTS[commit.type].text,
      )}
    >
      <TypeIcon className="w-3 h-3" />
      {commit.type}
      <span className="opacity-50 normal-case">· type fields</span>
      {typeDirty && <DirtyDot title="Type fields have unsaved changes" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific field sections
// ─────────────────────────────────────────────────────────────────────────────

function TypeSpecificFields({
  commit,
  savedCommit,
  onUpdate,
}: {
  commit: Commit;
  savedCommit?: Commit | null;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  const dirty = (key: string) => fieldDirty(commit, savedCommit, key);

  switch (commit.type) {
    case "project":
      return (
        <>
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
            dirty={dirty("stats")}
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
          <Field
            label="Conference"
            value={commit.conference.name}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, name: v },
              })
            }
            dirty={dirty("conference")}
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
          <Field
            label="URL"
            value={commit.url}
            onChange={(v) => onUpdate({ url: v })}
            dirty={dirty("url")}
          />
          <Field
            label="Publication"
            value={commit.publication.name}
            onChange={(v) =>
              onUpdate({
                publication: { ...commit.publication, name: v },
              })
            }
            dirty={dirty("publication")}
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
          <Field
            label="Company EN"
            value={commit.company.en}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, en: v } })
            }
            dirty={dirty("company")}
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
            dirty={dirty("companyOverride")}
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
            dirty={dirty("location")}
          />
          <Field
            label="URL"
            value={commit.url ?? ""}
            onChange={(v) => onUpdate({ url: v || undefined })}
            dirty={dirty("url")}
          />
          <CheckField
            label="Hide Row"
            checked={commit.hideRow === true}
            onChange={(v) => onUpdate({ hideRow: v ? true : undefined })}
            dirty={dirty("hideRow")}
          />
        </>
      );

    case "social":
      return (
        <>
          <Field
            label="Platform"
            value={commit.platform}
            onChange={(v) => onUpdate({ platform: v })}
            dirty={dirty("platform")}
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

/** Kind → icon, matching the preview rail and the commit list. */
const MEDIA_KIND_ICONS: Record<MediaKind, LucideIcon> = {
  link: Link2,
  "social-embed": Code,
  video: Film,
  image: ImageIcon,
};

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

// ─────────────────────────────────────────────────────────────────────────────
// URL classification — the "drop a link, we figure out what it is" brain.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a raw URL into the most likely MediaDraft. Mirrors the
 * platform detection the renderers already use (see og-core's social
 * embed detection and VideoPlatform) so a dropped link lands in the
 * same kind the site would render best:
 *
 *   youtube / youtu.be / bilibili / b23.tv / vimeo  → video (platform)
 *   x.com / twitter / instagram / tiktok            → social-embed
 *   *.png|jpg|jpeg|gif|webp|avif|svg                → image
 *   github.com                                      → link · pill (github icon)
 *   anything else                                   → link · card (OG preview)
 */
function classifyUrl(raw: string): MediaDraft | null {
  const url = raw.trim();
  if (!url) return null;

  let host: string;
  let pathname: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    pathname = u.pathname.toLowerCase();
  } catch {
    return null;
  }

  // Videos
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com")
    return { kind: "video", url, videoPlatform: "youtube" };
  if (host === "bilibili.com" || host === "b23.tv" || host === "m.bilibili.com")
    return { kind: "video", url, videoPlatform: "bilibili" };
  if (host === "vimeo.com")
    return { kind: "video", url, videoPlatform: "vimeo" };

  // Social embeds
  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com")
    return { kind: "social-embed", url, socialPlatform: "twitter" };
  if (host === "instagram.com")
    return { kind: "social-embed", url, socialPlatform: "instagram" };
  if (host === "tiktok.com")
    return { kind: "social-embed", url, socialPlatform: "tiktok" };

  // Images by extension
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(pathname))
    return { kind: "image", url };

  // Repos read best as pills (icon + label in the folded rail).
  if (host === "github.com")
    return { kind: "link", url, present: "pill", icon: "github", label: "GitHub" };

  // Everything else: an OG-preview card.
  return { kind: "link", url, present: "card" };
}

/** Human-readable summary of a classified draft, for the add toast. */
function describeDraft(d: MediaDraft): string {
  switch (d.kind) {
    case "video":
      return `video · ${d.videoPlatform}`;
    case "social-embed":
      return `social-embed · ${d.socialPlatform ?? "auto"}`;
    case "image":
      return "image";
    case "link":
      return `link · ${d.present}${d.icon ? ` · ${d.icon}` : ""}`;
  }
}

/**
 * Smart add zone — drop a URL, paste one, or type + Enter; the kind is
 * auto-detected via `classifyUrl`. The dashed border + copy make it read
 * as a drop target; the ring feedback on dragover confirms the gesture.
 */
function MediaDropZone({ onAdd }: { onAdd: (draft: MediaDraft) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState("");

  const tryAdd = (raw: string): boolean => {
    const draft = classifyUrl(raw);
    if (!draft) {
      toast.error("Not a recognizable URL");
      return false;
    }
    onAdd(draft);
    toast.success(`Added ${describeDraft(draft)}`);
    return true;
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped =
          e.dataTransfer.getData("text/uri-list").split("\n")[0]?.trim() ||
          e.dataTransfer.getData("text/plain").trim();
        if (dropped) tryAdd(dropped);
      }}
      className={cn(
        "ml-[88px] border border-dashed rounded px-2 py-1.5 transition-colors",
        dragOver
          ? "border-sky-500/70 bg-sky-500/[0.06]"
          : "border-border/50 hover:border-border",
      )}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text").trim();
          // Only intercept when the paste IS a URL — otherwise let it
          // land in the input for manual editing.
          if (classifyUrl(pasted)) {
            e.preventDefault();
            if (tryAdd(pasted)) setText("");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            e.preventDefault();
            if (tryAdd(text)) setText("");
          }
        }}
        placeholder="Drop / paste a link — kind auto-detected"
        className="w-full bg-transparent text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none"
      />
    </div>
  );
}

function MediaSection({
  media,
  onChange,
  focusIndex,
  onFocusIndexChange,
  dirty = false,
}: {
  media: Media[];
  onChange: (media: Media[]) => void;
  focusIndex?: number | null;
  onFocusIndexChange?: (index: number | null) => void;
  dirty?: boolean;
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

  const addClassified = (draft: MediaDraft) => {
    propagate([...drafts, draft]);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel icon={Images} dirty={dirty}>Media</SectionLabel>
        <button
          onClick={addItem}
          className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors"
          title="Add media manually"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <MediaDropZone onAdd={addClassified} />
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
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
          {/* Same icon per kind as the preview's folded-rail indicators
              and the commit list — one iconography across all surfaces. */}
          {(() => {
            const KindIcon = MEDIA_KIND_ICONS[draft.kind];
            return <KindIcon className="w-3 h-3" />;
          })()}
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
