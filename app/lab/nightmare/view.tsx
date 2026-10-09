"use client";

import { useMounted } from "@/components/ui/use-mounted";
import {
  Field,
  LabShell,
  Section,
  Segmented,
  Slider,
  Toggle,
  useLabStrings,
} from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  DoorClosed,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "./sound";
import { NIGHTMARE_STRINGS } from "./strings";

export type NightmareAct = 1 | 2 | 3;

interface NightmareParams {
  act: NightmareAct;
  hatWidth: number; // 1.0 to 2.5
  slenderness: number; // 0.8 to 2.0
  ambientDarkness: number; // 0.3 to 0.95
  heartbeatBpm: number; // 0 to 150
  doorAngle: number; // 0 to 105 deg
  soundEnabled: boolean;
}

const DEFAULT_PARAMS: NightmareParams = {
  act: 1,
  hatWidth: 1.6,
  slenderness: 1.35,
  ambientDarkness: 0.82,
  heartbeatBpm: 60,
  doorAngle: 18,
  soundEnabled: true,
};

export function NightmareLabView({ embedded }: { embedded?: boolean } = {}) {
  const S = useLabStrings(NIGHTMARE_STRINGS);
  const mounted = useMounted();
  const searchParams = useSearchParams();
  const isEmbedded = embedded ?? (searchParams?.get("embedded") === "1");

  const [params, setParams] = useState<NightmareParams>(DEFAULT_PARAMS);
  const [mode, setMode] = useState<"experience" | "workbench">("experience");
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 1 for waking up
  const [holding, setHolding] = useState(false);
  const holdIntervalRef = useRef<number | null>(null);

  // Sync audio with params
  useEffect(() => {
    sound.setMuted(!params.soundEnabled);
  }, [params.soundEnabled]);

  // Handle act changes & audio orchestration
  useEffect(() => {
    if (!params.soundEnabled) {
      sound.stopAll();
      return;
    }

    if (params.act === 1) {
      sound.startDrone(0.25);
      sound.setHeartbeatBpm(params.heartbeatBpm, 0.45);
    } else if (params.act === 2) {
      sound.startDrone(0.5);
      sound.setHeartbeatBpm(130, 0.85);
    } else if (params.act === 3) {
      // Act 3 initial shock: silence for 1.2s then eerie real door latch
      sound.stopAll();
      const timer = window.setTimeout(() => {
        if (params.soundEnabled) {
          sound.playRealLatch();
        }
      }, 1400);
      return () => window.clearTimeout(timer);
    }

    return () => {
      // cleanup on unmount
    };
  }, [params.act, params.soundEnabled, params.heartbeatBpm]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      sound.stopAll();
    };
  }, []);

  // Act 1 -> 2: Open wardrobe
  const handleOpenWardrobe = useCallback(() => {
    if (params.act !== 1) return;
    if (params.soundEnabled) {
      sound.playDoorCreak(1.1);
    }
    setParams((prev) => ({
      ...prev,
      doorAngle: 85,
    }));
    // Transition to Act 2 after door swings open
    window.setTimeout(() => {
      setParams((prev) => ({
        ...prev,
        act: 2,
        heartbeatBpm: 125,
      }));
    }, 700);
  }, [params.act, params.soundEnabled]);

  // Act 2 -> 3: Hold to wake up
  const startHoldWake = useCallback(() => {
    if (params.act !== 2) return;
    setHolding(true);
    const start = Date.now();
    const duration = 1400; // 1.4s hold to wake up

    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      setHoldProgress(p);

      if (p >= 1) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setHolding(false);
        setHoldProgress(0);

        if (params.soundEnabled) {
          sound.playWakeGasp();
        }

        setParams((prev) => ({
          ...prev,
          act: 3,
          heartbeatBpm: 0,
          doorAngle: 12,
        }));
      }
    }, 20);
  }, [params.act, params.soundEnabled]);

  const endHoldWake = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHolding(false);
    setHoldProgress(0);
  }, []);

  // Restart experience
  const handleRestart = useCallback(() => {
    sound.stopAll();
    setHoldProgress(0);
    setHolding(false);
    setParams({
      ...DEFAULT_PARAMS,
      soundEnabled: params.soundEnabled,
    });
  }, [params.soundEnabled]);

  const toggleSound = useCallback(() => {
    setParams((prev) => {
      const nextSound = !prev.soundEnabled;
      sound.setMuted(!nextSound);
      return { ...prev, soundEnabled: nextSound };
    });
  }, []);

  const metaText = `act ${params.act}/3 · door ${Math.round(params.doorAngle)}° · hat ${params.hatWidth.toFixed(1)}x · bpm ${params.heartbeatBpm}`;

  const tools = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={toggleSound}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono transition-colors",
          params.soundEnabled
            ? "bg-foreground/10 text-foreground hover:bg-foreground/15"
            : "bg-muted/40 text-muted-foreground hover:text-foreground"
        )}
        title={params.soundEnabled ? S.soundOn : S.soundOff}
      >
        {params.soundEnabled ? (
          <Volume2 className="h-3.5 w-3.5" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {params.soundEnabled ? S.soundOn : S.soundOff}
        </span>
      </button>

      <button
        type="button"
        onClick={handleRestart}
        className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" />
        <span>{S.restart}</span>
      </button>

      <button
        type="button"
        onClick={() =>
          setMode((m) => (m === "experience" ? "workbench" : "experience"))
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono transition-colors",
          mode === "workbench"
            ? "bg-foreground text-background"
            : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span className="hidden sm:inline">
          {mode === "workbench" ? S.modeExperience : S.modeWorkbench}
        </span>
      </button>
    </div>
  );

  const panel = (
    <div className="flex flex-col">
      <Section title={S.sceneKnobs}>
        <Field label={S.act}>
          <Segmented
            value={`act${params.act}` as "act1" | "act2" | "act3"}
            options={[
              { value: "act1", label: S.acts.act1 },
              { value: "act2", label: S.acts.act2 },
              { value: "act3", label: S.acts.act3 },
            ]}
            onChange={(val) => {
              const actNum = val === "act1" ? 1 : val === "act2" ? 2 : 3;
              setParams((prev) => ({
                ...prev,
                act: actNum,
                doorAngle: actNum === 1 ? 18 : actNum === 2 ? 85 : 35,
                heartbeatBpm: actNum === 1 ? 60 : actNum === 2 ? 130 : 0,
              }));
            }}
          />
        </Field>

        <Field label={S.doorAngle} hint={`${Math.round(params.doorAngle)}°`}>
          <Slider
            value={params.doorAngle}
            min={0}
            max={105}
            step={1}
            onChange={(v) => setParams((p) => ({ ...p, doorAngle: v }))}
          />
        </Field>

        <Field label={S.hatSize} hint={`${params.hatWidth.toFixed(2)}x`}>
          <Slider
            value={params.hatWidth}
            min={1.0}
            max={2.6}
            step={0.05}
            onChange={(v) => setParams((p) => ({ ...p, hatWidth: v }))}
          />
        </Field>

        <Field label={S.slenderness} hint={`${params.slenderness.toFixed(2)}x`}>
          <Slider
            value={params.slenderness}
            min={0.8}
            max={2.0}
            step={0.05}
            onChange={(v) => setParams((p) => ({ ...p, slenderness: v }))}
          />
        </Field>

        <Field label={S.ambientLight} hint={`${Math.round(params.ambientDarkness * 100)}%`}>
          <Slider
            value={params.ambientDarkness}
            min={0.3}
            max={0.96}
            step={0.01}
            onChange={(v) => setParams((p) => ({ ...p, ambientDarkness: v }))}
          />
        </Field>

        <Field label={S.heartbeatBpm} hint={`${params.heartbeatBpm} BPM`}>
          <Slider
            value={params.heartbeatBpm}
            min={0}
            max={160}
            step={5}
            onChange={(v) => setParams((p) => ({ ...p, heartbeatBpm: v }))}
          />
        </Field>

        <Field label={S.soundToggle}>
          <Toggle
            label={params.soundEnabled ? S.soundOn : S.soundOff}
            value={params.soundEnabled}
            onChange={(val) => setParams((p) => ({ ...p, soundEnabled: val }))}
          />
        </Field>
      </Section>

      <Section title={S.narrativeNotes}>
        <p className={cn(TYPE.caption, "text-muted-foreground leading-relaxed")}>
          {S.narrativeMemoryText}
        </p>
      </Section>
    </div>
  );

  const stageContent = (
    <NightmareStage
      params={params}
      holding={holding}
      holdProgress={holdProgress}
      onOpenWardrobe={handleOpenWardrobe}
      onStartHoldWake={startHoldWake}
      onEndHoldWake={endHoldWake}
      onRestart={handleRestart}
      isEmbedded={isEmbedded}
      strings={S}
    />
  );

  if (isEmbedded) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black text-neutral-100 select-none">
        <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 bg-black/40 p-1 rounded-full backdrop-blur-md">
          <button
            type="button"
            onClick={toggleSound}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:text-white"
            title={params.soundEnabled ? S.soundOn : S.soundOff}
          >
            {params.soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:text-white"
            title={S.restart}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        {stageContent}
      </div>
    );
  }

  return (
    <LabShell
      lab="nightmare"
      layout={mode === "workbench" ? "workbench" : "document"}
      meta={metaText}
      tools={tools}
      panel={panel}
    >
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-border/50 bg-black shadow-2xl">
        {stageContent}
      </div>
    </LabShell>
  );
}

