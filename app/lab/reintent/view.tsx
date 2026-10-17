"use client";

import { ArrowUpRight, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode, type RefObject } from "react";
import { cells, kindOf, type Cell, type Snapshot, type Source, type Value } from "reintent-core";
import type { ReintentDevtools, Said } from "reintent-core/devtools";
import { LabButton, LabChip, LabShell, experienceSrc, labButtonClass, useLabStrings } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { REINTENT_STRINGS, type ReintentStrings } from "./strings";

// =============================================================================
// /lab/reintent: The Wardrobe on Reintent core (packages/reintent-core).
//
// The frame runs experiences/reintent: the Wardrobe's own stage, its intents
// held by a core root. The root opens itself as `window.__reintent` (the
// core's devtools protocol), and everything here is read from it and
// dispatched through it: nothing is imported from the scene, and nothing
// here is state but what the frame holds.
// =============================================================================

const SRC = "/scenes/reintent/index.html";

const EXAMPLES = ["帽子大一点", "帽子还要大", "门慢一点", "站到窗边", "别看我", "帽子不要大得离谱", "大一点", "更压抑一点", "床头放一盏灯"];

/**
 * The frame's devtools, once its scene has set them. Polled, like the
 * Inspector's `__scene`: the frame can load before this page hydrates, so its
 * load event is not to be counted on. Null until then; `failed` after a while.
 */
function useDevtools(frame: RefObject<HTMLIFrameElement | null>, key: string) {
  const [found, setFound] = useState<{ key: string; dt: ReintentDevtools | null; failed: boolean }>({ key, dt: null, failed: false });
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      try {
        const dt = frame.current?.contentWindow?.__reintent;
        if (dt) {
          setFound({ key, dt, failed: false });
          clearInterval(id);
          return;
        }
      } catch {
        // Not on this origin (or not yet): keep waiting.
      }
      if (tries === 125) setFound({ key, dt: null, failed: true });
    }, 120);
    return () => clearInterval(id);
  }, [frame, key]);
  // A new frame (another language) starts over.
  return found.key === key ? found : { key, dt: null, failed: false };
}

function useDevtoolsSnapshot(dt: ReintentDevtools | null): Snapshot | null {
  const subscribe = useCallback((fn: () => void) => (dt ? dt.root.subscribe(fn) : () => {}), [dt]);
  const get = useCallback(() => dt?.root.get() ?? null, [dt]);
  return useSyncExternalStore(subscribe, get, () => null);
}

export function ReintentLabView() {
  const S = useLabStrings(REINTENT_STRINGS);
  const { locale } = useLocale();
  const frame = useRef<HTMLIFrameElement>(null);
  const { dt, failed } = useDevtools(frame, locale);
  const snap = useDevtoolsSnapshot(dt);
  const src = experienceSrc(SRC, locale);
  // The kinds' and intents' labels are bilingual ("床头 · the bed's head"): this reader's half.
  const half = (label: string | undefined, fallback: string) => {
    if (!label) return fallback;
    const [zh, en] = label.split(" · ");
    return (locale === "zh" ? zh : en) ?? label;
  };

  const actions = (
    <>
      <LabButton disabled={!snap?.canUndo} onClick={() => dt?.root.undo()}>
        <Undo2 />
        {S.undo}
      </LabButton>
      <LabButton disabled={!snap?.log.length} onClick={() => dt?.root.reset()}>
        <RotateCcw />
        {S.reset}
      </LabButton>
      <a href={src} target="_blank" rel="noopener" className={labButtonClass()}>
        <ArrowUpRight />
        {S.open}
      </a>
    </>
  );

  const meta = snap && <span className={TYPE.rowMeta}>{S.meta(Object.keys(snap.values).length, snap.asks.length, snap.stale.length)}</span>;

  return (
    <LabShell lab="reintent" layout="canvas" meta={meta} actions={actions}>
      <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
        <div className="relative aspect-[390/844] h-[min(74svh,780px)] max-w-full shrink-0 overflow-hidden rounded-[2.25rem] border border-border/60 bg-black shadow-overlay lg:sticky lg:top-[var(--lab-under-bar)]">
          {/* Keyed by language: the scene starts over in the reader's language, and so does its root. */}
          <iframe key={locale} ref={frame} src={src} title="The Wardrobe on Reintent" className="absolute inset-0 h-full w-full border-0" allow="autoplay" />
        </div>
        <div className="w-full min-w-0 max-w-xl space-y-8">
          {!snap && <p className={TYPE.caption}>{failed ? S.failed : S.loading}</p>}
          {dt && snap && <Panel S={S} dt={dt} snap={snap} half={half} />}
        </div>
      </div>
    </LabShell>
  );
}

