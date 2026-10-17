"use client";

import { ArrowUpRight, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode, type RefObject } from "react";
import type { Read } from "reintent-core";
import type { Said, Session, SessionSnapshot } from "reintent-core/lib/session";
import { kindAbout, type About } from "reintent-core/lib/vocab";
import { LabButton, LabChip, LabShell, experienceSrc, labButtonClass, useLabStrings } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { REINTENT_STRINGS, type ReintentStrings } from "./strings";

// =============================================================================
// /lab/reintent: The Wardrobe on Reintent core (packages/reintent-core).
//
// The frame runs experiences/reintent: the Wardrobe's intent tree, rendered
// by the core as a value, and drawn by the Wardrobe's own stage. Its session
// (reintent-core/lib/session) lays itself open as `window.__reintent`, and
// everything here is read from it and done through it: nothing is imported
// from the scene, and nothing here is state but what the frame holds.
// =============================================================================

const SRC = "/scenes/reintent/index.html";

const EXAMPLES = ["帽子大一点", "帽子还要大", "门慢一点", "站到窗边", "别看我", "帽子不要大得离谱", "大一点", "更压抑一点", "床头放一盏灯"];

/**
 * The frame's devtools, once its scene has set them. Polled, like the
 * Inspector's `__scene`: the frame can load before this page hydrates, so its
 * load event is not to be counted on. Null until then; `failed` after a while.
 */
