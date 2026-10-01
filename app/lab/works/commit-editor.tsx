"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  Commit,
  CommitType,
  Tag,
  Media,
  MediaKind,
  LinkPresent,
  VideoPlatform,
  SocialEmbedPlatform,
  Identity,
  RoleCommit,
  AsideLine,
} from "@/lib/log";
import { localize, resolveIdentity, sortCommitsByDate } from "@/lib/log";
import { useLocale } from "@/services";
import { X, Trash2, Plus, Unlink, GitBranch, AlertTriangle, Check } from "lucide-react";
import { commitIcons } from "@/components/log/icons";
import { showNotice } from "@/systems/dock";
import { useLabStrings } from "@/systems/lab";
import { WORKS_STRINGS, type WorksStrings } from "./strings";

interface CommitEditorProps {
  commit: Commit;
  tags: Tag[];
  /** All commits (roles included) — powers live identity/rail resolution. */
  commits: Commit[];
  /** Identity metadata lookup — powers the readout + override dropdown. */
  identities: Record<string, Identity>;
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
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
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
                  : "text-tertiary-foreground hover:text-muted-foreground",
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
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
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
    <div className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground pt-2">
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
  const S = useLabStrings(WORKS_STRINGS);
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
          className="p-0.5 text-quaternary-foreground hover:text-muted-foreground rounded transition-colors"
          title={addTitle ?? S.listAdd(label)}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {items.length === 0 && (
        <div className="text-xs text-quaternary-foreground font-mono pl-[88px]">
          {S.listEmpty(label)}
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
            className="p-0.5 text-quaternary-foreground hover:text-red-500 rounded transition-colors"
            title={S.listRemove(label)}
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
        identityId: "",
      };
    case "press":
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
  const { locale } = useLocale();
  const S = useLabStrings(WORKS_STRINGS);
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
        throw new Error(S.jsonMissingFields);
      }
      onUpdate(parsed as Commit);
      setJsonError(null);
      setTab("form");
      showNotice({ id: "lab", icon: Check, title: S.jsonApplied });
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : S.jsonInvalid);
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
      present: commit.present,
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
          <TypeIcon className="w-3.5 h-3.5 shrink-0 text-tertiary-foreground" />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
              {commit.type}
            </div>
            <div className="text-sm truncate leading-tight">
              {localize(commit.title, locale) || commit.id}
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
                  : "text-tertiary-foreground hover:text-muted-foreground"
              )}
            >
              {S.tabForm}
            </button>
            <button
              type="button"
              onClick={switchToJson}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                tab === "json"
                  ? "bg-muted/30 text-foreground"
                  : "text-tertiary-foreground hover:text-muted-foreground"
              )}
            >
              {S.tabJson}
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-quaternary-foreground hover:text-red-500 rounded transition-colors"
            title={S.deleteCommit}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-tertiary-foreground hover:text-foreground rounded transition-colors"
            title={S.closeInspector}
            aria-label={S.closeInspector}
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
              {S.applyJson}
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
  identities: Record<string, Identity>;
  onUpdate: (partial: Record<string, unknown>) => void;
  onTypeChange: (type: CommitType) => void;
  focusMediaIndex?: number | null;
  onFocusMediaIndexChange?: (index: number | null) => void;
}) {
  const { locale } = useLocale();
  const S = useLabStrings(WORKS_STRINGS);
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "press", "event"];

  return (
    <div className="space-y-2">
      {/* Core fields */}
      <Field label={S.id} value={commit.id} onChange={(v) => onUpdate({ id: v })} />
      <ChoiceField<CommitType>
        label={S.type}
        value={commit.type}
        options={commitTypes.map((t) => ({ value: t, label: S.typeNames[t] }))}
        onChange={onTypeChange}
      />
      <ChoiceField
        label={S.tag}
        value={commit.tagId}
        options={tags.map((t) => ({ value: t.id, label: localize(t.title, locale) }))}
        onChange={(v) => onUpdate({ tagId: v })}
      />
      <Field
        label={S.date}
        value={commit.date}
        onChange={(v) => onUpdate({ date: v })}
        placeholder={S.datePlaceholder}
      />
      <Field
        label={S.endDate}
        value={commit.endDate ?? ""}
        onChange={(v) => onUpdate({ endDate: v || undefined })}
        placeholder={S.endDatePlaceholder}
      />
      <CheckField
        label={S.listed}
        checked={commit.listed !== false}
        onChange={(v) => onUpdate({ listed: v ? undefined : false })}
      />
      <CheckField
        label={S.hideDate}
        checked={commit.hideDate === true}
        onChange={(v) => onUpdate({ hideDate: v ? true : undefined })}
      />
      <CheckField
        label={S.aside}
        checked={commit.present === "aside"}
        onChange={(v) => onUpdate({ present: v ? "aside" : undefined })}
      />
      {/* Only an aside has a folded line to compose, so the control only
          exists once the row is one — the same way a talk's conference
          fields only appear for a talk. `venue · title` is the default and
          is written as the absence of the field, so the common case adds
          nothing to log.json. */}
      {commit.present === "aside" && (
        <ChoiceField<AsideLine>
          label={S.asideLine}
          value={commit.asideLine ?? "venue-title"}
          options={[
            { value: "venue-title", label: "venue · title" },
            { value: "venue", label: "venue" },
            { value: "title", label: "title" },
          ]}
          onChange={(v) =>
            onUpdate({ asideLine: v === "venue-title" ? undefined : v })
          }
        />
      )}
      <ChoiceField<"" | "en" | "zh" | "both">
        label={S.language}
        value={commit.language ?? ""}
        options={[
          { value: "", label: "—" },
          { value: "en", label: "en" },
          { value: "zh", label: "zh" },
          { value: "both", label: "both" },
        ]}
        onChange={(v) => onUpdate({ language: v === "" ? undefined : v })}
      />
      <ChoiceField<"" | "en" | "zh" | "both">
        label={S.listedIn}
        value={commit.listedIn ?? ""}
        options={[
          { value: "", label: "both" },
          { value: "en", label: "en" },
          { value: "zh", label: "zh" },
          { value: "both", label: "both" },
        ]}
        onChange={(v) => onUpdate({ listedIn: v === "" ? undefined : v })}
      />
      <ChoiceField<"" | "date" | "endDate">
        label={S.sortBy}
        value={commit.sortBy ?? ""}
        options={[
          { value: "", label: S.optDefault },
          { value: "date", label: "date" },
          { value: "endDate", label: "endDate" },
        ]}
        onChange={(v) => onUpdate({ sortBy: v === "" ? undefined : v })}
      />
      <ChoiceField<"" | "graduation-cap">
        label={S.icon}
        value={commit.icon ?? ""}
        options={[
          { value: "", label: S.optDefault },
          { value: "graduation-cap", label: "grad-cap" },
        ]}
        onChange={(v) => onUpdate({ icon: v === "" ? undefined : v })}
      />

      <IdentityRailSection
        commit={commit}
        commits={commits}
        identities={identities}
        onUpdate={onUpdate}
      />

      <SectionLabel>{S.title}</SectionLabel>
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

      <SectionLabel>{S.description}</SectionLabel>
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

      <SectionLabel>{S.team}</SectionLabel>
      <Field
        label="EN"
        value={commit.team?.en ?? ""}
        onChange={(v) =>
          onUpdate({
            team: v || commit.team?.zh
              ? { en: v, zh: commit.team?.zh ?? "" }
              : undefined,
          })
        }
        placeholder="React Core team @ Meta"
      />
      <Field
        label="ZH"
        value={commit.team?.zh ?? ""}
        onChange={(v) =>
          onUpdate({
            team: v || commit.team?.en
              ? { en: commit.team?.en ?? "", zh: v }
              : undefined,
          })
        }
      />

      <SectionLabel>{S.commentary}</SectionLabel>
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
        label={S.keywords}
        items={commit.tags ?? []}
        onChange={(tags) =>
          onUpdate({ tags: tags.length > 0 ? tags : undefined })
        }
        placeholder={S.keywordPlaceholder}
        addTitle={S.addKeyword}
      />

      {/* Type-specific fields */}
      <TypeSpecificFields commit={commit} onUpdate={onUpdate} />

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
// Identity & Rail section
//
// Surfaces the otherwise-invisible identity/rail system: which identity a
// commit resolves to (and *why* — tenure vs explicit vs attached vs detached),
// a control to attach/detach/override it, and a warning when a detached commit
// punches a hole in an otherwise-continuous identity cluster. Mirrors the
// runtime logic in `resolveIdentity` / `computeRail` so the editor readout
// matches what /works actually renders.
// ─────────────────────────────────────────────────────────────────────────────

const ATTACH_AUTO = "__auto__";
const ATTACH_DETACH = "__detach__";
const ROLE_PREFIX = "role:";
const IDENT_PREFIX = "id:";

type Resolution =
  | { kind: "identity"; identityId: string; handle?: string; accent?: string; source: string }
  | { kind: "detached"; note: string }
  | { kind: "none"; note: string };

/** Resolve a commit's effective identity + a human label for *why*. */
function describeResolution(
  commit: Commit,
  tagCommits: Commit[],
  identities: Record<string, Identity>,
  S: WorksStrings,
): Resolution {
  if (commit.type === "event") {
    return { kind: "none", note: S.noteEvent };
  }
  const resolved = resolveIdentity(commit, tagCommits);
  if (!resolved) {
    if (commit.attachedTo === null) {
      return { kind: "detached", note: S.noteDetached };
    }
    return { kind: "none", note: S.noteNoRole };
  }
  const ident = identities[resolved.identityId];
  let source: string;
  if (commit.type === "role") {
    source = S.sourceRole;
  } else if (commit.identityId) {
    source = S.sourceExplicit;
  } else if (
    typeof commit.attachedTo === "string" &&
    tagCommits.some((c) => c.id === commit.attachedTo && c.type === "role")
  ) {
    source = S.sourceAttached(commit.attachedTo);
  } else {
    source = resolved.role ? S.sourceTenureOf(resolved.role.id) : S.sourceTenure;
  }
  return {
    kind: "identity",
    identityId: resolved.identityId,
    handle: ident?.handle,
    accent: ident?.accentColor,
    source,
  };
}

/**
 * Detect the exact failure mode of hand-authored `attachedTo: null`: a
 * detached row whose nearest identity-bearing neighbours (above and below,
 * in render sort order within its tag) belong to the SAME identity. Such a
 * row sits *inside* that identity's bracket and breaks the continuous rail.
 * Returns the identity id it interrupts, or null.
 */
function detectRailHole(commit: Commit, tagCommits: Commit[]): string | null {
  if (resolveIdentity(commit, tagCommits)) return null; // only detached rows
  const sorted = sortCommitsByDate(tagCommits);
  const idx = sorted.findIndex((c) => c.id === commit.id);
  if (idx < 0) return null;
  // Identity of the nearest identity-bearing neighbour, walking `step` rows
  // at a time (−1 = up, +1 = down).
  const nearest = (step: number): string | null => {
    for (let i = idx + step; i >= 0 && i < sorted.length; i += step) {
      const r = resolveIdentity(sorted[i], tagCommits);
      if (r) return r.identityId;
    }
    return null;
  };
  const above = nearest(-1);
  const below = nearest(1);
  return above && below && above === below ? above : null;
}

function IdentityRailSection({
  commit,
  commits,
  identities,
  onUpdate,
}: {
  commit: Commit;
  commits: Commit[];
  identities: Record<string, Identity>;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  const { locale } = useLocale();
  // Rails are computed per-tag (buildTimelineData filters by tag before
  // computeRail), so resolve within the commit's own tag for parity. Derived
  // together in one memo so the filter / sort / identity resolutions don't
  // re-run on unrelated re-renders of the inspector.
  const S = useLabStrings(WORKS_STRINGS);
  const { resolution, hole, roles } = useMemo(() => {
    const tagCommits = commits.filter((c) => c.tagId === commit.tagId);
    return {
      resolution: describeResolution(commit, tagCommits, identities, S),
      hole: detectRailHole(commit, tagCommits),
      roles: tagCommits.filter((c): c is RoleCommit => c.type === "role"),
    };
  }, [commit, commits, identities, S]);
  const identityIds = Object.keys(identities);
  const editable = commit.type !== "role" && commit.type !== "event";

  // ONE mutually-exclusive control for both axes. `identityId` and
  // `attachedTo` overlap (and `identityId` silently wins in resolveIdentity),
  // so exposing them as two independent fields invites contradictory state
  // (e.g. Detach + an identity override). Collapse them into a single choice —
  // Auto / Detach / pin-to-role / pin-to-identity — that can't contradict
  // itself: picking any option clears the other field.
  const anchorValue = commit.identityId
    ? IDENT_PREFIX + commit.identityId
    : commit.attachedTo === null
      ? ATTACH_DETACH
      : typeof commit.attachedTo === "string"
        ? ROLE_PREFIX + commit.attachedTo
        : ATTACH_AUTO;

  const onAnchorChange = (v: string) => {
    if (v === ATTACH_DETACH) onUpdate({ attachedTo: null, identityId: undefined });
    else if (v.startsWith(ROLE_PREFIX))
      onUpdate({ attachedTo: v.slice(ROLE_PREFIX.length), identityId: undefined });
    else if (v.startsWith(IDENT_PREFIX))
      onUpdate({ identityId: v.slice(IDENT_PREFIX.length), attachedTo: undefined });
    else onUpdate({ attachedTo: undefined, identityId: undefined }); // Auto
  };

  return (
    <>
      <SectionLabel>{S.identityRail}</SectionLabel>

      {/* Live resolved readout — the missing "why". */}
      <div className="flex items-start gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right pt-0.5">
          {S.resolved}
        </span>
        <div className="flex-1 text-xs">
          {resolution.kind === "identity" ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <GitBranch className="w-3 h-3 text-tertiary-foreground shrink-0" />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: resolution.accent ?? "var(--muted-foreground)" }}
              />
              <span className="font-medium">{resolution.handle ?? resolution.identityId}</span>
              <span className="font-mono text-[10px] text-tertiary-foreground">
                {resolution.source}
              </span>
            </div>
          ) : resolution.kind === "detached" ? (
            <div className="flex items-center gap-1.5 text-tertiary-foreground">
              <Unlink className="w-3 h-3 shrink-0" />
              <span>{resolution.note}</span>
            </div>
          ) : (
            <span className="text-tertiary-foreground">{resolution.note}</span>
          )}
        </div>
      </div>

      {/* Rail-hole warning — the juejin/feday mistake, caught in-editor. */}
      {hole && (
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0" />
          <div className="flex-1 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {S.railHoleBefore}
              <span className="font-medium">{identities[hole]?.handle ?? hole}</span>
              {S.railHoleMiddle}
              <span className="font-mono">{S.anchor}</span>
              {S.railHoleAfter}
            </span>
          </div>
        </div>
      )}

      {editable && (
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
            {S.anchor}
          </span>
          <select
            value={anchorValue}
            onChange={(e) => onAnchorChange(e.target.value)}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
          >
            <option value={ATTACH_AUTO}>{S.anchorAuto}</option>
            <option value={ATTACH_DETACH}>{S.anchorDetach}</option>
            {roles.length > 0 && (
              <optgroup label={S.pinToRole}>
                {roles.map((r) => (
                  <option key={r.id} value={ROLE_PREFIX + r.id}>
                    {localize(r.title, locale) || r.id}
                  </option>
                ))}
              </optgroup>
            )}
            {identityIds.length > 0 && (
              <optgroup label={S.pinToIdentity}>
                {identityIds.map((id) => (
                  <option key={id} value={IDENT_PREFIX + id}>
                    {identities[id].handle}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}
    </>
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
  const S = useLabStrings(WORKS_STRINGS);
  switch (commit.type) {
    case "project":
      return (
        <>
          <SectionLabel>{S.project}</SectionLabel>
          <Field
            label={S.stars}
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
            label={S.users}
            value={commit.stats?.users ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: { ...commit.stats, users: v || undefined },
              })
            }
          />
          <Field
            label={S.downloads}
            value={commit.stats?.downloads ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: { ...commit.stats, downloads: v || undefined },
              })
            }
          />
        </>
      );

    case "talk":
      return (
        <>
          <SectionLabel>{S.talk}</SectionLabel>
          <Field
            label={S.conference}
            value={commit.conference.name}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, name: v },
              })
            }
          />
          <Field
            label={S.city}
            value={commit.conference.city ?? ""}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, city: v || undefined },
              })
            }
          />
          <Field
            label={S.confUrl}
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
          <SectionLabel>{S.post}</SectionLabel>
          <Field
            label={S.url}
            value={commit.url}
            onChange={(v) => onUpdate({ url: v })}
          />
          <Field
            label={S.publication}
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
          <SectionLabel>{S.role}</SectionLabel>
          <Field
            label={S.identity}
            value={commit.identityId}
            onChange={(v) => onUpdate({ identityId: v })}
            placeholder="meta, bytedance, …"
          />
          <Field
            label={S.companyEn}
            value={commit.company.en}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, en: v } })
            }
          />
          <Field
            label={S.companyZh}
            value={commit.company.zh}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, zh: v } })
            }
          />
          <Field
            label={S.overrideEn}
            value={commit.companyOverride?.en ?? ""}
            onChange={(v) =>
              onUpdate({
                companyOverride: v || commit.companyOverride?.zh
                  ? { en: v, zh: commit.companyOverride?.zh ?? "" }
                  : undefined,
              })
            }
            placeholder="Meta Reality Labs"
          />
          <Field
            label={S.overrideZh}
            value={commit.companyOverride?.zh ?? ""}
            onChange={(v) =>
              onUpdate({
                companyOverride: v || commit.companyOverride?.en
                  ? { en: commit.companyOverride?.en ?? "", zh: v }
                  : undefined,
              })
            }
          />
          <Field
            label={S.location}
            value={commit.location ?? ""}
            onChange={(v) => onUpdate({ location: v || undefined })}
          />
          <Field
            label={S.url}
            value={commit.url ?? ""}
            onChange={(v) => onUpdate({ url: v || undefined })}
          />
          <CheckField
            label={S.hideRow}
            checked={commit.hideRow === true}
            onChange={(v) => onUpdate({ hideRow: v ? true : undefined })}
          />
        </>
      );

    case "press":
      return (
        <>
          <SectionLabel>{S.press}</SectionLabel>
          <Field
            label={S.platform}
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

const mediaKinds: MediaKind[] = ["link", "social-embed", "video", "slides", "image"];

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
  urls?: { en?: string; zh?: string };
  // social-embed
  socialPlatform?: SocialEmbedPlatform;
  // video
  videoPlatform?: VideoPlatform;
  thumbnail?: string;
  // slides
  slidesTitle?: string;
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
        urls: m.urls,
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
    case "slides":
      return {
        kind: "slides",
        ...base,
        thumbnail: m.thumbnail,
        slidesTitle: m.title,
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
        present: "card",
        ...(d.preview ? { preview: d.preview } : {}),
        ...(d.urls?.en || d.urls?.zh
          ? {
              urls: {
                ...(d.urls.en ? { en: d.urls.en } : {}),
                ...(d.urls.zh ? { zh: d.urls.zh } : {}),
              },
            }
          : {}),
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
    case "slides":
      return {
        kind: "slides",
        url: d.url,
        ...(d.thumbnail ? { thumbnail: d.thumbnail } : {}),
        ...(d.slidesTitle ? { title: d.slidesTitle } : {}),
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
  return { kind: "link", url: "", present: "card" };
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
  const S = useLabStrings(WORKS_STRINGS);
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
        <SectionLabel>{S.media}</SectionLabel>
        <button
          onClick={addItem}
          className="p-0.5 text-quaternary-foreground hover:text-muted-foreground rounded transition-colors"
          title={S.addMedia}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {drafts.length === 0 && (
        <div className="text-xs text-quaternary-foreground font-mono pl-[88px]">
          {S.noMedia}
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
  const S = useLabStrings(WORKS_STRINGS);
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
        <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
          {draft.kind}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="p-0.5 text-quaternary-foreground hover:text-red-500 rounded transition-colors"
          title={S.removeMedia}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <ChoiceField<MediaKind>
        label={S.kind}
        value={draft.kind}
        options={mediaKinds.map((k) => ({ value: k, label: S.kindNames[k] }))}
        onChange={(v) => set({ kind: v })}
      />
      <Field
        label={S.url}
        value={draft.url}
        onChange={(v) => set({ url: v })}
        placeholder="https://..."
      />

      {/* Kind-specific fields. Sibling-kind values live in the draft and are
          preserved across kind switches — only the active inputs are shown. */}
      {draft.kind === "link" && (
        <>
          <Field
            label={S.urlEn}
            value={draft.urls?.en ?? ""}
            onChange={(v) =>
              set({
                urls: { ...draft.urls, en: v || undefined },
              })
            }
            placeholder={S.localeVariant}
          />
          <Field
            label={S.urlZh}
            value={draft.urls?.zh ?? ""}
            onChange={(v) =>
              set({
                urls: { ...draft.urls, zh: v || undefined },
              })
            }
            placeholder={S.localeVariant}
          />
          <Field
            label={S.previewTitle}
            value={draft.preview?.title ?? ""}
            onChange={(v) =>
              set({
                preview: {
                  ...draft.preview,
                  title: v || undefined,
                },
              })
            }
            placeholder={S.previewTitlePlaceholder}
          />
          <Field
            label={S.previewDesc}
            value={draft.preview?.description ?? ""}
            onChange={(v) =>
              set({
                preview: {
                  ...draft.preview,
                  description: v || undefined,
                },
              })
            }
            placeholder={S.previewDescPlaceholder}
          />
          <Field
            label={S.previewImage}
            value={draft.preview?.image ?? ""}
            onChange={(v) =>
              set({
                preview: {
                  ...draft.preview,
                  image: v || undefined,
                },
              })
            }
            placeholder={S.previewImagePlaceholder}
          />
        </>
      )}

      {draft.kind === "social-embed" && (
        <ChoiceField<"" | SocialEmbedPlatform>
          label={S.platform}
          value={draft.socialPlatform ?? ""}
          options={[
            { value: "", label: S.platformAuto },
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
            label={S.platform}
            value={draft.videoPlatform ?? "youtube"}
            options={[
              { value: "youtube", label: "YouTube" },
              { value: "bilibili", label: "Bilibili" },
              { value: "vimeo", label: "Vimeo" },
            ]}
            onChange={(v) => set({ videoPlatform: v })}
          />
          <Field
            label={S.thumbnail}
            value={draft.thumbnail ?? ""}
            onChange={(v) => set({ thumbnail: v || undefined })}
            placeholder={S.thumbnailPlaceholder}
          />
        </>
      )}

      {draft.kind === "slides" && (
        <>
          <Field
            label={S.title}
            value={draft.slidesTitle ?? ""}
            onChange={(v) => set({ slidesTitle: v || undefined })}
            placeholder={S.slidesTitlePlaceholder}
          />
          <Field
            label={S.thumbnail}
            value={draft.thumbnail ?? ""}
            onChange={(v) => set({ thumbnail: v || undefined })}
            placeholder={S.coverPlaceholder}
          />
        </>
      )}

      {draft.kind === "image" && (
        <Field
          label={S.alt}
          value={draft.alt ?? ""}
          onChange={(v) => set({ alt: v || undefined })}
          placeholder={S.altPlaceholder}
        />
      )}

      <CheckField
        label={S.pinned}
        checked={draft.pinned === true}
        onChange={(v) => set({ pinned: v || undefined })}
      />
    </div>
  );
}
