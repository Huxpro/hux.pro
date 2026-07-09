"use client";

import { useEffect, useRef, useState } from "react";
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
} from "@/lib/log";
import { resolveIdentity, sortCommitsByDate } from "@/lib/log";
import { X, Trash2, Plus, Unlink, GitBranch, AlertTriangle } from "lucide-react";
import { commitIcons } from "@/components/log/icons";
import { toast } from "sonner";

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
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "social", "event"];

  return (
    <div className="space-y-2">
      {/* Core fields */}
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
      <ChoiceField<"" | "graduation-cap">
        label="Icon"
        value={commit.icon ?? ""}
        options={[
          { value: "", label: "default" },
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
): Resolution {
  if (commit.type === "event") {
    return { kind: "none", note: "Events never join a rail." };
  }
  const resolved = resolveIdentity(commit, tagCommits);
  if (!resolved) {
    if (commit.attachedTo === null) {
      return { kind: "detached", note: "Force-detached (attachedTo: null)." };
    }
    return { kind: "none", note: "No role covers this date — nothing to attach to." };
  }
  const ident = identities[resolved.identityId];
  let source: string;
  if (commit.type === "role") {
    source = "role — anchors this cluster";
  } else if (commit.identityId) {
    source = "explicit identityId";
  } else if (
    typeof commit.attachedTo === "string" &&
    tagCommits.some((c) => c.id === commit.attachedTo && c.type === "role")
  ) {
    source = `attached → ${commit.attachedTo}`;
  } else {
    source = resolved.role ? `tenure → ${resolved.role.id}` : "tenure";
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
  let above: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    const r = resolveIdentity(sorted[i], tagCommits);
    if (r) { above = r.identityId; break; }
  }
  let below: string | null = null;
  for (let i = idx + 1; i < sorted.length; i++) {
    const r = resolveIdentity(sorted[i], tagCommits);
    if (r) { below = r.identityId; break; }
  }
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
  // Rails are computed per-tag (buildTimelineData filters by tag before
  // computeRail), so resolve within the commit's own tag for parity.
  const tagCommits = commits.filter((c) => c.tagId === commit.tagId);
  const resolution = describeResolution(commit, tagCommits, identities);
  const hole = detectRailHole(commit, tagCommits);

  const roles = tagCommits.filter((c): c is RoleCommit => c.type === "role");
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
      <SectionLabel>Identity &amp; Rail</SectionLabel>

      {/* Live resolved readout — the missing "why". */}
      <div className="flex items-start gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right pt-0.5">
          Resolved
        </span>
        <div className="flex-1 text-xs">
          {resolution.kind === "identity" ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <GitBranch className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: resolution.accent ?? "var(--muted-foreground)" }}
              />
              <span className="font-medium">{resolution.handle ?? resolution.identityId}</span>
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {resolution.source}
              </span>
            </div>
          ) : resolution.kind === "detached" ? (
            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <Unlink className="w-3 h-3 shrink-0" />
              <span>{resolution.note}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/50">{resolution.note}</span>
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
              Detached, but sits inside the{" "}
              <span className="font-medium">{identities[hole]?.handle ?? hole}</span>{" "}
              cluster — this breaks the continuous rail. Set{" "}
              <span className="font-mono">Rail</span> to Auto to reconnect it.
            </span>
          </div>
        </div>
      )}

      {editable && (
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
            Anchor
          </span>
          <select
            value={anchorValue}
            onChange={(e) => onAnchorChange(e.target.value)}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
          >
            <option value={ATTACH_AUTO}>Auto (tenure)</option>
            <option value={ATTACH_DETACH}>Detach (off rail)</option>
            {roles.length > 0 && (
              <optgroup label="Pin to role (rail / beam)">
                {roles.map((r) => (
                  <option key={r.id} value={ROLE_PREFIX + r.id}>
                    {r.title.en || r.id}
                  </option>
                ))}
              </optgroup>
            )}
            {identityIds.length > 0 && (
              <optgroup label="Pin to identity (byline)">
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
