"use client";

import { Check, Pause, Play, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { parsePath, reaches, type Declaration, type InstanceView, type LanguageLayer, type Param, type Report, type SceneApi, type Snapshot, type TimelineSpec } from "scene";
import { Slider } from "@/components/ui/slider";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useLabStrings, type LabTable } from "../i18n";
import { LabButton, LabChip } from "./shell";

// =============================================================================
// The inspector: an experience, laid open while it runs.
//
// An experience built on packages/scene opens itself as window.__scene. The
// lab frames it on the same origin, so this reads it straight through the
// frame: the manifest (what is declared), a snapshot (every thing's box, four
// times a second), hit tests, stills, overrides and the verifier.
//
// Four layers, lined up: the words the scene came from (the experience's own
// language layer, read from the scene), what they were taken to mean, the
// declared things and timeline they resolve to, and the instances on stage
// now. Select anything in any layer, or click the frame, and the same thing
// lights up in all four and is boxed on screen. A selected thing's params and
// state are sliders, and so are a selected beat's time and length; moving one
// is an override, which lies over the code and survives the code being
// rewritten (over a param or a beat, an edit; over state, a pin).
// =============================================================================

const en = {
  stills: "Stills",
  play: "Play",
  pause: "Hold",
  verify: "Verify",
  verifying: "Verifying…",
  undeclared: "Draw something undeclared",
  undeclaredOn: "Remove it",
  reset: "Clear overrides",
  waiting: "Waiting for the scene…",
  prompt: "Words",
  promptNote: "The dream as it was told. Underlined words name a thing; select one.",
  concepts: "Meaning",
  conceptsNote: "What the words were taken as: things, parts, places, relations, events, a param.",
  manifest: "Declared",
  manifestNote: "Every thing the code declares, next to where it is drawn: its words, parts, params and state; and the timeline: phases, beats, inputs.",
  runtime: "On stage",
  runtimeNote: "This frame's instances. Boxes are in the scene's own units (390 × 844).",
  params: "Params",
  paramsNote: (k: string) => `Edits to ${k}. They sit over the code's values.`,
  state: "State",
  stateNote: "Driven by the scene every frame. Moving one pins it there.",
  timing: "Timing",
  timingNote: (k: string) => `When ${k} happens, and how long it takes.`,
  inputNote: (k: string) => `What shapes ${k}.`,
  timeline: "Timeline",
  phases: "phases",
  beats: "beats",
  inputs: "inputs",
  phase: "phase",
  thing: "Thing",
  visible: "Visible",
  geometry: "Shape",
  px: "px",
  props: "State",
  hidden: "hidden",
  noBox: "no picture",
  ok: "All checks pass",
  checked: (s: number, p: number, q: number, w: number) => `${s} stills · ${p} names · ${q} params turned · ${w} words resolved`,
  coverage: "claimed",
  unclaimed: "drawn by nothing declared",
  aka: "aka",
  parts: "parts",
  inst: "instances",
  default: "default",
};

const zh: typeof en = {
  stills: "静帧",
  play: "播放",
  pause: "定格",
  verify: "验证",
  verifying: "验证中…",
  undeclared: "画一个未声明的东西",
  undeclaredOn: "撤掉它",
  reset: "清除覆盖",
  waiting: "等待场景…",
  prompt: "原话",
  promptNote: "这个梦原本的讲法。下划线的词指向一个东西，点一下试试。",
  concepts: "理解",
  conceptsNote: "词被理解成了什么：东西、部位、位置、关系、事件，还有一个参数。",
  manifest: "声明",
  manifestNote: "代码声明的每一样东西，就写在画它的地方旁边：别名、部位、参数、状态；还有时间线：阶段、节拍、输入。",
  runtime: "台上",
  runtimeNote: "这一帧里实际存在的实例。框是场景自己的坐标（390 × 844）。",
  params: "参数",
  paramsNote: (k: string) => `对 ${k} 的修改，叠在代码给的值之上。`,
  state: "状态",
  stateNote: "场景每一帧都在驱动它。拖动就是把它钉在那儿。",
  timing: "时间",
  timingNote: (k: string) => `${k} 什么时候发生，持续多久。`,
  inputNote: (k: string) => `决定 ${k} 的数。`,
  timeline: "时间线",
  phases: "阶段",
  beats: "节拍",
  inputs: "输入",
  phase: "阶段",
  thing: "对象",
  visible: "看得见的框",
  geometry: "形状范围",
  px: "像素",
  props: "状态",
  hidden: "被挡住",
  noBox: "不在画面里",
  ok: "全部检查通过",
  checked: (s: number, p: number, q: number, w: number) => `${s} 个静帧 · ${p} 个名字 · 转动了 ${q} 个参数 · ${w} 处词语已解析`,
  coverage: "已认领",
  unclaimed: "不属于任何声明",
  aka: "别名",
  parts: "部位",
  inst: "实例",
  default: "默认",
};

