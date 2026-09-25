"use client";

import { EditorNav } from "@/app/editor/nav";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { Glow, type GlowProps } from "@/systems/glow";
import { createMeter, primeAudio, type VoiceMeter } from "@/systems/voice";
import { Mic, Music, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// =============================================================================
// /editor/glow — the site's one light, at every scale.
//
// The lab for systems/glow: one set of controls — on, level, processing, a
// real microphone — driving every specimen at once, from a screen down to a
// word. The first row is where the glow lives in production; the second is
// where it could, drawn so the question "does this belong here?" can be
// answered by looking. Nothing here is a mock of the glow: every specimen is
// the production <Glow>, drawn by the one shared renderer.
// =============================================================================

type Drive = Pick<GlowProps, "active" | "level" | "bands" | "processing">;

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-3", disabled && "opacity-40")}>
      <span className={cn(TYPE.meta, "w-16")}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-40 accent-foreground"
      />
      <span className={cn(TYPE.rowMeta, "w-10 tabular-nums")}>{value.toFixed(2)}</span>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
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
  const [active, setActive] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [level, setLevel] = useState(0.45);
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
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        <header className="space-y-3">
          <p className={TYPE.label}>Design system · /editor/glow</p>
          <EditorNav appearance="page" />
          <p className={cn(TYPE.body, "max-w-2xl")}>
            One light for the whole site — Siri&apos;s ring, as a shader on the edge of a rounded
            box (systems/glow). Every specimen below is the production{" "}
            <code className="font-mono text-xs">&lt;Glow&gt;</code>, drawn by the one shared renderer,
            so they are the same light at different scales. Try the microphone.
          </p>
        </header>

        <section className="sticky top-3 z-20 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border/50 bg-glass-popover px-5 py-4 backdrop-blur-xl">
          <Toggle label="on" on={active} onChange={setActive} />
          <Toggle label="processing" on={processing} onChange={setProcessing} />
          <Slider label="level" value={level} onChange={setLevel} disabled={mic === "on"} />
          <button
            type="button"
            onClick={mic === "on" ? stopMic : startMic}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs",
              mic === "on" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            {mic === "on" ? "listening" : mic === "denied" ? "mic blocked" : "microphone"}
          </button>
        </section>

        <section className="space-y-6">
          <h2 className={TYPE.label}>In production</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <Specimen name="Screen · ring" where="The About, over every page. Fixed, bezel-aware.">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-background shadow-raised">
                <Glow {...drive} shape="ring" reach={12} />
                <div className="flex h-full items-center justify-center font-serif text-lg text-foreground">
                  Hey, I&apos;m Hux.
                </div>
              </div>
            </Specimen>

            <Specimen name="Field · line" where="The palette listening (⌘K, then the microphone, or / V).">
              <div className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-glass-popover">
                <div className="flex items-center gap-3 px-4 py-4 text-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-foreground">go to the writing</span>
                  <Mic className="h-4 w-4 text-foreground" />
                </div>
                <Glow {...drive} shape="line" />
              </div>
            </Specimen>


            <Specimen name="Window · loading" where="The in-app browser while its page arrives: a line on the top edge, processing.">
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
        </section>

        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className={TYPE.label}>Could be</h2>
            <p className={cn(TYPE.caption, "max-w-2xl")}>
              The same light where the OS has something alive to say. Each is a candidate, drawn so it
              can be judged by eye; none is wired in yet.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <Specimen name="Command bar · line" where="The home bar, while ⌘K is listening — the voice seen from the page.">
              <div className="relative w-full overflow-hidden rounded-full border border-border/50 bg-glass-popover px-4 py-2.5 text-sm text-tertiary-foreground">
                Search or / for commands
                <Glow {...drive} shape="line" />
              </div>
            </Specimen>

            <Specimen name="App tile · ring" where="An app whose window is open, on the home shelf.">
              <div className="relative size-16 rounded-[22%] bg-white shadow-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/app-icons/lynx-flappy-bird.png" alt="" className="size-full rounded-[22%]" />
                <Glow {...drive} shape="ring" reach={3} bleed={10} />
              </div>
            </Specimen>

            <Specimen name="Live Activity · comet" where="The dock pill while something is working — a comet around it.">
              <div className="relative flex items-center gap-2 rounded-full bg-glass-strong px-4 py-2 text-xs text-foreground shadow-raised">
                <Music className="h-3.5 w-3.5" />
                Weightless
                <Glow {...drive} shape="ring" reach={3} bleed={8} />
              </div>
            </Specimen>

            <Specimen name="Button · halo" where="A primary action inviting a first press (the About's “Reveal”).">
              <span className="relative rounded-full bg-foreground px-4 py-1.5 text-[13px] font-medium text-background">
                Reveal
                <Glow {...drive} shape="ring" reach={3} bleed={10} />
              </span>
            </Specimen>

            <Specimen name="Card · ring" where="The HEAD commit on /works — what I am doing now.">
              <div className="relative w-full rounded-2xl border border-border/50 bg-glass p-4">
                <p className={TYPE.rowTitle}>Lynx Framework</p>
                <p className={TYPE.rowMeta}>2023 — present</p>
                <Glow {...drive} shape="ring" reach={4} bleed={12} strength={0.8} />
              </div>
            </Specimen>

            <Specimen name="Avatar · ring" where="The identity card's photo while its person is ‘speaking’ (a talk playing).">
              <div className="relative size-14 rounded-full bg-muted">
                <Glow {...drive} shape="ring" reach={3} bleed={10} />
              </div>
            </Specimen>
          </div>
        </section>
      </div>
    </main>
  );
}
