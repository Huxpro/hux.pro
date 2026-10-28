"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLabStrings, LabChip, LabSection, LabShell } from "@/systems/lab";
import { Slider as Range } from "@/components/ui/slider";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  GLOW_HARMONIES,
  Glow,
  autoHarmony,
  harmonyStops,
  type GlowProps,
} from "@/systems/glow";
import { GLOW_STRINGS, type GlowPairId } from "./strings";
import PROFILES from "@/systems/ambient/lib/wallpaper-profiles.json";
import { createMeter, primeAudio, type VoiceMeter } from "@/systems/voice";
import { Mic, Music, Search } from "lucide-react";
import { useTheme } from "@/services";
import { BorderBeam } from "border-beam";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// =============================================================================
// /lab/glow, the Glow Lab: the site's one light, at every scale.
//
// The lab for systems/glow: one set of controls (on, level, processing, a
// real microphone) driving every specimen at once, from a screen down to a
// word. The first row is where the glow lives in production; the second is
// where it could, drawn so the question "does this belong here?" can be
// answered by looking. Nothing here is a mock of the glow: every specimen is
// the production <Glow>, drawn by the one shared renderer. Between them, the
// three motions (flow, rotate, pulse; inside and out) side by side, with a
// period to drag.
// =============================================================================

type Drive = Pick<GlowProps, "active" | "level" | "bands" | "processing">;

function Slider({
  label,
  value,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** In the bar: the label takes its own width, the track a little less. */
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2" : "gap-3", disabled && "pointer-events-none opacity-40")}>
      <span className={cn(TYPE.meta, "shrink-0", !compact && "w-16")}>{label}</span>
      <Range
        value={value}
        min={0}
        max={1}
        step={0.01}
        onChange={onChange}
        aria-label={label}
        className={compact ? "w-24 sm:w-32" : "w-28 sm:w-40"}
      />
      <span className={cn(TYPE.rowMeta, "w-10 tabular-nums")}>{value.toFixed(2)}</span>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <LabChip on={on} onClick={() => onChange(!on)}>
      {label}
    </LabChip>
  );
}

/** The motions, each paired with the border-beam type it answers to. Their
 *  names and prose are in strings.ts, under `pairs[id]`. */
const PAIRS: {
  id: GlowPairId;
  beam: "md" | "sm" | "pulse-inner" | "pulse-outside";
  motion: "rotate" | "pulse";
  period: number;
  radius: number;
  reach: number;
  bleed?: number;
  inside?: boolean;
  hostClass: string;
  inner: string;
}[] = [
  {
    id: "rotateCard",
    beam: "md",
    motion: "rotate",
    // border-beam's own rotation time, so the pair turns together.
    period: 1.96,
    radius: 16,
    reach: 6,
    hostClass: "h-24 w-full",
    inner: "rounded-2xl border border-border/50 bg-glass",
  },
  {
    id: "rotateButton",
    beam: "sm",
    motion: "rotate",
    period: 1.96,
    radius: 999,
    reach: 3,
    hostClass: "h-9 w-36",
    inner: "flex items-center justify-center rounded-full border border-border/50 bg-glass text-[13px] text-foreground",
  },
  {
    id: "pulseInner",
    beam: "pulse-inner",
    motion: "pulse",
    period: 2.3,
    radius: 16,
    reach: 7,
    hostClass: "h-24 w-full",
    inner: "rounded-2xl border border-border/50 bg-glass",
  },
  {
    id: "pulseOutside",
    beam: "pulse-outside",
    motion: "pulse",
    period: 2.3,
    radius: 16,
    reach: 5,
    bleed: 18,
    inside: false,
    hostClass: "h-24 w-full",
    inner: "rounded-2xl border border-border/50 bg-background",
  },
];

/** Wallpapers across the wheel, their dominant colours as measured
 *  (systems/ambient/lib/wallpaper-profiles.json), for the colours section. */
const PAINTINGS = ["ventura/light", "sonoma/light", "tahoe/dark", "monterey/light", "nature/aurora", "nature/zebra"] as const;