const STRINGS: LabTable<typeof en> = { en, zh };

/** The running scene in a frame, once it has opened itself. */
function useScene(frame: RefObject<HTMLIFrameElement | null>): SceneApi | null {
  const [api, setApi] = useState<SceneApi | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const found = frame.current?.contentWindow?.__scene;
        if (found) {
          setApi(() => found);
          clearInterval(id);
        }
      } catch {
        // Not on this origin (or not yet): keep waiting.
      }
    }, 120);
    return () => clearInterval(id);
  }, [frame]);
  return api;
}

function useSnapshot(api: SceneApi | null): Snapshot | null {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (!api) return;
    let busy = false;
    const id = setInterval(() => {
      if (busy) return;
      busy = true;
      api.snapshot().then(setSnap, () => {}).finally(() => (busy = false));
    }, 250);
    return () => clearInterval(id);
  }, [api]);
  return snap;
}

export interface Inspection {
  api: SceneApi | null;
  snapshot: Snapshot | null;
  selected: string | null;
  select: (ref: string | null) => void;
  report: Report | null;
}

/** The inspector's state, shared by the overlay on the frame and the panel beside it. */
export function useInspection(frame: RefObject<HTMLIFrameElement | null>): Inspection & { setReport: (r: Report | null) => void } {
  const api = useScene(frame);
  const snapshot = useSnapshot(api);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  return { api, snapshot, selected, select: (ref) => setSelected((cur) => (cur === ref ? null : ref)), report, setReport };
}

// -----------------------------------------------------------------------------
// The overlay: boxes over the frame, and clicks back into names.
// -----------------------------------------------------------------------------

type Matrix = Snapshot["toClient"];
const apply = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;