// -----------------------------------------------------------------------------
// The panel
// -----------------------------------------------------------------------------

type Half = (label: string | undefined, fallback: string) => string;

function Panel({ S, dt, snap, half }: { S: ReintentStrings; dt: ReintentDevtools; snap: Snapshot; half: Half }) {
  const kindLabel = (c: Cell, k: string) => half(kindOf(c, snap.doc, k)?.label, k);
  const all = cells(snap.program);
  const cellOf = (key: string) => all.find((c) => c.key === key)!;
  const current = dt.current();
  const version = dt.versions.find((v) => v.id === current);
  // The last time the program changed (a version switched, an `if` in a part went the other way).
  const changed = snap.log.find((e) => e.program)?.program;

  return (
    <>
      <Section title={S.program} note={S.programNote}>
        <div className="flex flex-wrap items-center gap-2">
          {dt.versions.map((v) => (
            <LabChip key={v.id} on={v.id === current} onClick={() => dt.use(v.id)}>
              {v.id}
            </LabChip>
          ))}
          {version && <span className={cn(TYPE.captionQuiet, "min-w-0 flex-1")}>{version.note}</span>}
        </div>
        {changed && (
          <div className={cn(TYPE.rowMeta, "flex flex-wrap gap-x-4 gap-y-1 text-[11px]")}>
            {changed.added.length > 0 && (
              <span>
                {S.added}: {changed.added.join(", ")}
              </span>
            )}
            {changed.removed.length > 0 && (
              <span>
                {S.removed}: {changed.removed.join(", ")}
              </span>
            )}
            <span>
              {S.kept}: {changed.kept.join(", ") || "—"}
            </span>
            <span className={changed.suspended.length ? "text-amber-600 dark:text-amber-300" : undefined}>
              {S.suspended}: {changed.suspended.join(", ") || "—"}
            </span>
            <span>
              {S.restored}: {changed.restored.join(", ") || "—"}
            </span>
          </div>
        )}
      </Section>

      <Say S={S} dt={dt} cellOf={cellOf} kindLabel={kindLabel} />

      {snap.asks.length > 0 && (
        <section className="space-y-3 rounded-xl bg-amber-500/[0.07] p-4">
          <div>
            <h3 className={TYPE.label}>{S.asked}</h3>
            <p className={TYPE.caption}>{S.askedNote}</p>
          </div>
          {snap.asks.map((v) => {
            const c = cellOf(v.key);
            return (
              <div key={v.key} className="space-y-2">
                <p className="text-sm text-foreground">{half(c.decl.label, v.key)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {v.kinds.map((k) => (
                    <LabButton key={k} tone="primary" onClick={() => dt.answer({ key: v.key, kind: k, via: "kind" })}>
                      {kindLabel(c, k)} {pct(v.p[k])}
                    </LabButton>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Section title={S.cells} note={S.cellsNote}>
        <div className="divide-y divide-border/60">
          {all.map((c) => {
            const v = snap.values[c.key];
            return v ? <CellRow key={c.key} S={S} dt={dt} c={c} v={v} snap={snap} label={half(c.decl.label, c.decl.name)} kindLabel={kindLabel} /> : null;
          })}
        </div>
      </Section>

      <Section title={S.log} note={S.logNote}>
        {snap.log.length === 0 ? (
          <p className={TYPE.captionQuiet}>{S.nothingYet}</p>
        ) : (
          <ol className="space-y-2">
            {snap.log.slice(0, 14).map((e, i) => (
              <li key={snap.log.length - i} className="space-y-0.5">
                <p className="text-[13px] text-foreground">{e.note}</p>
                {e.changes.length > 0 && <p className={cn(TYPE.rowMeta, "text-[11px]")}>{e.changes.join(" · ")}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Details title={S.observe}>{dt.observe()}</Details>
      <Details title={`${S.source} · ${version?.file ?? ""}`}>{version?.source ?? ""}</Details>
      <Details title={S.doc} note={S.docNote}>
        {JSON.stringify(snap.doc, null, 2)}
      </Details>
    </>
  );
}

function Say({
  S,
  dt,
  cellOf,
  kindLabel,
}: {
  S: ReintentStrings;
  dt: ReintentDevtools;
  cellOf: (key: string) => Cell;
  kindLabel: (c: Cell, k: string) => string;
}) {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<(Said & { text: string }) | null>(null);
  const say = (t: string) => {
    if (!t.trim()) return;
    setSaid({ ...dt.say(t), text: t });
    setText("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    say(text);
  };
  return (
    <Section title={S.say} note={S.sayNote}>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={S.sayPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-base text-foreground outline-none placeholder:text-quaternary-foreground focus:border-foreground/40 sm:text-sm"
        />
        <LabButton type="submit" tone="primary" disabled={!text.trim()}>
          {S.send}
        </LabButton>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((x) => (
          <button key={x} type="button" onClick={() => say(x)} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            {x}
          </button>
        ))}
      </div>
      {said && (
        <div className="space-y-2 rounded-lg bg-foreground/[0.04] px-3 py-2">
          <p className="text-[13px] text-foreground">
            “{said.text}” <span className={TYPE.rowMeta}>→ {S.outcomes[said.outcome]}</span>
          </p>
          <p className={cn(TYPE.rowMeta, "text-[11px]")}>{said.done}</p>
          {said.outcome === "ask" && (
            <div className="flex flex-wrap gap-1.5">
              {said.readings.map((r) => (
                <LabButton
                  key={`${r.key}=${r.kind}`}
                  tone="primary"
                  onClick={() => {
                    dt.answer(r);
                    setSaid(null);
                  }}
                >
                  {r.key} = {kindLabel(cellOf(r.key), r.kind)}
                </LabButton>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function CellRow({
  S,
  dt,
  c,
  v,
  snap,
  label,
  kindLabel,
}: {
  S: ReintentStrings;
  dt: ReintentDevtools;
  c: Cell;
  v: Value;
  snap: Snapshot;
  label: string;
  kindLabel: (c: Cell, k: string) => string;
}) {
  const decided = !!snap.doc.decisions[c.key];
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-foreground">
          {label} <span className={TYPE.hash}>{c.key}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {v.stale && <Badge tone="warn">{S.stale}</Badge>}
          <Badge tone={v.source === "person" || v.source === "rule" ? "firm" : v.source === "ask" ? "ask" : "plain"}>{S.from[v.source as Source]}</Badge>
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {v.kinds.map((k) => (
          <div key={k} title={`${kindLabel(c, k)} ${pct(v.p[k])}`} className={k === v.kind ? "bg-foreground/70" : "bg-foreground/20"} style={{ width: `${(v.p[k] ?? 0) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {v.kinds.map((k) => {
          const out = v.not.includes(k);
          return (
            <LabChip key={k} on={k === v.kind} disabled={out} className={cn(out && "line-through")} onClick={() => dt.root.dispatch({ type: "narrow", key: c.key, pick: k, from: "picked" })}>
              {kindLabel(c, k)}
              {kindOf(c, snap.doc, k)?.learned && <span className="opacity-60">· {S.learned}</span>}
            </LabChip>
          );
        })}
        <LabButton title={S.ruleOutTitle} onClick={() => dt.root.dispatch({ type: "narrow", key: c.key, pick: { not: [v.kind] }, from: "ruled out" })}>
          {S.ruleOut} {kindLabel(c, v.kind)}
        </LabButton>
        {decided && <LabButton onClick={() => dt.root.dispatch({ type: "narrow", key: c.key, pick: null })}>{S.forget}</LabButton>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

const pct = (n: number | undefined) => `${Math.round((n ?? 0) * 100)}%`;

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className={TYPE.label}>{title}</h2>
        {note && <p className={TYPE.caption}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Details({ title, note, children }: { title: string; note?: string; children: string }) {
  return (
    <details className="group space-y-2">
      <summary className={cn(TYPE.label, "cursor-pointer select-none")}>{title}</summary>
      {note && <p className={TYPE.caption}>{note}</p>}
      <pre className="max-h-96 overflow-auto rounded-lg bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{children}</pre>
    </details>
  );
}

function Badge({ tone, children }: { tone: "firm" | "ask" | "warn" | "plain"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 font-mono text-[10px] leading-4",
        tone === "firm"
          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
          : tone === "ask"
            ? "bg-red-500/15 text-red-600 dark:text-red-300"
            : tone === "warn"
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
              : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