// =============================================================================
// Interactive Stage Component
// =============================================================================

function NightmareStage({
  params,
  holding,
  holdProgress,
  onOpenWardrobe,
  onStartHoldWake,
  onEndHoldWake,
  onRestart,
  isEmbedded,
  strings: S,
}: {
  params: NightmareParams;
  holding: boolean;
  holdProgress: number;
  onOpenWardrobe: () => void;
  onStartHoldWake: () => void;
  onEndHoldWake: () => void;
  onRestart: () => void;
  isEmbedded: boolean;
  strings: typeof NIGHTMARE_STRINGS.en;
}) {
  const isAct1 = params.act === 1;
  const isAct2 = params.act === 2;
  const isAct3 = params.act === 3;

  // Real wardrobe opening in Act 3
  const [act3RealOpening, setAct3RealOpening] = useState(false);
  useEffect(() => {
    if (isAct3) {
      setAct3RealOpening(false);
      const timer = window.setTimeout(() => {
        setAct3RealOpening(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [isAct3]);

  // Dynamic heartbeat camera shake pulse
  const [heartPulse, setHeartPulse] = useState(false);
  useEffect(() => {
    if (params.heartbeatBpm <= 0) return;
    const interval = (60 / params.heartbeatBpm) * 1000;
    const timer = window.setInterval(() => {
      setHeartPulse(true);
      window.setTimeout(() => setHeartPulse(false), 140);
    }, interval);
    return () => window.clearInterval(timer);
  }, [params.heartbeatBpm]);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#050608] text-neutral-100 select-none",
        isEmbedded ? "h-screen" : "min-h-[580px] sm:min-h-[660px]"
      )}
      style={{
        perspective: "1000px",
      }}
    >
      {/* Heavy Nightmare Vignette & Darkness Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 20%, rgba(3,4,6,${params.ambientDarkness}) 80%, rgba(0,0,0,0.98) 100%)`,
        }}
      />

      {/* Heartbeat pulse overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 transition-opacity duration-75",
          heartPulse && isAct2 ? "opacity-35 bg-red-950/20" : "opacity-0"
        )}
      />

      {/* Eyelids closing effect on holding */}
      <div
        className="pointer-events-none absolute inset-0 z-30 transition-all duration-75"
        style={{
          boxShadow: holding
            ? `inset 0 0 ${holdProgress * 220}px ${holdProgress * 150}px #000`
            : "none",
          opacity: holding ? 0.3 + holdProgress * 0.7 : 0,
          backgroundColor: holding ? `rgba(0,0,0,${holdProgress * 0.95})` : "transparent",
        }}
      />

      {/* Subtle Moonbeam from bedroom window */}
      <div
        className="pointer-events-none absolute -left-20 top-0 h-full w-[450px] opacity-20 blur-3xl transform -rotate-12"
        style={{
          background: isAct3
            ? "linear-gradient(135deg, rgba(160,190,225,0.4) 0%, transparent 80%)"
            : "linear-gradient(135deg, rgba(100,140,180,0.25) 0%, transparent 80%)",
        }}
      />

      {/* Floor & Bed Horizon Lines */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-[#08090d] to-transparent opacity-90" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 border-t border-neutral-800/20"
        style={{
          background: "linear-gradient(to bottom, rgba(18,20,28,0.3), rgba(6,7,10,0.95))",
        }}
      >
        {/* Bed blanket edge in foreground POV */}
        <div className="absolute -bottom-8 -inset-x-8 h-24 rounded-t-[50%] border-t border-neutral-700/20 bg-[#07080b]/90 backdrop-blur-sm" />
      </div>

      {/* SCENE STAGE (Transforms with camera & acts) */}
      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-md flex-col items-center justify-end pb-16 transition-transform duration-700",
          heartPulse && isAct2 && "scale-[1.012] translate-y-[-2px]"
        )}
      >
        {/* =========================================================================
            ACT 1 & 2: THE WARDROBE & TALL MAN
           ========================================================================= */}
        {(isAct1 || isAct2) && (
          <div className="relative flex flex-col items-center justify-end">
            {/* The Tall Wardrobe Frame */}
            <div
              className="relative h-[340px] w-64 rounded-t-sm border border-neutral-800/60 bg-[#0a0c10] shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
              style={{
                boxShadow: "0 0 45px rgba(0,0,0,0.9), inset 0 0 30px #000",
              }}
            >
              {/* Wardrobe top crown molding */}
              <div className="absolute -top-3 -inset-x-2 h-3 border-b border-neutral-800/80 bg-[#12141a] rounded-t-sm" />

              {/* Pitch black inner cavity */}
              <div className="absolute inset-0 bg-black overflow-hidden">
                {/* Inside the closet: lurking shadow depth */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-black to-black" />

                {/* The Tall Man inside closet before stepping out */}
                {isAct1 && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-start pt-6 transition-opacity duration-500"
                    style={{ opacity: Math.max(0.2, (params.doorAngle - 10) / 40) }}
                  >
                    <TallManSilhouette
                      hatWidth={params.hatWidth}
                      slenderness={params.slenderness}
                      scale={0.78}
                      looming={false}
                    />
                  </div>
                )}
              </div>

              {/* The Wardrobe Door (Pivots on right side) */}
              <motion.div
                onClick={onOpenWardrobe}
                className="absolute inset-0 origin-left cursor-pointer border-r border-neutral-700/40 bg-[#0e1017] transition-all hover:brightness-110"
                style={{
                  transformStyle: "preserve-3d",
                  transformOrigin: "left center",
                  transform: `rotateY(-${params.doorAngle}deg)`,
                  boxShadow: "5px 0 25px rgba(0,0,0,0.85)",
                }}
              >
                {/* Door panels woodwork */}
                <div className="absolute inset-3 border border-neutral-800/40 rounded-sm bg-neutral-950/40 flex flex-col justify-between p-2">
                  <div className="h-28 border border-neutral-800/30 rounded-sm bg-black/20" />
                  <div className="h-36 border border-neutral-800/30 rounded-sm bg-black/20" />
                </div>
                {/* Door handle */}
                <div className="absolute right-3 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-full bg-neutral-600/70 shadow-sm" />
              </motion.div>
            </div>

            {/* Act 2: Tall Man stepped out right in front of the bed */}
            <AnimatePresence>
              {isAct2 && (
                <motion.div
                  key="tall-man-looming"
                  initial={{ opacity: 0, y: 30, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1.15 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-0 z-30 flex flex-col items-center pointer-events-none"
                >
                  <TallManSilhouette
                    hatWidth={params.hatWidth}
                    slenderness={params.slenderness}
                    scale={1.22}
                    looming
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* =========================================================================
            ACT 3: THE REALITY (Waking up to find the bedroom door actually opening)
           ========================================================================= */}
        {isAct3 && (
          <div className="relative flex flex-col items-center justify-end w-full">
            {/* Real bedroom corner */}
            <div className="relative h-[320px] w-64 rounded-t-sm border border-neutral-800/40 bg-[#090b0e]">
              <div className="absolute -top-3 -inset-x-2 h-3 bg-[#101217] rounded-t-sm border-b border-neutral-800/60" />
              <div className="absolute inset-0 bg-black" />

              {/* The Real Door opening on its own slowly */}
              <div
                className="absolute inset-0 origin-left border-r border-neutral-700/40 bg-[#0d0f15] transition-all duration-[3000ms] ease-out"
                style={{
                  transformOrigin: "left center",
                  transform: act3RealOpening ? "rotateY(-42deg)" : "rotateY(-2deg)",
                  boxShadow: "6px 0 28px rgba(0,0,0,0.9)",
                }}
              >
                <div className="absolute right-3 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-full bg-neutral-600/70" />
              </div>

              {/* Shadow extending across the floor from the opening door */}
              {act3RealOpening && (
                <div className="pointer-events-none absolute -bottom-12 -left-10 h-24 w-72 bg-gradient-to-r from-black via-black/80 to-transparent blur-md transform -rotate-12 opacity-80" />
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            INTERACTION PROMPTS & NARRATIVE OVERLAY
           ========================================================================= */}
        <div className="mt-8 flex flex-col items-center text-center px-6 min-h-[90px] z-30">
          {/* Act 1 Prompt */}
          {isAct1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={onOpenWardrobe}
                className="group relative flex items-center gap-2 rounded-full border border-neutral-700/60 bg-neutral-900/80 px-5 py-2.5 text-xs font-mono text-neutral-300 shadow-xl backdrop-blur-md transition-all hover:border-neutral-500 hover:text-white active:scale-95"
              >
                <DoorClosed className="h-4 w-4 text-neutral-400 group-hover:text-white transition-colors" />
                <span>{S.act1Prompt}</span>
                <span className="absolute -inset-0.5 rounded-full border border-neutral-500/30 animate-pulse pointer-events-none" />
              </button>
              <p className="max-w-xs text-[11px] text-neutral-500 font-serif italic">
                {S.act1Description}
              </p>
            </motion.div>
          )}

          {/* Act 2 Prompt: Hold to break paralysis and wake up */}
          {isAct2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onPointerDown={onStartHoldWake}
                onPointerUp={onEndHoldWake}
                onPointerLeave={onEndHoldWake}
                className="group relative overflow-hidden rounded-full border border-red-500/40 bg-neutral-950/90 px-6 py-3 text-xs font-mono text-neutral-200 shadow-2xl backdrop-blur-md transition-all active:scale-95"
              >
                {/* Hold progress fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-red-950/60 transition-all duration-75"
                  style={{ width: `${holdProgress * 100}%` }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-red-400" />
                  <span className="font-medium text-neutral-100">
                    {holding ? S.act2Progress : S.act2Prompt}
                  </span>
                </span>
              </button>
              <p className="max-w-xs text-[11px] text-red-400/80 font-serif italic">
                {S.act2Description}
              </p>
            </motion.div>
          )}

          {/* Act 3 Twist & Resolution */}
          {isAct3 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <p className="text-xs font-medium text-neutral-400 font-serif">
                {S.act3DreamNote}
              </p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4, duration: 1 }}
                className="text-xs sm:text-sm font-semibold text-neutral-200 font-serif max-w-sm leading-relaxed"
              >
                {S.act3Realization}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.2, duration: 1 }}
                className="text-[11px] text-neutral-500 font-serif italic max-w-xs border-t border-neutral-800/60 pt-2"
              >
                {S.act3Memory}
              </motion.p>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8 }}
                type="button"
                onClick={onRestart}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-700/60 bg-neutral-900/90 px-4 py-1.5 text-xs font-mono text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{S.act3Action}</span>
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// The Tall Man Silhouette Graphic
// Tall, slender, pitch black trench coat, with a massive flat circular hat.
// =============================================================================

function TallManSilhouette({
  hatWidth = 1.6,
  slenderness = 1.35,
  scale = 1,
  looming = false,
}: {
  hatWidth?: number;
  slenderness?: number;
  scale?: number;
  looming?: boolean;
}) {
  const hatBrimRx = Math.round(75 * hatWidth); // Extremely wide circular flat brim
  const heightMultiplier = slenderness;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.95)]",
        looming && "animate-pulse"
      )}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      <svg
        width="260"
        height="380"
        viewBox="0 0 260 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="voidGradient" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#121318" />
            <stop offset="60%" stopColor="#060709" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id="shadowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ===================================================================
            1. THE IMMENSE FLAT ROUND HAT (像犹太人一样圆圆的大帽子，比犹太人大很多)
           =================================================================== */}
        <g id="hat" transform="translate(130, 48)">
          {/* Hat Crown (Flat cylinder top) */}
          <ellipse cx="0" cy="-22" rx="28" ry="8" fill="#030406" />
          <path
            d="M -28 -22 C -28 -34, 28 -34, 28 -22 L 27 0 L -27 0 Z"
            fill="#050608"
          />
          {/* Crown band */}
          <path
            d="M -27.5 -3 C -27.5 -10, 27.5 -10, 27.5 -3 L 27.2 0 L -27.2 0 Z"
            fill="#090a0f"
          />

          {/* Huge Wide Flat Brim (Giant circular disk) */}
          <ellipse
            cx="0"
            cy="0"
            rx={hatBrimRx}
            ry={Math.round(hatBrimRx * 0.22)}
            fill="#020204"
            stroke="#151720"
            strokeWidth="0.8"
          />
          {/* Subtle rim highlight */}
          <ellipse
            cx="0"
            cy="1.2"
            rx={hatBrimRx - 2}
            ry={Math.round((hatBrimRx - 2) * 0.2)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.7"
          />
        </g>

        {/* ===================================================================
            2. HEAD & PALE PIERCING EYES (Shrouded in deep shadow under the brim)
           =================================================================== */}
        <g id="head" transform="translate(130, 72)">
          {/* Gaunt narrow head */}
          <path
            d="M -13 -12 C -15 6, -11 26, 0 32 C 11 26, 15 6, 13 -12 Z"
            fill="#050608"
          />

          {/* Piercing subtle eyes in the abyss */}
          {looming && (
            <g id="eyes" opacity="0.85">
              <ellipse cx="-5" cy="5" rx="1.8" ry="1.2" fill="#d0d5e2" filter="url(#shadowBlur)" />
              <ellipse cx="5" cy="5" rx="1.8" ry="1.2" fill="#d0d5e2" filter="url(#shadowBlur)" />
              <circle cx="-5" cy="5" r="0.6" fill="#ffffff" />
              <circle cx="5" cy="5" r="0.6" fill="#ffffff" />
            </g>
          )}
        </g>

        {/* ===================================================================
            3. THIN GAUNT NECK & LONG SLENDER COAT BODY
           =================================================================== */}
        <g id="body" transform={`translate(130, 102) scale(1, ${heightMultiplier})`}>
          {/* Thin neck */}
          <path d="M -5 -2 L -5 14 L 5 14 L 5 -2 Z" fill="#040507" />

          {/* Narrow slumped shoulders and long black coat silhouette */}
          <path
            d="M 0 14 
               C -24 16, -34 26, -38 48
               L -44 140
               C -46 200, -52 240, -56 270
               L 56 270
               C 52 240, 46 200, 44 140
               L 38 48
               C 34 26, 24 16, 0 14 Z"
            fill="url(#voidGradient)"
          />

          {/* Coat lapels & buttons hint */}
          <path
            d="M 0 16 L -10 65 L 0 85 L 10 65 Z"
            fill="#020305"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
          <circle cx="0" cy="100" r="1.5" fill="#14161f" />
          <circle cx="0" cy="125" r="1.5" fill="#14161f" />
          <circle cx="0" cy="150" r="1.5" fill="#14161f" />

          {/* Long thin arms hanging down */}
          <path
            d="M -36 46 C -40 100, -42 160, -45 220"
            stroke="#020203"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 36 46 C 40 100, 42 160, 45 220"
            stroke="#020203"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
