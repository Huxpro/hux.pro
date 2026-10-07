"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import promptsJson from "@/content/prompts.json";
import type { BilingualText, NameText, RawPromptsData } from "@/lib/prompts";
import {
  CHECK_LEVELS,
  MAX_VOICES,
  PROMPT_ROW_KINDS,
  bothNames,
  checkPrompts,
  convictionStats,
  plainMarks,
  promptEdges,
  promptRows,
  promptVoices,
  rowMatches,
  type CheckIssue,
  type CheckLevel,
  type ConvictionStats,
  type PromptEdge,
  type PromptRow,
  type PromptRowKind,
} from "@/lib/prompts-lab";
import { PROMPT_TOPICS, topicLabel, type PromptTopic } from "@/lib/prompt-view";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { LabChip, LabSection, LabShell, labButtonClass, useLabStrings } from "@/systems/lab";
import { PROMPTS_STRINGS } from "./strings";

// =============================================================================
// The Prompts Lab: /lab/prompts. content/prompts.json, read as a structure
// rather than as the page /prompt prints. Four views over the same model
// (lib/prompts-lab.ts):
//
//   Map      every entry on its shelf, the graph its refs make, each one measured
//   Voices   everyone the page quotes, grouped across entries
//   Search   every sentence as one list, in both languages
//   Checks   the file's own rules, the ones `pnpm prompts:check` runs
//
// Whatever is picked in any view (an entry, an influence) opens whole in the
// panel beside it, so a question asked in one view is answered in place.
// Read-only: the file is edited by hand, and this is where you look first.
// =============================================================================

const data = promptsJson as unknown as RawPromptsData;

type View = "map" | "voices" | "search" | "checks";
const VIEWS: readonly View[] = ["map", "voices", "search", "checks"];

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** One entry's anchor in the reader's language; the id when it has none. */
function useNames() {
  const { locale } = useLocale();
  const convictions = useMemo(() => new Map(data.convictions.map((c) => [c.id, c])), []);
  const influences = useMemo(() => new Map(data.influences.map((i) => [i.id, i])), []);
  return {
    locale,
    tx: (text: BilingualText | undefined) => (text ? plainMarks(text[locale]) : ""),
    name: (name: NameText | undefined) => (name ? plainMarks(bothNames(name)[locale]) : ""),
    entry: (id: string) => {
      const c = convictions.get(id);
      if (c) return c.anchor?.[locale] ?? c.id;
      const i = influences.get(id);
      return i ? plainMarks(bothNames(i.name)[locale]) : id;
    },
    isConviction: (id: string) => convictions.has(id),
  };
}