export function InspectorOverlay({ inspection }: { inspection: Inspection }) {
  const { api, snapshot, selected, select } = inspection;
  const S = useLabStrings(STRINGS);
  const ref = useRef<SVGSVGElement>(null);
  if (!snapshot) return null;
  const m = snapshot.toClient;
  const nodes: { path: string; box: NonNullable<InstanceView["visible"]>; geo: InstanceView["geometry"]; on: boolean }[] = [];
  for (const inst of snapshot.instances) {
    for (const n of [inst, ...inst.parts]) {
      const isPart = n.path !== inst.path;
      const on = !!selected && reaches(selected, n.path) && !!parsePath(selected).part === isPart;
      if (isPart && !on) continue;
      if (!on && (inst.entity === "room" || inst.entity === "viewer")) continue;
      if (n.visible) nodes.push({ path: n.path, box: n.visible, geo: n.geometry, on });
    }
  }
  const labels: { x: number; y: number; w: number }[] = [];
  const rect = (b: { x0: number; y0: number; x1: number; y1: number }) => {
    const [x0, y0] = apply(m, b.x0, b.y0);
    const [x1, y1] = apply(m, b.x1, b.y1);
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  };
  const label = (text: string, r: { x: number; y: number; h: number }) => {
    const w = text.length * 6.6;
    let y = r.y > 18 ? r.y - 5 : r.y + r.h + 13;
    const x = Math.max(4, r.x);
    while (labels.some((l) => Math.abs(l.y - y) < 13 && x < l.x + l.w && l.x < x + w)) y += 13;
    labels.push({ x, y, w });
    return { x, y };
  };

  return (
    <svg
      ref={ref}
      className="absolute inset-0 z-10 h-full w-full cursor-crosshair"
      role="img"
      aria-label={S.runtime}
      onClick={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !api) return;
        const hit = api.hitTest(e.clientX - r.left, e.clientY - r.top);
        if (hit) select(hit);
      }}
    >
      {nodes.map(({ path, box, geo, on }) => {
        const r = rect(box);
        const g = on && geo ? rect(geo) : null;
        const l = on ? label(path, r) : null;
        return (
          <g key={path}>
            {g && <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="none" stroke="var(--color-amber-400, #f0a83a)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />}
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={on ? "#f0a83a" : "rgba(210,220,245,0.35)"} strokeWidth={on ? 1.6 : 0.8} />
            {l && (
              <text x={l.x} y={l.y} fontFamily="var(--font-mono)" fontSize="11" fill="#f0a83a" stroke="#05070d" strokeWidth="3" paintOrder="stroke">
                {path}
              </text>
            )}
          </g>
        );
      })}
      {snapshot.unclaimed && snapshot.unclaimed.px > 8 && (() => {
        const r = rect(snapshot.unclaimed);
        const l = label(S.unclaimed, r);
        return (
          <g>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#ef6b5f" strokeWidth="1.6" strokeDasharray="3 2" />
            <text x={l.x} y={l.y} fontFamily="var(--font-mono)" fontSize="11" fill="#ef6b5f" stroke="#05070d" strokeWidth="3" paintOrder="stroke">
              {S.unclaimed}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// The panel: four layers, the controls, the verifier.
// -----------------------------------------------------------------------------

function Layer({ n, title, note, children }: { n: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-border/60 py-5 first:border-t-0 first:pt-0">
      <div className={cn(TYPE.rowMeta, "pt-0.5")}>{n}</div>
      <h2 className={TYPE.label}>{title}</h2>
      <p className={cn(TYPE.caption, "col-start-2 mb-2")}>{note}</p>
      <div className="col-start-2 min-w-0">{children}</div>
    </section>
  );
}

const fmt = (b: InstanceView["visible"]) => (b ? `${b.x0.toFixed(0)},${b.y0.toFixed(0)} ${(b.x1 - b.x0).toFixed(0)}×${(b.y1 - b.y0).toFixed(0)}` : "");

interface Field {
  name: string;
  spec: Param;
  value: unknown;
  overridden: boolean;
}

interface EditGroup {
  /** The override key the fields are set under. */
  key: string;
  title: string;
  note: string;
  fields: Field[];
}

/** What can be turned for a selection: a thing's params and state, a beat's timing, an input's params. */
function editable(
  sel: ReturnType<typeof parsePath>,
  key: string,
  manifest: Declaration[],
  timeline: TimelineSpec | null,
  snapshot: Snapshot | null,
  overrides: Record<string, Record<string, unknown>>,
  S: typeof en,
): EditGroup[] {
  const field = (k: string, name: string, spec: Param, live: unknown): Field => ({
    name,
    spec,
    value: overrides[k]?.[name] ?? live ?? spec.default,
    overridden: overrides[k]?.[name] !== undefined,
  });
  if (sel.entity === "beat" && sel.part && timeline) {
    const name = sel.part.split(".")[0];
    const b = timeline.beats[name];
    const now = snapshot?.timeline.beat[name];
    if (!b) return [];
    const k = `beat.${name}`;
    const fields = [field(k, "at", { kind: "number", default: b.at, min: 0, max: Math.max(10, Math.ceil(b.at * 2)), step: 0.1, unit: "s" }, now?.at)];
    if (b.over !== undefined) fields.push(field(k, "over", { kind: "number", default: b.over, min: 0, max: Math.max(5, Math.ceil(b.over * 3)), step: 0.1, unit: "s" }, now?.over));
    return [{ key: k, title: S.timing, note: S.timingNote(k), fields }];
  }
  if (sel.entity === "input" && sel.part && timeline) {
    const name = sel.part.split(".")[0];
    const params = Object.entries(timeline.inputs?.[name]?.params ?? {});
    const k = `input.${name}`;
    const now = (snapshot?.timeline.input as Record<string, Record<string, unknown>> | undefined)?.[name];
    return params.length ? [{ key: k, title: S.params, note: S.inputNote(k), fields: params.map(([n, spec]) => field(k, n, spec, now?.[n])) }] : [];
  }
  const decl = manifest.find((d) => d.id === sel.entity);
  if (!decl) return [];
  const live = snapshot?.instances.find((i) => (sel.instance ? i.path === key : i.entity === sel.entity));
  const groups: EditGroup[] = [];
  const params = Object.entries(decl.params ?? {});
  const state = Object.entries(decl.state ?? {});
  if (params.length) groups.push({ key, title: S.params, note: S.paramsNote(key), fields: params.map(([n, spec]) => field(key, n, spec, live?.props[n])) });
  if (state.length) groups.push({ key, title: S.state, note: S.stateNote, fields: state.map(([n, spec]) => field(key, n, spec, live?.props[n])) });
  return groups;
}

export function InspectorPanel({ inspection }: { inspection: Inspection & { setReport: (r: Report | null) => void } }) {
  const { api, snapshot, selected, select, report, setReport } = inspection;
  const S = useLabStrings(STRINGS);
  const { locale } = useLocale();
  const [verifying, setVerifying] = useState(false);
  const [undeclared, setUndeclared] = useState(false);
  const [manifest, setManifest] = useState<Declaration[]>([]);
  const [timeline, setTimeline] = useState<TimelineSpec | null>(null);
  const [language, setLanguage] = useState<LanguageLayer | null>(null);
  useEffect(() => {
    if (!api) return;
    const id = setTimeout(() => {
      setManifest(api.manifest());
      setTimeline(api.timeline());
      setLanguage(api.language());
    }, 0);
    return () => clearTimeout(id);
  }, [api]);

  if (!api) return <p className={TYPE.caption}>{S.waiting}</p>;
  const on = (ref: string) => !!selected && reaches(selected, ref);
  const chip = (label: string, ref: string, key?: string) => (
    <button
      key={key ?? label}
      type="button"
      onClick={() => select(ref)}
      className={cn(
        "mb-1 mr-1 inline-block rounded border px-1.5 font-mono text-[11px] leading-5 transition-colors",
        on(ref) ? "border-amber-500 bg-amber-500/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const sel = selected ? parsePath(selected) : null;
  const key = sel ? (sel.instance ? `${sel.entity}[${sel.instance}]` : sel.entity) : "";
  const overrides = api.overrides();
  const groups = sel ? editable(sel, key, manifest, timeline, snapshot, overrides, S) : [];
  const span = (b: { at: number; over?: number }) => `${b.at}${b.over !== undefined ? ` +${b.over}` : ""}s`;

  return (
    <div className="space-y-5">
      {/* Controls: where in the scene, and the two demonstrations. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={TYPE.rowMeta}>{S.stills}</span>
        {api.stills().map((s) => (
          <LabChip key={s.name} on={snapshot?.still === s.name} onClick={() => api.goto(s.name)}>
            {s.label ?? s.name}
          </LabChip>
        ))}
        <LabChip on={!snapshot?.frozen} onClick={() => (snapshot?.frozen ? api.play() : api.goto(snapshot?.still ?? api.stills()[0].name))}>
          {snapshot?.frozen ? <Play /> : <Pause />}
          {snapshot?.frozen ? S.play : S.pause}
        </LabChip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LabButton
          tone="primary"
          disabled={verifying}
          onClick={() => {
            setVerifying(true);
            api.verify().then(setReport).finally(() => setVerifying(false));
          }}
        >
          <ShieldCheck />
          {verifying ? S.verifying : S.verify}
        </LabButton>
        <LabButton
          onClick={() => {
            api.setFlag("undeclared", !undeclared);
            setUndeclared(!undeclared);
            setReport(null);
          }}
        >
          <Sparkles />
          {undeclared ? S.undeclaredOn : S.undeclared}
        </LabButton>
        {Object.keys(overrides).length > 0 && (
          <LabButton onClick={() => api.clearOverrides()}>
            <Undo2 />
            {S.reset}
          </LabButton>
        )}
      </div>

      {report && (
        <div className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
          <div className={report.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {report.ok ? <Check className="mr-1 inline h-3.5 w-3.5" /> : "✗ "}
            {report.ok ? S.ok : `${report.issues.length} × ${report.issues[0]?.check}`}
            <span className="ml-2 text-muted-foreground">{S.checked(report.checked.stills, report.checked.paths, report.checked.params, report.checked.words)}</span>
          </div>
          {report.issues.map((i, k) => (
            <div key={k} className="text-red-600 dark:text-red-400">✗ [{i.check}] {i.message}</div>
          ))}
          {report.perturbations.map((p) => (
            <div key={`${p.still}:${p.path}:${p.param}`} className={p.ok ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}>
              {p.ok ? "✓" : "✗"} {p.path}.{p.param}{p.kind === "state" ? ` (${S.state})` : ""} {p.from.toFixed(2)}→{p.to.toFixed(2)} · {p.moved.length ? p.moved.join(", ") : "—"}
            </div>
          ))}
          <div className="text-muted-foreground">
            {S.coverage} {report.coverage.map((c) => `${c.still} ${(c.ratio * 100).toFixed(2)}%`).join(" · ")}
          </div>
        </div>
      )}

      {groups.map((g) => {
        const k = g.key;
        return (
          <div key={g.title} className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
            <div>
              <div className={TYPE.label}>{g.title}</div>
              <p className={TYPE.caption}>{g.note}</p>
            </div>
            {g.fields.map(({ name, spec, value, overridden }) => (
              <div key={name} className="flex items-center gap-3">
                <span className={cn(TYPE.meta, "w-24 shrink-0")}>
                  {name}
                  {overridden && <span className="text-amber-500"> *</span>}
                </span>
                {spec.kind === "number" ? (
                  <>
                    <Slider
                      value={Number(value)}
                      min={spec.min}
                      max={spec.max}
                      step={spec.step ?? (spec.max - spec.min) / 100}
                      onChange={(v) => api.setOverride(k, name, v)}
                      aria-label={name}
                      className="flex-1"
                    />
                    <span className={cn(TYPE.rowMeta, "w-12 tabular-nums")}>
                      {Number(value).toFixed(2)}
                      {spec.unit ?? ""}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {spec.options.map((o) => (
                      <LabChip key={o} on={value === o} onClick={() => api.setOverride(k, name, o)}>
                        {o}
                      </LabChip>
                    ))}
                  </div>
                )}
                {overridden && (
                  <button type="button" className={cn(TYPE.rowMeta, "hover:text-foreground")} onClick={() => api.setOverride(k, name, undefined)}>
                    {S.default}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <div>
        <Layer n="01" title={S.prompt} note={S.promptNote}>
          <p lang="zh" className="font-serif text-base leading-loose text-reading-foreground">
            {language?.prompt.map((seg, i) =>
              typeof seg === "string" ? (
                <span key={i}>{seg}</span>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(seg[1])}
                  className={cn("border-b-[1.5px] transition-colors", on(seg[1]) ? "border-amber-500 bg-amber-500/15" : "border-border hover:border-amber-500")}
                >
                  {seg[0]}
                </button>
              ),
            )}
          </p>
        </Layer>

        <Layer n="02" title={S.concepts} note={S.conceptsNote}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
            {language?.concepts.map((c) => (
              <button
                key={c.words.en}
                type="button"
                onClick={() => select(c.ref)}
                className={cn(
                  "grid gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
                  on(c.ref) ? "border-amber-500 bg-amber-500/10" : "border-border/60 bg-muted/20 hover:border-border",
                )}
              >
                <span className="text-sm font-medium text-foreground">{c.words[locale]}</span>
                <span className={TYPE.captionQuiet}>{c.kind[locale]}</span>
                <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">→ {c.lands ?? c.ref}</span>
              </button>
            ))}
          </div>
        </Layer>

        <Layer n="03" title={S.manifest} note={S.manifestNote}>
          <div className="grid gap-2">
            {manifest.map((d) => (
              <div key={d.id} className={cn("rounded-lg border p-2.5", on(d.id) && !sel?.part ? "border-amber-500" : "border-border/60")}>
                <div className="flex items-baseline gap-2">
                  <button type="button" onClick={() => select(d.id)} className="font-mono text-sm text-foreground hover:underline">{d.id}</button>
                  <span className={TYPE.rowMeta}>{d.kind}</span>
                  {d.visual === false && <span className={TYPE.rowMeta}>· {S.noBox}</span>}
                </div>
                <dl className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 text-xs">
                  <dt className={TYPE.rowMeta}>{S.aka}</dt>
                  <dd>{d.aka.map((a) => chip(a, d.id, `aka:${a}`))}</dd>
                  {d.parts && d.parts.length > 0 && (
                    <>
                      <dt className={TYPE.rowMeta}>{S.parts}</dt>
                      <dd>{d.parts.map((p) => chip(p, `${d.id}.${p}`))}</dd>
                    </>
                  )}
                  {(["params", "state"] as const).map((group) =>
                    d[group] && Object.keys(d[group]).length > 0 ? (
                      <Fragment key={group}>
                        <dt className={TYPE.rowMeta}>{group === "params" ? S.params : S.state}</dt>
                        <dd>
                          {Object.entries(d[group]).map(([k, p]) =>
                            chip(`${k} ${p.kind === "number" ? `${p.min}–${p.max}` : p.options.join("|")}`, p.affects?.length ? `${d.id}.${p.affects[0]}` : d.id, `${group}:${k}`),
                          )}
                        </dd>
                      </Fragment>
                    ) : null,
                  )}
                  {d.instances && (
                    <>
                      <dt className={TYPE.rowMeta}>{S.inst}</dt>
                      <dd>{Object.entries(d.instances).map(([k, v]) => chip(`[${k}] ${v.split(" · ")[locale === "zh" ? 0 : 1] ?? v}`, `${d.id}[${k}]`))}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
            {timeline && (
              <div className={cn("rounded-lg border p-2.5", ["beat", "phase", "input"].includes(sel?.entity ?? "") ? "border-amber-500" : "border-border/60")}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm text-foreground">{S.timeline}</span>
                  {snapshot?.phase && <span className={TYPE.rowMeta}>{S.phase} · {snapshot.phase}</span>}
                </div>
                <dl className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 text-xs">
                  <dt className={TYPE.rowMeta}>{S.phases}</dt>
                  <dd>{Object.keys(timeline.phases).map((k) => chip(snapshot?.phase === k ? `● ${k}` : k, `phase.${k}`, `phase:${k}`))}</dd>
                  <dt className={TYPE.rowMeta}>{S.beats}</dt>
                  <dd>
                    {Object.entries(timeline.beats).map(([k, b]) => {
                      const now = snapshot?.timeline.beat[k];
                      return chip(`${k} ${span({ at: now?.at ?? b.at, over: b.over === undefined ? undefined : (now?.over ?? b.over) })}`, `beat.${k}`, `beat:${k}`);
                    })}
                  </dd>
                  {timeline.inputs && Object.keys(timeline.inputs).length > 0 && (
                    <>
                      <dt className={TYPE.rowMeta}>{S.inputs}</dt>
                      <dd>{Object.keys(timeline.inputs).map((k) => chip(k, `input.${k}`, `input:${k}`))}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>
        </Layer>

        <Layer n="04" title={S.runtime} note={S.runtimeNote}>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full border-collapse font-mono text-[11.5px] leading-6">
              <thead>
                <tr className="text-left text-tertiary-foreground">
                  <th className="px-2 font-normal">{S.thing}</th>
                  <th className="px-2 font-normal">{S.visible}</th>
                  <th className="px-2 font-normal">{S.px}</th>
                  <th className="px-2 font-normal">{S.props}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot?.instances.flatMap((inst) =>
                  [inst, ...inst.parts].map((n) => {
                    const isPart = n.path !== inst.path;
                    const hit = !!selected && reaches(selected, n.path) && (!!parsePath(selected).part === isPart);
                    return (
                      <tr
                        key={n.path}
                        onClick={() => select(n.path)}
                        className={cn("cursor-pointer border-t border-border/40", hit && "bg-amber-500/15")}
                      >
                        <td className={cn("whitespace-nowrap px-2", isPart ? "pl-5 text-muted-foreground" : "text-foreground")}>
                          {isPart ? n.path.slice(inst.path.length) : n.path}
                          {n.host === "canvas" && <span className="ml-1 text-tertiary-foreground">canvas</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 tabular-nums">{n.visible ? fmt(n.visible) : <span className="text-tertiary-foreground">{n.geometry ? S.hidden : "—"}</span>}</td>
                        <td className="px-2 tabular-nums">{n.visible ? Math.round(n.visible.px) : ""}</td>
                        <td className="whitespace-nowrap px-2 text-muted-foreground">
                          {isPart ? "" : Object.entries(inst.props).map(([k, v]) => `${k} ${typeof v === "number" ? v.toFixed(2) : String(v)}`).join(" · ")}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
          {snapshot && (
            <p className={cn(TYPE.rowMeta, "mt-2")}>
              t {snapshot.t.toFixed(2)} · {snapshot.still ?? "live"}{snapshot.phase ? ` · ${S.phase} ${snapshot.phase}` : ""} · {S.coverage} {(snapshot.coverage * 100).toFixed(2)}%
            </p>
          )}
        </Layer>
      </div>
    </div>
  );
}