function HarmonyRow({ name }: { name: (typeof PAINTINGS)[number] }) {
  const S = useLabStrings(GLOW_STRINGS);
  const tint = (PROFILES.images as Record<string, { tint: { h: number; c: number } | null; chroma: number }>)[name];
  const source = tint?.tint && tint.chroma >= 0.03 ? { h: tint.tint.h, c: tint.tint.c } : null;
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <div className="grid min-w-[36rem] grid-cols-[9rem_repeat(6,minmax(0,1fr))] items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className="size-4 shrink-0 rounded-full border border-border/50"
          style={{ background: source ? `oklch(0.7 ${Math.min(source.c, 0.2)} ${source.h})` : "var(--muted)" }}
        />
        <span className={TYPE.rowMeta}>{name}</span>
      </div>
      {GLOW_HARMONIES.map((h) => {
        const stops = harmonyStops(h, source, dark);
        const rule = h === "auto" ? autoHarmony(source) : h;
        return (
          <div key={h} className="space-y-1">
            <div
              className="h-5 rounded-full"
              style={{
                background: `linear-gradient(to right, ${[...stops, stops[0]]
                  .map(([r, g, b]) => `rgb(${r * 255} ${g * 255} ${b * 255})`)
                  .join(", ")})`,
              }}
            />
            {h === "auto" && <p className={cn(TYPE.labelSm, "text-center")}>{S.autoPicks(rule)}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Motion({
  name,
  where,
  children,
}: {
  name: string;
  where: string;
  children: ReactNode;
}) {
  return (
    <figure className="space-y-3">
      <div className="flex min-h-36 items-center justify-center rounded-2xl bg-muted/40 p-8">
        {children}
      </div>
      <figcaption className="space-y-0.5">
        <p className={cn(TYPE.rowTitle, "font-mono")}>{name}</p>
        <p className={TYPE.caption}>{where}</p>
      </figcaption>
    </figure>
  );
}

function Specimen({
  name,
  where,
  children,
}: {
  name: string;
  where: string;
  children: ReactNode;
}) {
  return (
    <figure className="space-y-3">
      <div className="flex min-h-40 items-center justify-center rounded-2xl bg-muted/40 p-8">
        {children}
      </div>
      <figcaption className="space-y-0.5">
        <p className={TYPE.rowTitle}>{name}</p>
        <p className={TYPE.caption}>{where}</p>
      </figcaption>
    </figure>
  );
}

export function GlowLabView() {
  const S = useLabStrings(GLOW_STRINGS);
  const [active, setActive] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [level, setLevel] = useState(0.45);
  // The motions' period, as a share of each one's default (2s a turn, 2.3s
  // a breath): 0.5 is twice as fast.
  const [pace, setPace] = useState(0.5);
  // Advanced: the baseline, overriding each motion's own while set.
  const [baseline, setBaseline] = useState<number | null>(null);
  const speed = 0.25 + pace * 1.5;
  const { theme } = useTheme();
  // border-beam writes its styles for one theme; the server cannot know the
  // reader's, so the reference draws once on the client.
  const mounted = useMounted();
  const [mic, setMic] = useState<"off" | "on" | "denied">("off");
  const meter = useRef<VoiceMeter | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopMic = useCallback(() => {
    meter.current?.release();
    meter.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setMic("off");
  }, []);

  const startMic = useCallback(async () => {
    primeAudio();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = s;
      meter.current = createMeter(s);
      setMic("on");
    } catch {
      setMic("denied");
    }
  }, []);

  useEffect(() => stopMic, [stopMic]);

  const drive: Drive = {
    active,
    processing,
    level: mic === "on" ? () => meter.current?.level() ?? 0 : level,
    bands: mic === "on" ? () => meter.current?.bands() ?? [0, 0, 0] : undefined,
  };

  return (
    <LabShell
      lab="glow"
      tools={
        <>
          <Toggle label={S.on} on={active} onChange={setActive} />
          <Toggle label={S.processing} on={processing} onChange={setProcessing} />
          <Slider label={S.level} value={level} onChange={setLevel} disabled={mic === "on"} compact />
          <LabChip on={mic === "on"} onClick={mic === "on" ? stopMic : startMic}>
            <Mic />
            {mic === "on" ? S.listening : mic === "denied" ? S.micBlocked : S.microphone}
          </LabChip>
        </>
      }
    >

      <LabSection
        title={S.motions}
        note={S.motionsNote}
        aside={
          <div className="flex flex-col gap-2 sm:items-end">
            <Slider label={S.period} value={pace} onChange={setPace} />
            <div className="flex flex-wrap items-center gap-3">
              <Slider label={S.baseline} value={baseline ?? 0} onChange={setBaseline} disabled={baseline === null} />
              <Toggle
                label={baseline === null ? S.eachOwn : S.override}
                on={baseline !== null}
                onChange={(on) => setBaseline(on ? 0.2 : null)}
              />
            </div>
          </div>
        }
      >
        {/* Each motion beside Libraries.dev's border-beam (the reference
            they were rebuilt against), on the same host, in the same
            theme: left is theirs, right is ours. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <p className={cn(TYPE.label, "hidden sm:block")}>{S.reference}</p>
          <p className={cn(TYPE.label, "hidden sm:block")}>{S.ours}</p>
          {PAIRS.map((pair) => {
            const text = S.pairs[pair.id];
            return (
              <Fragment key={pair.id}>
                <Motion name={`${text.name} · border-beam`} where={text.theirs}>
                  {mounted && <BorderBeam
                    size={pair.beam}
                    theme={theme}
                    active={drive.active}
                    borderRadius={pair.radius}
                    duration={pair.period * speed}
                    className={pair.hostClass}
                  >
                    <div className={cn(pair.hostClass, pair.inner)}>{text.label}</div>
                  </BorderBeam>}
                </Motion>
                <Motion name={`${text.name} · ${S.ours}`} where={text.ours}>
                  <div className={cn("relative", pair.hostClass, pair.inner)} style={{ borderRadius: pair.radius }}>
                    {text.label}
                    <Glow
                      {...drive}
                      motion={pair.motion}
                      period={pair.period * speed}
                      reach={pair.reach}
                      bleed={pair.bleed}
                      inside={pair.inside}
                      baseline={baseline ?? undefined}
                    />
                  </div>
                </Motion>
              </Fragment>
            );
          })}
          <Motion name={S.flowName} where={S.flowWhere}>
            <div className="relative h-24 w-full rounded-2xl border border-border/50 bg-glass">
              <Glow {...drive} motion="flow" reach={4} baseline={baseline ?? undefined} />
            </div>
          </Motion>
        </div>
      </LabSection>

      <LabSection
        title={S.colours}
        note={S.coloursNote}
      >
        {/* Wider than a phone: the table scrolls sideways there, whole. */}
        <div className="-mx-5 space-y-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="grid min-w-[36rem] grid-cols-[9rem_repeat(6,minmax(0,1fr))] gap-3">
            <span />
            {GLOW_HARMONIES.map((h) => (
              <span key={h} className={cn(TYPE.labelSm, "text-center")}>{h}</span>
            ))}
          </div>
          {mounted && PAINTINGS.map((name) => <HarmonyRow key={name} name={name} />)}
        </div>
      </LabSection>

      <LabSection title={S.inProduction}>
        <div className="grid gap-8 sm:grid-cols-2">
          <Specimen name={S.screenName} where={S.screenWhere}>
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-background shadow-raised">
              <Glow {...drive} shape="ring" reach={12} />
              <div className="flex h-full items-center justify-center font-serif text-lg text-foreground">
                {S.screenText}
              </div>
            </div>
          </Specimen>

          <Specimen name={S.fieldName} where={S.fieldWhere}>
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-glass-popover">
              <div className="flex items-center gap-3 px-4 py-4 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-foreground">{S.fieldText}</span>
                <Mic className="h-4 w-4 text-foreground" />
              </div>
              <Glow {...drive} shape="line" />
            </div>
          </Specimen>


          <Specimen name={S.windowName} where={S.windowWhere}>
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border/50 bg-background">
              <div className="flex h-7 items-center gap-1.5 border-b border-border/50 px-3">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className={cn(TYPE.rowMeta, "ml-2")}>lynxjs.org</span>
              </div>
              <div className="relative h-[calc(100%-1.75rem)]">
                <Glow active={drive.active} shape="line" edge="top" processing reach={7} />
              </div>
            </div>
          </Specimen>
        </div>
      </LabSection>

      <LabSection
        title={S.couldBe}
        note={S.couldBeNote}
      >
        <div className="grid gap-8 sm:grid-cols-3">
          <Specimen name={S.commandBarName} where={S.commandBarWhere}>
            <div className="relative w-full overflow-hidden rounded-full border border-border/50 bg-glass-popover px-4 py-2.5 text-sm text-tertiary-foreground">
              {S.commandBarText}
              <Glow {...drive} shape="line" />
            </div>
          </Specimen>

          <Specimen name={S.appTileName} where={S.appTileWhere}>
            <div className="relative size-16 rounded-[22%] bg-white shadow-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/app-icons/lynx-flappy-bird.png" alt="" className="size-full rounded-[22%]" />
              <Glow {...drive} motion="rotate" period={2 * speed} shape="ring" reach={3} bleed={10} />
            </div>
          </Specimen>

          <Specimen name={S.activityName} where={S.activityWhere}>
            <div className="relative flex items-center gap-2 rounded-full bg-glass-strong px-4 py-2 text-xs text-foreground shadow-raised">
              <Music className="h-3.5 w-3.5" />
              Weightless
              <Glow {...drive} shape="ring" reach={3} bleed={8} />
            </div>
          </Specimen>

          <Specimen name={S.buttonName} where={S.buttonWhere}>
            <span className="relative rounded-full bg-foreground px-4 py-1.5 text-[13px] font-medium text-background">
              {S.buttonText}
              <Glow {...drive} motion="pulse" period={2.3 * speed} inside={false} shape="ring" reach={3} bleed={12} />
            </span>
          </Specimen>

          <Specimen name={S.cardName} where={S.cardWhere}>
            <div className="relative w-full rounded-2xl border border-border/50 bg-glass p-4">
              <p className={TYPE.rowTitle}>Lynx Framework</p>
              <p className={TYPE.rowMeta}>{S.cardDates}</p>
              <Glow {...drive} motion="pulse" period={2.3 * speed} shape="ring" reach={4} bleed={12} strength={0.8} />
            </div>
          </Specimen>

          <Specimen name={S.avatarName} where={S.avatarWhere}>
            <div className="relative size-14 rounded-full bg-muted">
              <Glow {...drive} shape="ring" reach={3} bleed={10} />
            </div>
          </Specimen>
        </div>
      </LabSection>
    </LabShell>
  );
}