export function PromptsLabView() {
  const S = useLabStrings(PROMPTS_STRINGS);
  const [view, setView] = useState<View>("map");
  const [picked, setPicked] = useState<string | null>(null);

  const model = useMemo(() => {
    const rows = promptRows(data);
    const edges = promptEdges(data);
    return {
      rows,
      edges,
      stats: convictionStats(data, edges),
      voices: promptVoices(data, rows),
      issues: checkPrompts(data),
    };
  }, []);

  // The view rides in the hash, so a reading can be linked: /lab/prompts#voices.
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (isView(hash)) setView(hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (next: View) => {
    setView(next);
    history.replaceState(null, "", next === "map" ? window.location.pathname : `#${next}`);
  };

  const errors = model.issues.filter((i) => i.level === "error").length;
  const warnings = model.issues.filter((i) => i.level === "warn").length;
  const statements = model.rows.filter((r) => r.kind !== "instance").length;
  const instances = model.rows.length - statements;

  return (
    <LabShell
      lab="prompts"
      layout="canvas"
      tools={VIEWS.map((v) => (
        <LabChip key={v} on={view === v} onClick={() => go(v)}>
          {S.views[v]}
          {v === "checks" && (errors > 0 || warnings > 0) && (
            <span className={cn("tabular-nums", errors ? "text-red-500" : "text-amber-500")}>
              {errors || warnings}
            </span>
          )}
        </LabChip>
      ))}
      meta={
        <>
          {S.summary(data.convictions.length, statements, instances, data.influences.length)} ·{" "}
          {S.issuesShort(errors, warnings)}
        </>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-12">
          {view === "map" && <MapView model={model} picked={picked} onPick={setPicked} />}
          {view === "voices" && <VoicesView voices={model.voices} onPick={setPicked} />}
          {view === "search" && <SearchView rows={model.rows} onPick={setPicked} />}
          {view === "checks" && <ChecksView issues={model.issues} onPick={setPicked} />}
        </div>
        <Detail
          id={picked}
          rows={model.rows}
          edges={model.edges}
          onPick={setPicked}
          onClose={() => setPicked(null)}
        />
      </div>
    </LabShell>
  );
}

type Model = {
  rows: PromptRow[];
  edges: PromptEdge[];
  stats: ConvictionStats[];
  voices: ReturnType<typeof promptVoices>;
  issues: CheckIssue[];
};

// =============================================================================
// Map
// =============================================================================

function MapView({
  model,
  picked,
  onPick,
}: {
  model: Model;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { locale } = useLocale();
  const maxInstances = Math.max(...model.stats.map((s) => s.instances), 1);
  return (
    <>
      <LabSection title={S.graph} note={S.graphNote}>
        <RefGraph edges={model.edges} picked={picked} onPick={onPick} />
      </LabSection>
      <LabSection title={S.entries} note={S.entriesNote}>
        <div className="grid gap-6 md:grid-cols-3">
          {PROMPT_TOPICS.map((topic) => (
            <div key={topic} className="min-w-0 space-y-3">
              <h3 className={TYPE.labelSm}>{topicLabel(topic, locale)}</h3>
              {model.stats
                .filter((s) => s.topic === topic)
                .map((s) => (
                  <EntryCard
                    key={s.id}
                    stats={s}
                    maxInstances={maxInstances}
                    picked={picked === s.id}
                    onPick={onPick}
                  />
                ))}
            </div>
          ))}
        </div>
      </LabSection>
    </>
  );
}

function EntryCard({
  stats,
  maxInstances,
  picked,
  onPick,
}: {
  stats: ConvictionStats;
  maxInstances: number;
  picked: boolean;
  onPick: (id: string) => void;
}) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { tx, entry } = useNames();
  const c = data.convictions.find((x) => x.id === stats.id)!;
  const total = c.statements.length + stats.instances;
  return (
    <button
      type="button"
      onClick={() => onPick(stats.id)}
      className={cn(
        "block w-full space-y-2.5 rounded-xl border p-3 text-left transition-colors",
        picked ? "border-foreground/60 bg-foreground/[0.04]" : "border-border/50 hover:border-border hover:bg-foreground/[0.02]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={TYPE.rowHeading}>{entry(stats.id)}</span>
        {entry(stats.id) !== stats.id && <span className={TYPE.hash}>{stats.id}</span>}
      </div>
      <p className={cn(TYPE.caption, "line-clamp-2")}>{tx(c.statements[0]?.text)}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5" aria-hidden>
            {Array.from({ length: MAX_VOICES }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full",
                  i < stats.voices ? "bg-foreground/70" : "border border-foreground/25",
                )}
              />
            ))}
          </span>
          <span className={cn(TYPE.labelSm, stats.voices > MAX_VOICES && "text-red-500")}>
            {S.voicesMeter(stats.voices, MAX_VOICES)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/[0.08]">
            <span
              className="block h-full rounded-full bg-foreground/50"
              style={{ width: `${(stats.instances / maxInstances) * 100}%` }}
            />
          </span>
          <span className={TYPE.labelSm}>{S.instancesMeter(stats.instances)}</span>
        </div>
        <p className={TYPE.labelSm}>
          {S.quotedMeter(stats.quoted, total)} · {S.bodyMeter(stats.body.en, stats.body.zh)}
        </p>
        {(stats.linksIn.length > 0 || stats.linksOut.length > 0) && (
          <p className={cn(TYPE.labelSm, "truncate")}>
            {stats.linksIn.length > 0 && <>← {stats.linksIn.map(entry).join(" ")} </>}
            {stats.linksOut.length > 0 && <>→ {stats.linksOut.map(entry).join(" ")}</>}
          </p>
        )}
      </div>
    </button>
  );
}

/**
 * The refs as a picture: three shelves and the influences, one column each,
 * every entry a node. Fixed geometry in a viewBox, so it scales rather than
 * reflows; on a phone it scrolls sideways.
 */
const NODE_W = 150;
const NODE_H = 30;
const ROW = 42;
const COL = 230;
const TOP = 34;

function RefGraph({
  edges,
  picked,
  onPick,
}: {
  edges: PromptEdge[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { locale, entry } = useNames();
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? picked;

  const columns: { key: string; label: string; ids: string[] }[] = [
    ...PROMPT_TOPICS.map((topic: PromptTopic) => ({
      key: topic,
      label: topicLabel(topic, locale),
      ids: data.convictions.filter((c) => c.topics[0] === topic).map((c) => c.id),
    })),
    { key: "influences", label: S.influences, ids: data.influences.map((i) => i.id) },
  ];
  const at = new Map<string, { col: number; x: number; y: number }>();
  columns.forEach((column, col) =>
    column.ids.forEach((id, row) => at.set(id, { col, x: col * COL, y: TOP + row * ROW })),
  );
  const width = (columns.length - 1) * COL + NODE_W + 40;
  const height = TOP + Math.max(...columns.map((c) => c.ids.length)) * ROW;

  const related = (id: string) =>
    !focus || id === focus || edges.some((e) => (e.from === focus && e.to === id) || (e.to === focus && e.from === id));

  const path = (edge: PromptEdge) => {
    const a = at.get(edge.from);
    const b = at.get(edge.to);
    if (!a || !b) return "";
    const ay = a.y + NODE_H / 2;
    const by = b.y + NODE_H / 2;
    if (a.col === b.col) {
      // Within a shelf: an arc out to the right and back.
      const x = a.x + NODE_W;
      const bulge = 28 + Math.abs(by - ay) * 0.15;
      return `M${x},${ay} C${x + bulge},${ay} ${x + bulge},${by} ${x},${by}`;
    }
    const forward = b.col > a.col;
    const x1 = forward ? a.x + NODE_W : a.x;
    const x2 = forward ? b.x : b.x + NODE_W;
    const mid = (x1 + x2) / 2;
    return `M${x1},${ay} C${mid},${ay} ${mid},${by} ${x2},${by}`;
  };

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[720px] max-w-full"
          style={{ width }}
          role="img"
          aria-label={S.graph}
        >
          <defs>
            <marker id="prompts-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-foreground/50" />
            </marker>
          </defs>
          {columns.map((column, col) => (
            <text key={column.key} x={col * COL} y={14} className="fill-muted-foreground font-mono text-[11px]">
              {column.label}
            </text>
          ))}
          {edges.map((edge, i) => {
            const on = !focus || edge.from === focus || edge.to === focus;
            return (
              <path
                key={i}
                d={path(edge)}
                fill="none"
                markerEnd="url(#prompts-arrow)"
                strokeDasharray={edge.kind === "link" ? undefined : edge.kind === "shaped" ? "4 3" : "1.5 3"}
                className={cn(
                  "transition-opacity",
                  edge.kind === "link" ? "stroke-foreground/60" : "stroke-foreground/35",
                  on ? "opacity-100" : "opacity-[0.08]",
                )}
                strokeWidth={on && focus ? 1.5 : 1}
              />
            );
          })}
          {[...at.entries()].map(([id, p]) => {
            const influence = p.col === columns.length - 1;
            const lit = related(id);
            return (
              <g
                key={id}
                transform={`translate(${p.x},${p.y})`}
                className={cn("cursor-pointer transition-opacity", lit ? "opacity-100" : "opacity-30")}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(id)}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={influence ? NODE_H / 2 : 8}
                  className={cn(
                    "fill-background",
                    id === focus ? "stroke-foreground" : "stroke-foreground/25",
                  )}
                />
                <text x={12} y={NODE_H / 2 + 4} className="fill-foreground text-[12px]">
                  {truncate(entry(id), 16)}
                </text>
                {!influence && entry(id) !== id && (
                  <text x={NODE_W - 10} y={NODE_H / 2 + 4} textAnchor="end" className="fill-tertiary-foreground font-mono text-[9px]">
                    {id.length > 9 ? id.slice(0, 8) + "…" : id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className={cn(TYPE.labelSm, "flex flex-wrap gap-x-5 gap-y-1")}>
        <Legend dash={undefined} label={S.legendLink} />
        <Legend dash="4 3" label={S.legendShaped} />
        <Legend dash="1.5 3" label={S.legendQuoted} />
      </div>
    </div>
  );
}

function Legend({ dash, label }: { dash: string | undefined; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="24" height="6" aria-hidden>
        <line x1="0" y1="3" x2="24" y2="3" strokeDasharray={dash} className="stroke-foreground/60" />
      </svg>
      {label}
    </span>
  );
}

function truncate(text: string, n: number) {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

// =============================================================================
// Voices
// =============================================================================

function VoicesView({ voices, onPick }: { voices: Model["voices"]; onPick: (id: string) => void }) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { name, entry } = useNames();
  const [query, setQuery] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [linked, setLinked] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const shown = voices.filter((v) => {
    if (repeat && v.rows.length < 2) return false;
    if (linked && !v.influence) return false;
    const q = query.trim().toLowerCase();
    return !q || v.name.en.toLowerCase().includes(q) || v.name.zh.toLowerCase().includes(q);
  });

  return (
    <LabSection
      title={S.views.voices}
      note={S.voicesNote}
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder={S.filterVoices} />
          <LabChip on={repeat} onClick={() => setRepeat((r) => !r)}>
            {S.repeatOnly}
          </LabChip>
          <LabChip on={linked} onClick={() => setLinked((l) => !l)}>
            {S.linkedOnly}
          </LabChip>
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className={TYPE.caption}>{S.noVoices}</p>
      ) : (
        <ul className="divide-y divide-border/50 border-y border-border/50">
          {shown.map((v) => (
            <li key={v.key}>
              <button
                type="button"
                onClick={() => setOpen(open === v.key ? null : v.key)}
                aria-expanded={open === v.key}
                className="flex w-full items-baseline gap-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.02]"
              >
                <span className={cn(TYPE.rowMeta, "w-8 shrink-0 tabular-nums")}>{S.times(v.rows.length)}</span>
                <span className={cn(TYPE.rowTitle, "min-w-0 shrink-0")}>{name(v.name)}</span>
                {v.influence && (
                  <span className="shrink-0 rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">
                    {v.influence}
                  </span>
                )}
                <span className={cn(TYPE.labelSm, "min-w-0 truncate")}>{v.convictions.map(entry).join(" · ")}</span>
              </button>
              {open === v.key && (
                <ul className="space-y-2 pb-3 pl-11">
                  {v.rows.map((row) => (
                    <RowLine key={row.key} row={row} onPick={onPick} showEntry />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </LabSection>
  );
}

// =============================================================================
// Search
// =============================================================================

function SearchView({ rows, onPick }: { rows: PromptRow[]; onPick: (id: string) => void }) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<PromptTopic[]>([]);
  const [kinds, setKinds] = useState<PromptRowKind[]>([]);
  const [borrowed, setBorrowed] = useState<"all" | "borrowed" | "mine">("all");

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const shown = rows.filter(
    (row) =>
      (topics.length === 0 || topics.includes(row.topic)) &&
      (kinds.length === 0 || kinds.includes(row.kind)) &&
      (borrowed === "all" || (borrowed === "borrowed") === !!row.from) &&
      rowMatches(row, query),
  );

  return (
    <LabSection title={S.views.search} note={S.searchNote}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder={S.searchPlaceholder} autoFocus />
        {PROMPT_TOPICS.map((t) => (
          <LabChip key={t} on={topics.includes(t)} onClick={() => setTopics(toggle(topics, t))}>
            {topicLabel(t, locale)}
          </LabChip>
        ))}
        {PROMPT_ROW_KINDS.map((k) => (
          <LabChip key={k} on={kinds.includes(k)} onClick={() => setKinds(toggle(kinds, k))}>
            {S.kinds[k]}
          </LabChip>
        ))}
        <LabChip on={borrowed === "borrowed"} onClick={() => setBorrowed(borrowed === "borrowed" ? "all" : "borrowed")}>
          {S.borrowed}
        </LabChip>
        <LabChip on={borrowed === "mine"} onClick={() => setBorrowed(borrowed === "mine" ? "all" : "mine")}>
          {S.mine}
        </LabChip>
      </div>
      <p className={TYPE.labelSm}>{S.results(shown.length)}</p>
      {shown.length === 0 ? (
        <p className={TYPE.caption}>{S.noResults}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => (
            <RowLine key={row.key} row={row} onPick={onPick} showEntry showOther />
          ))}
        </ul>
      )}
    </LabSection>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="search"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none sm:w-64",
        "placeholder:text-tertiary-foreground focus-visible:border-foreground/40",
      )}
    />
  );
}

/** One sentence: where it sits, what it is, its words, whose they are. */
function RowLine({
  row,
  onPick,
  showEntry,
  showOther,
}: {
  row: PromptRow;
  onPick: (id: string) => void;
  showEntry?: boolean;
  /** The other language under it, quieter: the two halves are rarely translations. */
  showOther?: boolean;
}) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { locale, tx, name, entry } = useNames();
  const other = locale === "en" ? "zh" : "en";
  return (
    <li className="space-y-1">
      <div className={cn(TYPE.labelSm, "flex flex-wrap items-baseline gap-x-2")}>
        {showEntry && (
          <button
            type="button"
            onClick={() => onPick(row.conviction)}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {entry(row.conviction)}
          </button>
        )}
        <span>{S.kinds[row.kind]}</span>
        {row.facet && <span>· {tx(row.facet)}</span>}
        {row.ref && (
          <button
            type="button"
            onClick={() => onPick(row.ref!)}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            → {entry(row.ref)}
          </button>
        )}
      </div>
      {row.title && <p className={TYPE.rowHeading}>{tx(row.title)}</p>}
      <p className={cn(TYPE.body, "text-foreground/90")}>{tx(row.text)}</p>
      {showOther && <p className={TYPE.captionQuiet}>{plainMarks(row.text[other])}</p>}
      {row.from && (
        <p className={TYPE.labelSm}>
          — {name(row.from.name)}
          {row.from.source && <>, {name(row.from.source)}</>}
          {row.from.ref && <span className="ml-1.5 text-quaternary-foreground">[{row.from.ref}]</span>}
        </p>
      )}
    </li>
  );
}

// =============================================================================
// Checks
// =============================================================================

const LEVEL_ICON: Record<CheckLevel, ReactNode> = {
  error: <CircleAlert className="h-3.5 w-3.5 text-red-500" />,
  warn: <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />,
  info: <Info className="h-3.5 w-3.5 text-muted-foreground" />,
};

function ChecksView({ issues, onPick }: { issues: CheckIssue[]; onPick: (id: string) => void }) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { tx, entry } = useNames();
  if (issues.length === 0)
    return (
      <LabSection title={S.views.checks} note={S.checksNote}>
        <p className={cn(TYPE.body, "inline-flex items-center gap-2")}>
          <CircleCheck className="h-4 w-4 text-emerald-500" />
          {S.allClear}
        </p>
      </LabSection>
    );
  return (
    <LabSection title={S.views.checks} note={S.checksNote}>
      <div className="space-y-8">
        {CHECK_LEVELS.map((level) => {
          const list = issues.filter((i) => i.level === level);
          if (list.length === 0) return null;
          return (
            <div key={level} className="space-y-2">
              <h3 className={cn(TYPE.labelSm, "flex items-center gap-1.5")}>
                {LEVEL_ICON[level]}
                {S.levels[level]} · {list.length}
              </h3>
              <ul className="divide-y divide-border/50 border-y border-border/50">
                {list.map((issue, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                    <span className={cn(TYPE.hash, "w-32 shrink-0")}>{issue.rule}</span>
                    <button
                      type="button"
                      onClick={() => onPick(issue.where)}
                      className={cn(TYPE.rowMeta, "shrink-0 underline-offset-2 hover:text-foreground hover:underline")}
                    >
                      {entry(issue.where)}
                    </button>
                    <span className={cn(TYPE.body, "min-w-0 basis-full sm:basis-auto sm:flex-1")}>{tx(issue.message)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </LabSection>
  );
}

// =============================================================================
// Detail: whatever is picked, whole
// =============================================================================

function Detail({
  id,
  rows,
  edges,
  onPick,
  onClose,
}: {
  id: string | null;
  rows: PromptRow[];
  edges: PromptEdge[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const S = useLabStrings(PROMPTS_STRINGS);
  const { locale, tx, name, entry, isConviction } = useNames();
  const ref = useRef<HTMLElement>(null);

  // Narrower than the panel's column, it sits above the views: bring it
  // into sight when something far down a list is picked.
  useEffect(() => {
    if (id && window.innerWidth < 1024) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);

  const shell = (children: ReactNode) => (
    <aside
      ref={ref}
      className={cn(
        "ink-flat order-first w-full shrink-0 scroll-mt-[var(--lab-under-bar)] self-start rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl lg:order-none",
        "lg:sticky lg:top-[var(--lab-under-bar)] lg:max-h-[calc(100svh-var(--lab-under-bar)-1rem)] lg:w-[380px] lg:overflow-y-auto",
        !id && "hidden lg:block",
      )}
    >
      {children}
    </aside>
  );

  if (!id) return shell(<p className={cn(TYPE.caption, "p-5")}>{S.detailEmpty}</p>);

  const header = (title: string, mark: string, href?: string) => (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
      <div className="min-w-0 space-y-0.5">
        <p className={TYPE.rowHeading}>{title}</p>
        <p className={TYPE.hash}>{mark}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {href && (
          <Link href={href} className={labButtonClass()} title={S.openOnPrompt}>
            /prompt
            <ArrowUpRight />
          </Link>
        )}
        <button type="button" onClick={onClose} aria-label={S.close} className={labButtonClass()}>
          <X />
        </button>
      </div>
    </div>
  );

  if (isConviction(id)) {
    const c = data.convictions.find((x) => x.id === id)!;
    const own = rows.filter((r) => r.conviction === id);
    const anchor = c.anchor?.[locale] ?? c.id;
    return shell(
      <>
        {header(entry(id), `${id} · ${c.topics.map((t) => topicLabel(t, locale)).join(" · ")}`, `/prompt#${encodeURIComponent(anchor)}`)}
        {c.shapedBy && c.shapedBy.length > 0 && (
          <p className={cn(TYPE.labelSm, "border-b border-border/60 px-5 py-3")}>
            {S.shapedBy}:{" "}
            {c.shapedBy.map((s, i) => (
              <span key={s}>
                {i > 0 && " · "}
                <button type="button" onClick={() => onPick(s)} className="hover:text-foreground hover:underline">
                  {entry(s)}
                </button>
              </span>
            ))}
          </p>
        )}
        <ul className="space-y-4 px-5 py-4">
          {own.map((row) => (
            <RowLine key={row.key} row={row} onPick={onPick} />
          ))}
        </ul>
        {c.body && (
          <div className="space-y-2 border-t border-border/60 px-5 py-4">
            {tx(c.body)
              .split("\n")
              .map((p, i) => (
                <p key={i} className={TYPE.caption}>
                  {p}
                </p>
              ))}
          </div>
        )}
      </>,
    );
  }

  const influence = data.influences.find((i) => i.id === id);
  if (!influence) return shell(<p className={cn(TYPE.caption, "p-5")}>{S.detailEmpty}</p>);
  const shapes = edges.filter((e) => e.from === id && e.kind === "shaped").map((e) => e.to);
  const quoted = edges.filter((e) => e.from === id && e.kind === "quoted").map((e) => e.to);
  const list = (label: string, ids: string[]) =>
    ids.length > 0 && (
      <p className={TYPE.labelSm}>
        {label}:{" "}
        {ids.map((c, i) => (
          <span key={c}>
            {i > 0 && " · "}
            <button type="button" onClick={() => onPick(c)} className="hover:text-foreground hover:underline">
              {entry(c)}
            </button>
          </span>
        ))}
      </p>
    );
  return shell(
    <>
      {header(name(influence.name), `${id} · ${influence.kind}`, `/prompt#${encodeURIComponent(influence.anchor?.[locale] ?? id)}`)}
      <div className="space-y-3 px-5 py-4">
        {influence.context && <p className={TYPE.caption}>{tx(influence.context)}</p>}
        {list(S.shapes, shapes)}
        {list(S.quotedIn, quoted)}
        {influence.body &&
          tx(influence.body)
            .split("\n")
            .map((p, i) => (
              <p key={i} className={TYPE.caption}>
                {p}
              </p>
            ))}
      </div>
    </>,
  );
}
