"use client";

// =============================================================================
// Squash panel — saying that several commits are one row.
//
// The gesture is per-commit even though the data is not: you select a row
// and say what it belongs with, because that is the question you actually
// have while looking at the page. The panel reads and writes the log's
// `squashes` array around that, so the commits themselves are never touched
// — which is the whole point of the feature and would be easy to lose in an
// editor that wrote a field onto each member.
//
// It is also the only way back. A member that has been absorbed no longer
// draws its own row, so the member list here and the clickable lines on the
// row itself are between them the entire surface for undoing one.
// =============================================================================

import { useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Commit, LocalizedString, Squash, SquashAxis } from "@/lib/log";
import { computeCommitHash, localize, sortCommitsByDate } from "@/lib/log";
import {
  DEFAULT_SQUASH_AXIS,
  planSquashes,
  squashHeadline,
  squashLines,
  squashWarning,
} from "@/lib/log-squash";
import { cn } from "@/lib/utils";
import { ChoiceField, Field, SectionLabel } from "./fields";

const AXIS_OPTIONS: { value: SquashAxis; label: string; hint: string }[] = [
  {
    value: "title",
    label: "titles",
    hint: "The lines are the members' titles, so the headline is the venue they share.",
  },
  {
    value: "venue",
    label: "venues",
    hint: "The lines are the members' venues, so the headline is the title they share.",
  },
  {
    value: "venue-title",
    label: "both",
    hint: "The lines are `venue · title`. Nothing is shared, so write the headline yourself.",
  },
  {
    value: "none",
    label: "none",
    hint: "No lines: the lead is the row, and the others are here to hand over their media.",
  },
];

interface SquashSectionProps {
  commit: Commit;
  /** Every commit in the log — the picker is scoped to this one's chapter. */
  commits: Commit[];
  squashes: Squash[];
  onChange: (next: Squash[]) => void;
  /** Select another commit in the inspector (a member, from its row here). */
  onSelectCommit?: (id: string) => void;
}

