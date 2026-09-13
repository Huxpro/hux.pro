"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { EditorSwitcher } from "../editor-switcher";
import {
  BAND_LABEL,
  STATUS_META,
  SURFACES,
  bandOf,
  surfaceStyle,
  toBlurPx,
  type Plane,
  type Shadow,
  type SurfaceSpec,
} from "./model";

// ---------------------------------------------------------------------------
// Editorial backdrop — glass is invisible without high-frequency content
// behind it, so every specimen floats over a few lines of muted prose. This is
// the most honest demo: it's literally what these surfaces do on the site.
// ---------------------------------------------------------------------------
const BACKDROP_LINES = [
  "the surface is not the desktop —",
  "it is a mirror of what is relevant now,",
  "ambient over explicit, presence not structure.",
  "frosted glass over a calm editorial plane,",
  "layered by height and by how much it insists.",
  "a well-printed essay on a modern screen —",
  "quiet confidence, motion that explains,",
  "conversation as navigation, fluid boundaries.",
];

function ContentBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 overflow-hidden select-none pointer-events-none",
        className
      )}
    >
      <div className="p-5 space-y-2">
        {BACKDROP_LINES.map((line, i) => (
          <p
            key={i}
            className={cn(
              "font-serif leading-relaxed",
              i % 3 === 0 ? "text-foreground/45" : "text-muted-foreground/35",
              i % 2 === 0 ? "text-lg" : "text-base italic"
            )}
          >
            {line}
          </p>
        ))}
      </div>
      {/* faint colour accents so the frost has something to bend */}
      <div className="absolute -left-8 top-4 h-24 w-24 rounded-full bg-sky-500/20 blur-2xl" />
      <div className="absolute right-6 bottom-2 h-28 w-28 rounded-full bg-amber-500/15 blur-2xl" />
      <div className="absolute left-1/2 top-1/3 h-20 w-20 rounded-full bg-violet-500/15 blur-2xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// A live specimen — the real recipe rendered as inline style, with generic
