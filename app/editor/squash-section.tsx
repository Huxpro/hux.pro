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
// There is nothing here to choose about WHICH fields are shared: that is
// computed, per field and per locale (lib/log-squash.ts), and the panel only
// shows the author the result. What the author does choose is what cannot
// be derived — whether one member is the row (`parent`), a headline where
// the members share none, and how each member relates to the group.
//
// It is also the only way back. A member that has been absorbed no longer
// draws its own row, so the member list here and the member's run in the
// band are between them the entire surface for undoing one.
// =============================================================================

import { useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Commit, LocalizedString, Squash } from "@/lib/log";
import {
  computeCommitHash,
  localize,
  originOf,
  sortCommitsByDate,
} from "@/lib/log";
import {
  factorSquash,
  planSquashes,
  squashWarning,
  type SquashFacts,
} from "@/lib/log-squash";
import { cn } from "@/lib/utils";
import { ChoiceField, Field, SectionLabel } from "./fields";

const LOCALES = ["en", "zh"] as const;

interface SquashSectionProps {
  commit: Commit;
  /** Every commit in the log — the picker is scoped to this one's chapter. */
  commits: Commit[];
  squashes: Squash[];
  onChange: (next: Squash[]) => void;
  /** Select another commit in the inspector (a member, from its row here). */
  onSelectCommit?: (id: string) => void;
}