export function SquashSection({
  commit,
  commits,
  squashes,
  onChange,
  onSelectCommit,
}: SquashSectionProps) {
  const byId = useMemo(
    () => new Map(commits.map((c) => [c.id, c])),
    [commits],
  );

  const index = squashes.findIndex((s) => s.commitIds.includes(commit.id));
  const squash = index >= 0 ? squashes[index] : null;

  // Who this commit could join. Same chapter, because a squash that reached
  // across one would move work into an era it did not happen in — the
  // resolver drops those silently, and a picker that offers them would be
  // offering a no-op. Not already spoken for, because one commit is one row.
  const candidates = useMemo(() => {
    const taken = new Set(squashes.flatMap((s) => s.commitIds));
    return sortCommitsByDate(
      commits.filter(
        (c) =>
          c.tagId === commit.tagId &&
          c.id !== commit.id &&
          !taken.has(c.id) &&
          c.type !== "role",
      ),
    );
  }, [commits, commit.id, commit.tagId, squashes]);

  const replace = (next: Squash) =>
    onChange(squashes.map((s, i) => (i === index ? next : s)));

  const add = (otherId: string) => {
    if (squash) {
      replace({ ...squash, commitIds: [...squash.commitIds, otherId] });
      return;
    }
    onChange([
      ...squashes,
      {
        // Readable and stable enough for a hand-edited file — the id is
        // never rendered, it only has to be unique.
        id: `squash-${commit.id}`,
        commitIds: [commit.id, otherId],
        axis: DEFAULT_SQUASH_AXIS,
      },
    ]);
  };

  const removeMember = (id: string) => {
    if (!squash) return;
    const rest = squash.commitIds.filter((m) => m !== id);
    // Down to one member it is not a squash any more, so take the whole
    // thing away rather than leaving a one-element group on disk that
    // renders as an ordinary row and reads as a bug next time.
    if (rest.length < 2) return dissolve();
    replace({
      ...squash,
      commitIds: rest,
      lead: squash.lead === id ? undefined : squash.lead,
    });
  };

  const dissolve = () => onChange(squashes.filter((_, i) => i !== index));

  // What the row will actually print, resolved exactly the way /works does
  // it — same planner, same chapter scope, nothing hidden. A preview built
  // any other way is a second implementation that can disagree with the
  // page while claiming to describe it.
  const preview = useMemo(() => {
    if (!squash) return null;
    const chapter = sortCommitsByDate(
      commits.filter((c) => c.tagId === commit.tagId),
    );
    const plan = planSquashes(chapter, [squash], () => false);
    const resolved = [...plan.byLead.values()][0];
    if (!resolved) return null;
    return {
      lead: resolved.lead,
      headline: squashHeadline(resolved, "en"),
      lines: squashLines(resolved, "en", computeCommitHash),
      warning: squashWarning(resolved, "en"),
    };
  }, [squash, commits, commit.tagId]);

  const setLocalized = (
    key: "title" | "description",
    locale: "en" | "zh",
    value: string,
  ) => {
    if (!squash) return;
    const current: LocalizedString = squash[key] ?? { en: "", zh: "" };
    const next = { ...current, [locale]: value };
    replace({
      ...squash,
      [key]: next.en || next.zh ? next : undefined,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel>Squash</SectionLabel>
        {squash && (
          <button
            type="button"
            onClick={dissolve}
            className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground hover:text-red-500 transition-colors"
            title="Give every member its own row back"
          >
            unsquash
          </button>
        )}
      </div>

      {!squash ? (
        <p className="text-xs text-tertiary-foreground leading-relaxed">
          Print this commit and others as one row. They stay separate commits
          — only /works is told to read them together.
        </p>
      ) : (
        <>
          <ChoiceField<SquashAxis>
            label="Lines"
            value={squash.axis ?? DEFAULT_SQUASH_AXIS}
            options={AXIS_OPTIONS.map(({ value, label }) => ({ value, label }))}
            onChange={(axis) => replace({ ...squash, axis })}
          />
          <p className="text-xs text-tertiary-foreground leading-relaxed pl-[5.5rem]">
            {
              AXIS_OPTIONS.find(
                (o) => o.value === (squash.axis ?? DEFAULT_SQUASH_AXIS),
              )!.hint
            }
          </p>

          {/* The page degrades silently when an axis claims something the
              commits do not have — it prints the truest line it can and
              says nothing, which is right on /works and useless here. */}
          {preview?.warning && (
            <div className="flex gap-1.5 pl-[5.5rem] text-xs text-amber-500/90 leading-relaxed">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{preview.warning}</span>
            </div>
          )}

          <ChoiceField
            label="Lead"
            variant="dropdown"
            value={squash.lead ?? ""}
            options={[
              { value: "", label: "newest member (auto)" },
              ...squash.commitIds.map((id) => ({
                value: id,
                label: byId.get(id)
                  ? localize(byId.get(id)!.title, "en")
                  : `${id} (missing)`,
              })),
            ]}
            onChange={(lead) =>
              replace({ ...squash, lead: lead || undefined })
            }
          />

          <Field
            label="Headline"
            value={squash.title?.en ?? ""}
            placeholder={preview?.headline ?? "derived from the axis"}
            onChange={(v) => setLocalized("title", "en", v)}
          />
          <Field
            label="标题"
            value={squash.title?.zh ?? ""}
            placeholder={squash.title?.en ?? "derived from the axis"}
            onChange={(v) => setLocalized("title", "zh", v)}
          />
          <Field
            label="Prose"
            multiline
            value={squash.description?.en ?? ""}
            placeholder="defaults to the lead's own description"
            onChange={(v) => setLocalized("description", "en", v)}
          />
          <Field
            label="正文"
            multiline
            value={squash.description?.zh ?? ""}
            placeholder="defaults to the lead's own description"
            onChange={(v) => setLocalized("description", "zh", v)}
          />

          {/* The members, as the row prints them — and the way back to any
              one of them, since an absorbed member draws no row to click. */}
          <div className="space-y-1 pt-1">
            {squash.commitIds.map((id) => {
              const member = byId.get(id);
              const line = preview?.lines.find((l) => l.commitId === id);
              const isLead = preview?.lead.id === id;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 group/member rounded px-1 -mx-1 hover:bg-muted/20"
                >
                  <span className="font-mono text-[10px] text-quaternary-foreground w-14 shrink-0">
                    {computeCommitHash(id)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectCommit?.(id)}
                    disabled={!member}
                    className={cn(
                      "flex-1 min-w-0 truncate text-left text-xs",
                      member
                        ? "text-muted-foreground hover:text-foreground transition-colors"
                        : "text-red-500",
                    )}
                    title={member ? "Inspect this commit" : "No such commit"}
                  >
                    {line?.label ??
                      (member ? localize(member.title, "en") : `${id} — missing`)}
                  </button>
                  {isLead && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground shrink-0">
                      lead
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMember(id)}
                    className="shrink-0 p-0.5 text-quaternary-foreground hover:text-red-500 opacity-0 group-hover/member:opacity-100 transition"
                    title="Give this commit its own row back"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* The picker, whether or not there is a squash yet: the first pick
          creates one, and every later pick widens it. */}
      {candidates.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground w-20 shrink-0 text-right">
            {squash ? "Add" : "With"}
          </span>
          <select
            value=""
            onChange={(e) => e.target.value && add(e.target.value)}
            className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
          >
            <option value="">
              {squash ? "add a commit…" : "squash with…"}
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.date} · {localize(c.title, "en")}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