// inner content so every surface is comparable.
// ---------------------------------------------------------------------------
function SurfaceSpecimen({
  style,
  size = "md",
  label,
}: {
  style: React.CSSProperties;
  size?: "chip" | "md" | "lg";
  label?: string;
}) {
  if (size === "chip") {
    return <div style={style} className="h-full w-full" />;
  }
  return (
    <div
      style={style}
      className={cn(
        "relative flex flex-col justify-center gap-2 text-foreground",
        size === "lg" ? "px-6 py-5 min-h-[150px]" : "px-5 py-4 min-h-[112px]"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
          λ
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {label ?? "sample surface"}
        </span>
      </div>
      <div className="text-sm font-medium">A surface, floating over the page</div>
      <div className="flex gap-2 pt-1">
        <span className="rounded-md bg-foreground text-background text-xs font-medium px-3 py-1.5">
          Primary
        </span>
        <span className="rounded-md border border-border/60 text-muted-foreground text-xs font-medium px-3 py-1.5">
          Secondary
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plot geometry — map (alpha, z) → (x%, y%). Small deterministic nudges pull
// coincident points apart without lying much about their coordinates.
// ---------------------------------------------------------------------------
const NUDGE: Record<string, [number, number]> = {
  "live-panel": [-3.2, 0],
  "toast-conflict": [3.2, -1.5],
  "live-pill": [-3.2, 0],
  "toast-switch": [3.2, 0],
  devtool: [-3, 0],
  "toast-bug": [3.4, -2],
  peek: [4, 0],
  "pip-overlay": [0, 2.5],
  "glass-capsule": [0, -3],
};

function plotPos(spec: SurfaceSpec): { x: number; y: number } {
  const [dx, dy] = NUDGE[spec.id] ?? [0, 0];
  const x = ((spec.alpha - 38) / (102 - 38)) * 82 + 9 + dx;
  const y = (spec.z / 2) * 74 + 12 + dy;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(4, Math.min(94, y)) };
}

function ScatterPlot({
  selected,
  onSelect,
  showBands,
}: {
  selected: string;
  onSelect: (id: string) => void;
  showBands: boolean;
}) {
  return (
    <div className="relative w-full aspect-[10/9] sm:aspect-[16/11] rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
      {/* faint dot grid so the whole field reads as a plane */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5] dark:opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--border) 90%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* presence bands (α) */}
      {showBands && (
        <div aria-hidden className="absolute inset-0">
          <div
            className="absolute inset-y-0 left-0 bg-violet-500/[0.06] border-r border-dashed border-border/40"
            style={{ width: `${((65 - 38) / 64) * 82 + 9}%` }}
          />
          <div
            className="absolute inset-y-0 bg-sky-500/[0.06]"
            style={{
              left: `${((65 - 38) / 64) * 82 + 9}%`,
              width: `${((72 - 65) / 64) * 82}%`,
            }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-rose-500/[0.05] border-l border-dashed border-border/40"
            style={{ left: `${((72 - 38) / 64) * 82 + 9}%` }}
          />
        </div>
      )}

      {/* axis labels */}
      <div className="absolute left-3 top-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 pointer-events-none">
        ↑ elevation (z) · shadow
      </div>
      <div className="absolute right-3 bottom-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 pointer-events-none">
        presence (α) →
      </div>
      <div className="absolute left-3 bottom-2.5 text-[10px] font-mono text-muted-foreground/50 pointer-events-none">
        flush · transparent
      </div>
      <div className="absolute right-3 top-3 text-[10px] font-mono text-muted-foreground/50 pointer-events-none">
        overlay · solid
      </div>

      {/* nodes */}
      {SURFACES.map((spec) => {
        const { x, y } = plotPos(spec);
        const isSel = spec.id === selected;
        const hue = STATUS_META[spec.status ?? "canonical"].hue;
        const chip = surfaceStyle({
          plane: spec.plane,
          alpha: spec.alpha,
          blur: spec.blur,
          shadow: spec.shadow,
          border: spec.border,
          radius: spec.plane === "media" ? 999 : 12,
        });
        return (
          <button
            key={spec.id}
            onClick={() => onSelect(spec.id)}
            className={cn(
              "absolute -translate-x-1/2 translate-y-1/2 group",
              "transition-all duration-300 ease-out focus:outline-none"
            )}
            style={{ left: `${x}%`, bottom: `${y}%`, zIndex: isSel ? 40 : 10 }}
            aria-label={spec.name}
          >
            <span
              className={cn(
                "block rounded-xl transition-all duration-300",
                isSel ? "h-14 w-14" : "h-11 w-11 group-hover:h-12 group-hover:w-12"
              )}
              style={{
                ...chip,
                outline: isSel
                  ? `2px solid hsl(${hue} 70% 55%)`
                  : `1px solid hsl(${hue} 60% 55% / 0.5)`,
                outlineOffset: 2,
              }}
            />
            {/* status dot */}
            <span
              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background"
              style={{ background: `hsl(${hue} 70% 55%)` }}
            />
            {/* label on hover / selection */}
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap",
                "text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/90 border border-border/50",
                "transition-opacity duration-200",
                isSel
                  ? "opacity-100 text-foreground"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground"
              )}
            >
              {spec.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric readout for the selected surface.
// ---------------------------------------------------------------------------
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-mono text-foreground">{value}</span>
    </div>
  );
}

function DetailPane({ spec }: { spec: SurfaceSpec }) {
  const band = bandOf(spec.plane, spec.alpha);
  const meta = STATUS_META[spec.status ?? "canonical"];
  const style = surfaceStyle({
    plane: spec.plane,
    alpha: spec.alpha,
    blur: spec.blur,
    shadow: spec.shadow,
    border: spec.border,
    radius: spec.radius > 32 ? 20 : spec.radius,
  });
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: `hsl(${meta.hue} 70% 55%)` }}
          />
          <h2 className="text-lg font-medium text-foreground">{spec.name}</h2>
          <span
            className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{
              color: `hsl(${meta.hue} 60% 55%)`,
              borderColor: `hsl(${meta.hue} 60% 55% / 0.4)`,
            }}
          >
            {meta.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{spec.role}</p>
        <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
          {spec.file}
        </p>
      </div>

      {/* live specimen over the editorial backdrop */}
      <div className="relative rounded-xl border border-border/40 overflow-hidden bg-background">
        <ContentBackdrop />
        <div className="relative p-6 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <SurfaceSpecimen style={style} size="md" label={spec.id} />
          </div>
        </div>
      </div>

      {/* spec sheet */}
      <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-2">
        <Metric label="plane" value={`--${spec.plane}`} />
        <Metric
          label="presence α"
          value={
            <span>
              {spec.alpha}
              <span
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background:
                    band === "glass"
                      ? "hsl(205 70% 55% / 0.15)"
                      : band === "solid"
                        ? "hsl(5 70% 55% / 0.15)"
                        : "hsl(275 60% 60% / 0.15)",
                  color:
                    band === "glass"
                      ? "hsl(205 70% 60%)"
                      : band === "solid"
                        ? "hsl(5 70% 62%)"
                        : "hsl(275 60% 68%)",
                }}
              >
                {BAND_LABEL[band]}
              </span>
            </span>
          }
        />
        <Metric
          label="blur"
          value={`${toBlurPx(spec.blur)}px${typeof spec.blur === "string" ? ` · ${spec.blur}` : " · xl"}`}
        />
        <Metric label="shadow (z)" value={spec.shadow} />
        <Metric
          label="border"
          value={spec.border == null ? "none" : `border/${spec.border}`}
        />
        <Metric label="elevation rank" value={spec.z.toFixed(1)} />
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">{spec.note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control.
// ---------------------------------------------------------------------------
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/50 bg-card/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 text-xs font-mono rounded-md transition-colors",
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-mono text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground h-1.5 cursor-pointer"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Playground — drive the two axes by hand and feel the difference.
// ---------------------------------------------------------------------------
const PLANE_OPTS = [
  { value: "background" as Plane, label: "background" },
  { value: "card" as Plane, label: "card" },
  { value: "popover" as Plane, label: "popover" },
  { value: "media" as Plane, label: "media" },
];
const SHADOW_OPTS = [
  { value: "none" as Shadow, label: "none" },
  { value: "raised" as Shadow, label: "raised" },
  { value: "overlay" as Shadow, label: "overlay" },
];

function Playground() {
  const [plane, setPlane] = useState<Plane>("card");
  const [alpha, setAlpha] = useState(70);
  const [blur, setBlur] = useState(24);
  const [shadow, setShadow] = useState<Shadow>("overlay");
  const [hasBorder, setHasBorder] = useState(true);
  const [borderA, setBorderA] = useState(50);
  const [radius, setRadius] = useState(16);

  const band = bandOf(plane, alpha);
  const style = surfaceStyle({
    plane,
    alpha,
    blur,
    shadow,
    border: hasBorder ? borderA : null,
    radius,
  });

  // Diagnose contradictions — the same physics that flagged the lang-toast bug.
  const verdicts: { tone: "warn" | "ok" | "info"; text: string }[] = [];
  if (blur >= 12 && alpha >= 88) {
    verdicts.push({
      tone: "warn",
      text: "frost 被高 α 抹掉了：blur 还在，但 α≥88 几乎不透光 — 正是 lang-toast 当初的 bug。",
    });
  }
  if (plane === "background" && alpha >= 85 && shadow !== "none") {
    verdicts.push({
      tone: "warn",
      text: "错穿平面：一个投影的浮层却用 background 基色 — 它会读成 chrome/实心板。浮层请用 card。",
    });
  }
  if (plane === "card" && band === "solid") {
    verdicts.push({
      tone: "info",
      text: "偏离 glass 档：card 平面通常落在 α 50–70。更实 = 更像按钮而非面板。",
    });
  }
  const sanctioned =
    plane === "card" &&
    band === "glass" &&
    blur >= 20 &&
    hasBorder &&
    borderA === 50;
  const fillToken = alpha <= 55 ? 50 : alpha <= 65 ? 60 : 70;

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* live sample */}
      <div className="relative rounded-2xl border border-border/40 overflow-hidden bg-background min-h-[300px]">
        <ContentBackdrop />
        <div className="relative p-8 flex items-center justify-center min-h-[300px]">
          <div className="w-full max-w-sm">
            <SurfaceSpecimen style={style} size="lg" label="playground" />
          </div>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{
              background:
                band === "glass"
                  ? "hsl(205 70% 55% / 0.15)"
                  : band === "solid"
                    ? "hsl(5 70% 55% / 0.15)"
                    : "hsl(275 60% 60% / 0.15)",
              color:
                band === "glass"
                  ? "hsl(205 70% 62%)"
                  : band === "solid"
                    ? "hsl(5 70% 64%)"
                    : "hsl(275 60% 70%)",
            }}
          >
            {BAND_LABEL[band]}
          </span>
        </div>
      </div>

      {/* controls */}
      <div className="space-y-5">
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            plane
          </span>
          <div>
            <Segmented options={PLANE_OPTS} value={plane} onChange={setPlane} />
          </div>
        </div>

        <Slider
          label="presence α (fill)"
          value={alpha}
          min={0}
          max={100}
          suffix="%"
          onChange={setAlpha}
        />
        <Slider
          label="blur"
          value={blur}
          min={0}
          max={30}
          suffix="px"
          onChange={setBlur}
        />

        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            shadow (z)
          </span>
          <div>
            <Segmented
              options={SHADOW_OPTS}
              value={shadow}
              onChange={setShadow}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={hasBorder}
              onChange={(e) => setHasBorder(e.target.checked)}
              className="accent-foreground"
            />
            border
          </label>
          {hasBorder && (
            <div className="flex-1">
              <Slider
                label="border α"
                value={borderA}
                min={0}
                max={100}
                suffix="%"
                onChange={setBorderA}
              />
            </div>
          )}
        </div>

        <Slider
          label="radius"
          value={radius}
          min={0}
          max={32}
          suffix="px"
          onChange={setRadius}
        />

        {/* readout */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-2">
          <div className="text-[11px] font-mono text-muted-foreground">
            {sanctioned ? (
              <>
                ✓ 落在 sanctioned glass 档 ≈{" "}
                <code className="text-foreground">
                  surface(&#123; fill: {fillToken}, elevation: &quot;{shadow}
                  &quot; &#125;)
                </code>
              </>
            ) : (
              <>
                raw：{`--${plane}`} · α{alpha} · blur{blur}px · {shadow} ·{" "}
                {hasBorder ? `border/${borderA}` : "no-border"}
              </>
            )}
          </div>
          {verdicts.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">
              两轴自洽 — 没有矛盾。
            </p>
          ) : (
            verdicts.map((v, i) => (
              <p
                key={i}
                className={cn(
                  "text-xs leading-relaxed",
                  v.tone === "warn" ? "text-rose-500" : "text-muted-foreground"
                )}
              >
                {v.tone === "warn" ? "⚠ " : "· "}
                {v.text}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The surface.ts editor — a peer of the log.json / icon.json editors under
// /editor. It edits the same source of truth `surface()` renders from: the lab
// reads the sanctioned recipe via glassSpec() (see model.ts), so what it shows
// is what the primitive ships. Write-back to surface.ts is the next step; for
// now the canvas is read-only-derived.
// ---------------------------------------------------------------------------
export function SurfaceEditor() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-muted/5 px-4">
        <div className="flex items-center gap-3">
          <EditorSwitcher current="surface" />
          <span
            className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            title="The sanctioned tiers are derived from surface() via glassSpec(); editing the source is the next step."
          >
            derived · read-only
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SurfaceLabBody />
      </div>
    </div>
  );
}

function SurfaceLabBody() {
  const [selected, setSelected] = useState("live-panel");
  const [showBands, setShowBands] = useState(true);
  const spec = useMemo(
    () => SURFACES.find((s) => s.id === selected) ?? SURFACES[0],
    [selected]
  );

  return (
    <main className="mx-auto max-w-5xl px-6 pt-10 pb-32">
      <header className="mb-10">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
          design system · lab
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
          Surface Physics
        </h1>
        <p className="text-base text-foreground/80 max-w-2xl leading-relaxed">
          每一个浮层都由两个隐变量决定：
          <b className="text-foreground"> Z — 高度</b>
          （离页面多远，由 shadow / blur 读出）与
          <b className="text-foreground"> A — 存在感</b>
          （由 fill 不透明度 α 编码：glass 邀你透视，solid 坚持自己是主体）。
          基色、边框都是从这两轴派生的。下面是全站每个 surface 在这个场里的位置 —
          点选任意一点看它的真实渲染与指标，或到底部亲手调这两轴。
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8 items-start mb-16">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              the Z × A field
            </h2>
            <label className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showBands}
                onChange={(e) => setShowBands(e.target.checked)}
                className="accent-foreground"
              />
              presence bands
            </label>
          </div>
          <ScatterPlot
            selected={selected}
            onSelect={setSelected}
            showBands={showBands}
          />
          {/* legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <span
                key={k}
                className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: `hsl(${m.hue} 70% 55%)` }}
                />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <DetailPane spec={spec} />
      </div>

      <section>
        <div className="mb-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-1">
            playground · 亲手调两轴
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            拖动滑块，在同一块编辑正文之上实时渲染一个 sample panel。
            把 α 拉到 90 而 blur 不变，你会看到 frost 是怎么被『抹掉』的 ——
            那正是 lang-toast 当初的 bug。
          </p>
        </div>
        <Playground />
      </section>
    </main>
  );
}
