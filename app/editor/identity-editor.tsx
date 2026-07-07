"use client";

import { cn } from "@/lib/utils";
import type { Commit, Identity, RoleCommit } from "@/lib/log";
import {
  formatDateRange,
  formatCommitDate,
  localize,
  resolveIdentity,
  sortCommitsByDate,
} from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import { commitIcons } from "@/components/log/icons";
import { Fingerprint, X, ChevronRight } from "lucide-react";

interface IdentityEditorProps {
  identityId: string;
  identity: Identity;
  /** Full identity map — powers the top switcher. */
  identities: Record<string, Identity>;
  /** Full flat commit list — tenures are filtered from here, and the
   *  resolved-artifact list is computed against it. */
  commits: Commit[];
  locale: Locale;
  onUpdate: (partial: Partial<Identity>) => void;
  onSelectIdentity: (id: string) => void;
  onSelectCommit: (id: string) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small local primitives (identity metadata is a short, flat form)
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-16 shrink-0 text-right">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/40 transition-colors",
          mono && "font-mono text-xs",
        )}
      />
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40 pt-1">
      {children}
    </div>
  );
}

/** Small dashed chip — same token as the canvas/editor state badges. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80 border border-dashed border-amber-500/40 rounded px-1 leading-tight">
      {children}
    </span>
  );
}

export function IdentityEditor({
  identityId,
  identity,
  identities,
  commits,
  locale,
  onUpdate,
  onSelectIdentity,
  onSelectCommit,
  onClose,
}: IdentityEditorProps) {
  // Tenures: this identity's role ranges (most recent first).
  const tenures = sortCommitsByDate(
    commits.filter(
      (c): c is RoleCommit => c.type === "role" && c.identityId === identityId,
    ),
  );

  // Resolved artifacts — the crux of "how does identity actually work":
  // every non-role, non-event commit whose identity RESOLVES to this one
  // (by explicit identityId, attachedTo, or tenure date-window fit). This
  // surfaces the otherwise-implicit association as a concrete list.
  const resolvedArtifacts = sortCommitsByDate(
    commits.filter(
      (c) =>
        c.type !== "role" &&
        c.type !== "event" &&
        resolveIdentity(c, commits)?.identityId === identityId,
    ),
  );

  const ids = Object.keys(identities);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Fingerprint
            className="w-3.5 h-3.5 shrink-0"
            style={identity.accentColor ? { color: identity.accentColor } : undefined}
          />
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
              identity
            </div>
            <div className="text-sm truncate leading-tight font-mono">
              {identity.handle}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted-foreground/50 hover:text-foreground rounded transition-colors shrink-0"
          title="Close inspector"
          aria-label="Close inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Identity switcher — browse the whole map without leaving. */}
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectIdentity(id)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-mono transition-colors border",
                id === identityId
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {id}
            </button>
          ))}
        </div>

        {/* Metadata — the durable "who I was". Handle + company feed every
            byline; accent tints the rail/avatar. */}
        <div className="space-y-2">
          <Field
            label="ID"
            value={identityId}
            onChange={() => {}}
            mono
          />
          <Field
            label="Handle"
            value={identity.handle}
            onChange={(v) => onUpdate({ handle: v })}
            placeholder="@handle or name@host"
            mono
          />
          <Field
            label="Co. EN"
            value={identity.company.en}
            onChange={(v) => onUpdate({ company: { ...identity.company, en: v } })}
          />
          <Field
            label="Co. ZH"
            value={identity.company.zh}
            onChange={(v) => onUpdate({ company: { ...identity.company, zh: v } })}
          />
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-16 shrink-0 text-right">
              Accent
            </span>
            <span
              className="w-5 h-5 shrink-0 rounded border border-border/60"
              style={{ background: identity.accentColor || "transparent" }}
            />
            <input
              type="text"
              value={identity.accentColor ?? ""}
              onChange={(e) => onUpdate({ accentColor: e.target.value || undefined })}
              placeholder="oklch(…) / #hex — rail & avatar tint"
              className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:border-foreground/40 transition-colors"
            />
          </label>
        </div>

        {/* Tenures — the ranges under this identity. Each is a role commit
            you can open to edit. This is the layer commits[] flattens from
            identities[].ranges. */}
        <div className="space-y-1.5">
          <SectionLabel>Tenures · {tenures.length}</SectionLabel>
          {tenures.length === 0 && (
            <div className="text-xs text-muted-foreground/40 font-mono">
              No ranges
            </div>
          )}
          {tenures.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectCommit(r.id)}
              className="w-full text-left border border-border/40 rounded px-2 py-1.5 hover:border-sky-500/50 hover:bg-muted/20 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm truncate flex-1 min-w-0">
                  {localize(r.title, locale)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {r.isEducation && <Chip>edu</Chip>}
                  {r.hideRow && <Chip>hidden</Chip>}
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground" />
                </div>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/45 mt-0.5">
                {formatDateRange(r.date, r.endDate, locale)}
                {r.location ? ` · ${r.location}` : ""}
              </div>
            </button>
          ))}
        </div>

        {/* Resolved artifacts — makes the implicit association explicit:
            these commits render this identity's <handle> + author block
            because their date falls in a tenure (or they point here via
            identityId / attachedTo). Editing a tenure's window changes
            THIS set. */}
        <div className="space-y-1.5">
          <SectionLabel>Resolved artifacts · {resolvedArtifacts.length}</SectionLabel>
          <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
            Commits that render under{" "}
            <span className="font-mono">{identity.handle}</span> — resolved by
            tenure window, <span className="font-mono">identityId</span>, or{" "}
            <span className="font-mono">attachedTo</span>.
          </p>
          {resolvedArtifacts.length === 0 && (
            <div className="text-xs text-muted-foreground/40 font-mono">
              None
            </div>
          )}
          {resolvedArtifacts.map((c) => {
            const Icon = commitIcons[c.type];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCommit(c.id)}
                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/20 transition-colors group"
              >
                <Icon className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                <span className="text-xs truncate flex-1 min-w-0">
                  {localize(c.title, locale)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0">
                  {formatCommitDate(c, locale)}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