function useDevtools(frame: RefObject<HTMLIFrameElement | null>, key: string) {
  const [found, setFound] = useState<{ key: string; dt: Session | null; failed: boolean }>({ key, dt: null, failed: false });
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

function useDevtoolsSnapshot(dt: Session | null): SessionSnapshot | null {
  const subscribe = useCallback((fn: () => void) => (dt ? dt.subscribe(fn) : () => {}), [dt]);
  const get = useCallback(() => dt?.get() ?? null, [dt]);
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
      <LabButton disabled={!snap?.canUndo} onClick={() => dt?.undo()}>
        <Undo2 />
        {S.undo}
      </LabButton>
      <LabButton disabled={!snap?.log.length} onClick={() => dt?.reset()}>
        <RotateCcw />
        {S.reset}
      </LabButton>
      <a href={src} target="_blank" rel="noopener" className={labButtonClass()}>
        <ArrowUpRight />
        {S.open}
      </a>
    </>
  );

  const meta = snap && <span className={TYPE.rowMeta}>{S.meta(unique(snap.reads).length, snap.asks.length, snap.stale.length)}</span>;

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

/** One read per intent (a render reads an intent once per context it is in). */
const unique = (reads: readonly Read[]) => reads.filter((r, i, a) => a.findIndex((x) => x.path === r.path) === i);
/** A path as the panel shows it: the part and the intent (`Man:man#hat`), the scope left out. */
const short = (path: string) => path.split("/").slice(-1)[0];

function Panel({ S, dt, snap, half }: { S: ReintentStrings; dt: Session; snap: SessionSnapshot; half: Half }) {
  const reads = unique(snap.reads);
  const readOf = (path: string) => reads.find((r) => r.path === path);
  const kindLabel = (r: Read | undefined, k: string) => (r ? half(kindAbout(r, k)?.label, k) : k);
  const version = snap.versions.find((v) => v.id === snap.current);
  // The last time the program changed (a version switched).
  const changed = snap.log.find((e) => e.program)?.program;
  const list = (paths: string[]) => paths.map(short).join(", ") || "—";

  return (
    <>
      <Section title={S.program} note={S.programNote}>
        <div className="flex flex-wrap items-center gap-2">
          {snap.versions.map((v) => (
            <LabChip key={v.id} on={v.id === snap.current} onClick={() => dt.use(v.id)}>
              {v.id}
            </LabChip>
          ))}
          {version && <span className={cn(TYPE.captionQuiet, "min-w-0 flex-1")}>{version.note}</span>}
        </div>
        {changed && (
          <div className={cn(TYPE.rowMeta, "flex flex-wrap gap-x-4 gap-y-1 text-[11px]")}>
            {changed.added.length > 0 && (
              <span>
                {S.added}: {list(changed.added)}
              </span>
            )}
            {changed.removed.length > 0 && (
              <span>
                {S.removed}: {list(changed.removed)}
              </span>
            )}
            <span>
              {S.kept}: {list(changed.kept)}
            </span>
            <span className={changed.waiting.length ? "text-amber-600 dark:text-amber-300" : undefined}>
              {S.suspended}: {list(changed.waiting)}
            </span>
            <span>
              {S.restored}: {list(changed.back)}
            </span>
          </div>
        )}
      </Section>

      <Say S={S} dt={dt} readOf={readOf} kindLabel={kindLabel} />

      {snap.asks.length > 0 && (
        <section className="space-y-3 rounded-xl bg-amber-500/[0.07] p-4">
          <div>
            <h3 className={TYPE.label}>{S.asked}</h3>
            <p className={TYPE.caption}>{S.askedNote}</p>
          </div>
          {snap.asks.map((r) => (
            <div key={r.path} className="space-y-2">
              <p className="text-sm text-foreground">{half((r.about as About | undefined)?.label, short(r.path))}</p>
              <div className="flex flex-wrap gap-1.5">
                {(r.kinds ?? []).map(String).map((k) => (
                  <LabButton key={k} tone="primary" onClick={() => dt.answer({ path: r.path, kind: k, via: "kind" })}>
                    {kindLabel(r, k)} {pct(r.belief?.[k])}
                  </LabButton>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <Section title={S.cells} note={S.cellsNote}>
        <div className="divide-y divide-border/60">
          {reads.map((r) => (
            <IntentRow key={r.path} S={S} dt={dt} r={r} snap={snap} label={half((r.about as About | undefined)?.label, r.name)} kindLabel={kindLabel} />
          ))}
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
      {version?.files?.map((f) => (
        <Details key={f.file} title={`${S.source} · ${f.file}`}>
          {f.source}
        </Details>
      ))}
      <Details title={S.doc} note={S.docNote}>
        {JSON.stringify(snap.source, null, 2)}
      </Details>
    </>
  );
}

function Say({
  S,
  dt,
  readOf,
  kindLabel,
}: {
  S: ReintentStrings;
  dt: Session;
  readOf: (path: string) => Read | undefined;
  kindLabel: (r: Read | undefined, k: string) => string;
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
                  key={`${r.path}=${r.kind}`}
                  tone="primary"
                  onClick={() => {
                    dt.answer(r);
                    setSaid(null);
                  }}
                >
                  {short(r.path)} = {kindLabel(readOf(r.path), r.kind)}
                </LabButton>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function IntentRow({
  S,
  dt,
  r,
  snap,
  label,
  kindLabel,
}: {
  S: ReintentStrings;
  dt: Session;
  r: Read;
  snap: SessionSnapshot;
  label: string;
  kindLabel: (r: Read | undefined, k: string) => string;
}) {
  const decided = snap.decided.includes(r.path);
  const kinds = (r.kinds ?? []).map(String);
  const value = String(r.value);
  const by = r.scope === "deck" ? "deck" : r.by;
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-foreground">
          {label} <span className={TYPE.hash}>{short(r.path)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {r.waiting !== undefined && <Badge tone="warn">{S.waiting(kindLabel(r, String(r.waiting)))}</Badge>}
          {snap.stale.includes(r.path) && <Badge tone="warn">{S.stale}</Badge>}
          <Badge tone={by === "human" || by === "deck" ? "firm" : r.ask ? "ask" : "plain"}>{r.ask ? S.from.ask : S.from[by]}</Badge>
        </span>
      </div>
      {r.belief && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          {kinds.map((k) => (
            <div key={k} title={`${kindLabel(r, k)} ${pct(r.belief?.[k])}`} className={k === value ? "bg-foreground/70" : "bg-foreground/20"} style={{ width: `${(r.belief?.[k] ?? 0) * 100}%` }} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {kinds.map((k) => {
          const out = !!r.not?.includes(k);
          return (
            <LabChip key={k} on={k === value} disabled={out} className={cn(out && "line-through")} onClick={() => dt.decide(r.path, k, `${short(r.path)} = ${k}`)}>
              {kindLabel(r, k)}
              {r.learned?.[k] !== undefined && <span className="opacity-60">· {S.learned}</span>}
            </LabChip>
          );
        })}
        <LabButton title={S.ruleOutTitle} onClick={() => dt.ruleOut(r.path, value)}>
          {S.ruleOut} {kindLabel(r, value)}
        </LabButton>
        {decided && <LabButton onClick={() => dt.forget(r.path)}>{S.forget}</LabButton>}
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