/** The shared fields, named — what the header will say for this locale. */
function describeShared(facts: SquashFacts): string {
  const named = (
    [
      ["title", facts.shared.title],
      ["venue", facts.shared.venue],
      ["date", facts.shared.date],
      ["language", facts.shared.language],
      ["type", facts.shared.type],
    ] as const
  )
    .filter(([, on]) => on)
    .map(([name]) => name);
  return named.length > 0 ? named.join(", ") : "nothing";
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
      // Readable and stable enough for a hand-edited file — the id is never
      // rendered, it only has to be unique.
      { id: `squash-${commit.id}`, commitIds: [commit.id, otherId] },
    ]);
  };

  const dissolve = () => onChange(squashes.filter((_, i) => i !== index));

  const removeMember = (id: string) => {
    if (!squash) return;
    const rest = squash.commitIds.filter((m) => m !== id);
    // Down to one member it is not a squash any more, so take the whole
    // thing away rather than leaving a one-element group on disk that
    // renders as an ordinary row and reads as a bug next time.
    if (rest.length < 2) return dissolve();
    const relations = { ...squash.relations };
    delete relations[id];
    replace({
      ...squash,
      commitIds: rest,
      parent: squash.parent === id ? undefined : squash.parent,
      relations: Object.keys(relations).length ? relations : undefined,
    });
  };

  // What the row will actually print, in both languages, resolved exactly
  // the way /works does it — same planner, same chapter scope, nothing
  // hidden. A preview built any other way is a second implementation that
  // can disagree with the page while claiming to describe it.
  const preview = useMemo(() => {
    if (!squash) return null;
    const chapter = sortCommitsByDate(
      commits.filter((c) => c.tagId === commit.tagId),
    );
    const plan = planSquashes(chapter, [squash], () => false);
    const resolved = [...plan.byLead.values()][0];
    if (!resolved) return null;
    return Object.fromEntries(
      LOCALES.map((l) => [
        l,
        { facts: factorSquash(resolved, l), warning: squashWarning(resolved, l) },
      ]),
    ) as Record<(typeof LOCALES)[number], { facts: SquashFacts; warning: string | null }>;
  }, [squash, commits, commit.tagId]);

  /** Set one locale of a localized field, dropping the field when empty. */
  const localized = (
    current: LocalizedString | undefined,
    locale: "en" | "zh",
    value: string,
  ): LocalizedString | undefined => {
    const next = { en: current?.en ?? "", zh: current?.zh ?? "", [locale]: value };
    return next.en || next.zh ? next : undefined;
  };

  const setRelation = (id: string, locale: "en" | "zh", value: string) => {
    if (!squash) return;
    const relations = { ...squash.relations };
    const next = localized(relations[id], locale, value);
    if (next) relations[id] = next;
    else delete relations[id];
    replace({
      ...squash,
      relations: Object.keys(relations).length ? relations : undefined,
    });
  };

  const sharedEn = preview && describeShared(preview.en.facts);
  const sharedZh = preview && describeShared(preview.zh.facts);

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
          {/* What the header says and what each member says — computed, not
              chosen. Both languages, because that is where they part: the
              two React for Two Threads talks share a title in English and
              not in Chinese. */}
          {preview && (
            <div className="pl-[5.5rem] space-y-0.5 font-mono text-[10px] leading-relaxed text-tertiary-foreground">
              {sharedEn === sharedZh ? (
                <div>shared · {sharedEn}</div>
              ) : (
                <>
                  <div>shared (en) · {sharedEn}</div>
                  <div>shared (zh) · {sharedZh}</div>
                </>
              )}
            </div>
          )}

          {LOCALES.map((l) =>
            preview?.[l].warning ? (
              <div
                key={l}
                className="flex gap-1.5 pl-[5.5rem] text-xs leading-relaxed text-amber-500/90"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{preview[l].warning}</span>
              </div>
            ) : null,
          )}

          <ChoiceField
            label="Parent"
            variant="dropdown"
            value={squash.parent ?? ""}
            options={[
              { value: "", label: "none — peers, headed by what they share" },
              ...squash.commitIds.map((id) => ({
                value: id,
                // `venue · title`, not the title: members of a group often
                // share their title — that is frequently why they are one —
                // and two identical options are no choice at all.
                label: byId.get(id)
                  ? `${originOf(byId.get(id)!, "en").line} is the row`
                  : `${id} (missing)`,
              })),
            ]}
            onChange={(parent) => replace({ ...squash, parent: parent || undefined })}
          />

          <Field
            label="Headline"
            value={squash.title?.en ?? ""}
            placeholder={preview?.en.facts.headline ?? "derived"}
            onChange={(v) =>
              replace({ ...squash, title: localized(squash.title, "en", v) })
            }
          />
          <Field
            label="标题"
            value={squash.title?.zh ?? ""}
            placeholder={preview?.zh.facts.headline ?? "derived"}
            onChange={(v) =>
              replace({ ...squash, title: localized(squash.title, "zh", v) })
            }
          />
          <Field
            label="Prose"
            multiline
            value={squash.description?.en ?? ""}
            placeholder={
              squash.parent
                ? "defaults to the parent's own description"
                : "none — each member's prose stays its own"
            }
            onChange={(v) =>
              replace({
                ...squash,
                description: localized(squash.description, "en", v),
              })
            }
          />
          <Field
            label="正文"
            multiline
            value={squash.description?.zh ?? ""}
            placeholder={squash.parent ? "默认使用 parent 的描述" : "无 — 各条目的描述留在各自的位置"}
            onChange={(v) =>
              replace({
                ...squash,
                description: localized(squash.description, "zh", v),
              })
            }
          />

          {/* The members, in band order — and the way back to any one of
              them, since an absorbed member draws no row to click. Each
              carries its relation to the group: the one thing about it the
              data could not have derived. */}
          <div className="space-y-2 pt-1">
            {squash.commitIds.map((id) => {
              const member = byId.get(id);
              const line = preview?.en.facts.members.find((m) => m.commit.id === id);
              const isParent = squash.parent === id;
              return (
                <div key={id} className="group/member space-y-1 rounded px-1 -mx-1 hover:bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 font-mono text-[10px] text-quaternary-foreground">
                      {computeCommitHash(id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectCommit?.(id)}
                      disabled={!member}
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-xs",
                        member
                          ? "text-muted-foreground transition-colors hover:text-foreground"
                          : "text-red-500",
                      )}
                      title={member ? "Inspect this commit" : "No such commit"}
                    >
                      {isParent
                        ? localize(member!.title, "en")
                        : (line?.label ??
                          (member ? localize(member.title, "en") : `${id} — missing`))}
                    </button>
                    {isParent && (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-quaternary-foreground">
                        parent
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMember(id)}
                      className="shrink-0 p-0.5 text-quaternary-foreground opacity-0 transition hover:text-red-500 group-hover/member:opacity-100"
                      title="Give this commit its own row back"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {/* The parent is the row, not a member of the band, so it
                      has no relation to label. */}
                  {!isParent && (
                    <div className="flex gap-1.5 pl-16">
                      {LOCALES.map((l) => (
                        <input
                          key={l}
                          type="text"
                          value={squash.relations?.[id]?.[l] ?? ""}
                          onChange={(e) => setRelation(id, l, e.target.value)}
                          placeholder={l === "en" ? "relation (en)" : "关系 (zh)"}
                          className="min-w-0 flex-1 rounded border border-border/50 bg-transparent px-1.5 py-0.5 text-[11px] transition-colors focus:border-foreground/30 focus:outline-none"
                        />
                      ))}
                    </div>
                  )}
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
          <span className="w-20 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
            {squash ? "Add" : "With"}
          </span>
          <select
            value=""
            onChange={(e) => e.target.value && add(e.target.value)}
            className="flex-1 rounded border border-border/50 bg-transparent px-2 py-1 text-sm transition-colors focus:border-foreground/30 focus:outline-none"
          >
            <option value="">{squash ? "add a commit…" : "squash with…"}</option>
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
