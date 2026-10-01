"use client";

import {
  Field,
  LabButton,
  LabChip,
  LabPanel,
  LabSection,
  LabShell,
  Section,
  Segmented,
  Toggle,
  useLabStrings,
} from "@/systems/lab";
import { PINNED_TOP, PinnedSlot } from "@/components/ui/pinned-slot";
import { APPS } from "@/lib/apps";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  MAX_SAMPLES,
  PRESETS,
  presetOf,
  readBand,
  setBandConfig,
  setBandSamples,
  showNotice,
  subscribeBand,
  useBand,
  useBandGeometry,
  type BandForm,
  type BandGroup,
  type BandState,
  type PresetId,
} from "@/systems/dock";
import { useOptionalMusic } from "@/systems/music";
import { useOptionalWindows } from "@/systems/windows";
import { ArrowDownToLine, ArrowUpToLine, Minus, Plus, Sunset } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pageScrollTop, scrollPageTo } from "vitre";
import { AdaptiveSurface } from "@/systems/surface";
import { BAR_KINDS, CHECK_IDS, measureBand, sameMeasure, type BarKind, type Measure } from "./model";
import { SamplePromptBar, SampleWorksBar } from "./sample-bars";
import { BAND_STRINGS, type BandStrings } from "./strings";

// =============================================================================
// The Band Lab — the top of the screen, composed.
//
// Nothing on this page is a picture. The knobs set the band's configuration
// on the site itself (systems/dock/band.ts, this tab only); the occupants are
// the Dock's real ones; the bar that meets them is a real bar in a real
// PinnedSlot — this lab's own, or /prompt's or /works's toolbar with sample
// facets — on this page's real scroll. What you see when it pins is what the
// site does, and the checks are measured off it.
//
// Each thing has one place, and the subject keeps the top to itself:
//
//   top      the subject — the lab's own bar (when it is the bar under test)
//            and, as its second row, which bar meets the band
//   bottom   the remote, beside the FAB: the four rules as dots (tap for
//            what they measured, in a sheet that leaves the page live), how
//            many occupants, the presets — what you reach for while pinned
//   panel    the fine knobs, in the page on a phone and beside it, pinned,
//            on a wide screen
// =============================================================================

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
const GROUPS: readonly BandGroup[] = ["all", "tray", "count"];
const FORMS: readonly BandForm[] = ["pill", "ball"];
/** The band's easing, and a little: when what moved has come to rest. */
const MOVE_MS = 400;

/** The page, measured whenever it may have moved. */
function useMeasure(deps: unknown): Measure | null {
  const [m, setM] = useState<Measure | null>(null);
  useEffect(() => {
    let raf = 0;
    let settle = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = measureBand(readBand());
        setM((prev) => (prev && sameMeasure(prev, next) ? prev : next));
      });
    };
    // A band change is measured now, and again once its third of a second
    // of easing has settled.
    const changed = () => {
      run();
      window.clearTimeout(settle);
      settle = window.setTimeout(run, MOVE_MS);
    };
    changed();
    const off = subscribeBand(changed);
    // The page, and a swipe in the Dock's row: any scroll, caught on the way down.
    document.addEventListener("scroll", run, { capture: true, passive: true });
    return () => {
      off();
      document.removeEventListener("scroll", run, { capture: true });
      window.clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [deps]);
  return m;
}

function Dot({ ok }: { ok: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        ok === null ? "bg-muted-foreground/30" : ok ? "bg-emerald-500" : "bg-red-500",
      )}
    />
  );
}

/** A knob that does nothing under the current choices: shown, but quiet. */
function Dim({ off, children }: { off: boolean; children: ReactNode }) {
  return (
    <div
      aria-disabled={off || undefined}
      className={cn("flex flex-col gap-1.5 transition-opacity", off && "pointer-events-none opacity-35")}
    >
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className={cn(TYPE.captionQuiet, "text-[11px] leading-relaxed")}>{children}</p>;
}

export function BandLabView() {
  const S = useLabStrings(BAND_STRINGS);
  const band = useBand();
  const { config } = band;
  const preset = presetOf(config);
  const [barKind, setBarKind] = useState<BarKind>("lab");
  const m = useMeasure(barKind);
  const music = useOptionalMusic();
  const windows = useOptionalWindows();
  // Read after an open, when this render's `windows` is already stale.
  const windowsRef = useRef(windows);
  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);


  const playMusic = () => {
    if (!music) return;
    // The offline fixture, swapped in without a reload; the pill appears
    // once something has played.
    if (!music.isMockEnabled) music.setMockEnabled(true);
    window.setTimeout(() => music.play(), 300);
  };
  const parkWindow = () => {
    const w = windowsRef.current;
    if (!w) return;
    const parked = new Set(w.windows.filter((x) => x.mode === "minimized").map((x) => x.app.id));
    const app = APPS.find((a) => !parked.has(a.id)) ?? APPS[0];
    w.openApp(app);
    // Opened, then parked once it exists: the provider's list is read
    // fresh, since this closure's is from before the open.
    window.setTimeout(() => {
      const win = windowsRef.current?.windows.find((x) => x.app.id === app.id);
      if (win) windowsRef.current?.minimize(win.id);
    }, 400);
  };
  const fireNotice = () =>
    showNotice({ id: "lab-band", icon: Sunset, title: S.noticeTitle, note: S.noticeNote, duration: 8000 });

  // Just past where the bar sticks: meeting the band starts a little early
  // (PinnedSlot), but the bar is only level with the Dock once it is pinned.
  const toPin = () => {
    const mark = document.querySelector<HTMLElement>("[data-band-pin-mark]");
    if (!mark) return;
    scrollPageTo(Math.max(0, pageScrollTop() + mark.getBoundingClientRect().top + 24), { behavior: "smooth" });
  };

  const barChips = (
    <div
      role="group"
      aria-label={S.bar}
      className="no-scrollbar -mx-1 flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto px-1"
    >
      {BAR_KINDS.map((b) => (
        <LabChip key={b} on={barKind === b} onClick={() => setBarKind(b)} className="shrink-0">
          {S.bars[b]}
        </LabChip>
      ))}
    </div>
  );

  const knobs = (
    <>
      <Section title={S.compose}>
        <Note>{S.composeNote}</Note>
        <Toggle label={S.share} value={config.share} onChange={(v) => setBandConfig({ share: v })} />
        <Note>{S.shareNote}</Note>
        <Dim off={!config.share}>
          <Field label={S.group}>
            <Segmented
              value={config.group}
              options={GROUPS.map((g) => ({ value: g, label: S.groups[g] }))}
              onChange={(v) => setBandConfig({ group: v })}
            />
          </Field>
          <Note>{S.groupNotes[config.group]}</Note>
          <Field label={S.form}>
            <Segmented
              value={config.form}
              options={FORMS.map((f) => ({ value: f, label: S.forms[f] }))}
              onChange={(v) => setBandConfig({ form: v })}
            />
          </Field>
        </Dim>
        <Dim off={!config.share || config.group !== "count"}>
          <Field label={S.openForm}>
            <Segmented
              value={config.openForm}
              options={FORMS.map((f) => ({ value: f, label: S.forms[f] }))}
              onChange={(v) => setBandConfig({ openForm: v })}
            />
          </Field>
        </Dim>
        <Dim off={!config.share || config.group !== "tray"}>
          <Field label={S.trayCap} hint={S.trayCapHint(config.trayCap)}>
            <Segmented
              value={String(config.trayCap)}
              options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => setBandConfig({ trayCap: Number(v) })}
            />
          </Field>
        </Dim>
        <Dim off={!config.share || config.group === "count" || config.barScrolls}>
          <Toggle label={S.peek} value={config.peek} onChange={(v) => setBandConfig({ peek: v })} />
          <Note>{S.peekNote}</Note>
        </Dim>
        <Dim off={!config.share || config.group !== "all"}>
          <Toggle label={S.barScrolls} value={config.barScrolls} onChange={(v) => setBandConfig({ barScrolls: v })} />
          <Note>{S.barScrollsNote}</Note>
        </Dim>
      </Section>
      <Section title={S.occupants}>
        <div className="flex flex-wrap gap-2">
          <LabButton tone="primary" disabled={!music} onClick={playMusic}>
            {S.music}
          </LabButton>
          <LabButton tone="primary" disabled={!windows} onClick={parkWindow}>
            {S.window}
          </LabButton>
          <LabButton onClick={fireNotice}>{S.notice}</LabButton>
        </div>
        <Note>{S.occupantsNote}</Note>
      </Section>
    </>
  );

  return (
    <LabShell
      lab="band"
      layout="canvas"
      pin={barKind === "lab" ? "band" : "static"}
      tools={barChips}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <LabPanel open className="lg:order-last lg:w-[340px]">
          {knobs}
        </LabPanel>

        <div className="min-w-0 flex-1 space-y-8">
          <LabSection title={S.pageTitle} note={S.pageNote}>
            <LabButton tone="primary" onClick={toPin}>
              <ArrowDownToLine />
              {S.pin}
            </LabButton>
          </LabSection>

          <span data-band-pin-mark="" className="block" />
          {(barKind === "prompt" || barKind === "works") && (
            // Pinned as PageLayout pins the pages' own: its glass half a rem
            // under the Dock's pills, in a column with the pages' gutter.
            <PinnedSlot
              key={barKind}
              className={cn("sticky z-30 mx-2 sm:mx-0", PINNED_TOP)}
            >
              {barKind === "prompt" ? <SamplePromptBar /> : <SampleWorksBar />}
            </PinnedSlot>
          )}

          <section className="space-y-4">
            <div className="space-y-3">
              {Array.from({ length: 28 }, (_, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/40 px-4 py-3">
                  <p className={TYPE.label}>{S.rowTitle(i)}</p>
                  <div className="h-2 w-[86%] rounded-full bg-muted/60" />
                  <div className="h-2 rounded-full bg-muted/40" style={{ width: `${40 + ((i * 37) % 50)}%` }} />
                </div>
              ))}
            </div>
            <LabButton onClick={() => scrollPageTo(0, { behavior: "smooth" })}>
              <ArrowUpToLine />
              {S.top}
            </LabButton>
          </section>
        </div>
      </div>

      <QuickBar m={m} band={band} barKind={barKind} preset={preset} S={S} />
    </LabShell>
  );
}

/** The four rules, measured, and what they measured. */
function Readout({
  m,
  band,
  barKind,
  S,
}: {
  m: Measure | null;
  band: BandState;
  barKind: BarKind;
  S: BandStrings;
}) {
  const geometry = useBandGeometry();
  const preset = presetOf(band.config);
  const presetName = preset ? S.presets[preset] : S.custom;
  const status = barKind === "none" ? S.noBar : !m || m.n === 0 ? S.empty : !band.met ? S.notMet : null;
  return (
    <div className="space-y-3 pb-2">
      <p className={cn(TYPE.captionQuiet, "text-[11px]")}>{S.readoutNote}</p>
      <p className="font-mono text-xs text-foreground">{S.meta(presetName, m?.n ?? 0, S.modes[geometry.mode])}</p>
      {status && <p className={TYPE.captionQuiet}>{status}</p>}
      <ul className="space-y-2">
        {CHECK_IDS.map((id) => {
          const ok = status ? null : (m?.checks[id] ?? null);
          const detail =
            id === "barUsable" && m?.barWidth != null && m.barMin != null
              ? S.barIs(m.barWidth, m.barMin)
              : id === "noOverlap" && m?.gap != null
                ? S.gapIs(m.gap)
                : id === "reachable" && m && m.behind > 0
                  ? S.tapAway(m.behind)
                  : id === "reachable" && m && m.swipe > 0
                    ? S.swipeAway(m.swipe)
                    : null;
          return (
            <li key={id} className="flex items-start gap-2.5">
              <span className="mt-1">
                <Dot ok={ok} />
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-medium text-foreground">{S.checks[id]}</span>
                  {detail && !status && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{detail}</span>
                  )}
                </span>
                <span className={cn(TYPE.captionQuiet, "block text-[11px]")}>{S.checkNotes[id]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The harness, at the bottom: what you reach for while the bar is pinned —
 * the four rules as dots, how many occupants, the presets. It stands where
 * the FAB stands, left of it, well clear of the band it is for.
 */
function QuickBar({
  m,
  band,
  barKind,
  preset,
  S,
}: {
  m: Measure | null;
  band: BandState;
  barKind: BarKind;
  preset: PresetId | null;
  S: BandStrings;
}) {
  const live = !!m && m.n > 0 && band.met;
  const [readout, setReadout] = useState(false);
  const step = "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30";
  return (
    <div className="pointer-events-none fixed bottom-6 left-4 right-[5.5rem] z-40 flex sm:left-6">
      <div className="ink-flat pointer-events-auto flex h-12 min-w-0 max-w-full items-center gap-2 rounded-full border border-border/50 bg-glass-popover pl-3.5 pr-1.5 shadow-overlay backdrop-blur-xl">
        <button
          type="button"
          aria-label={S.readout}
          aria-expanded={readout}
          onClick={() => setReadout((o) => !o)}
          className="-ml-1.5 flex h-9 shrink-0 items-center gap-1 rounded-full px-1.5 hover:bg-foreground/[0.06]"
        >
          {CHECK_IDS.map((id) => (
            <span key={id} title={S.checks[id]} className="inline-flex">
              <Dot ok={live ? (m?.checks[id] ?? null) : null} />
            </span>
          ))}
        </button>
        <span className="h-5 w-px shrink-0 bg-border" />
        <span className="flex shrink-0 items-center" title={S.samples}>
          <button
            type="button"
            aria-label={`${S.samples} −`}
            onClick={() => setBandSamples(band.samples - 1)}
            disabled={band.samples === 0}
            className={step}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-4 text-center font-mono text-xs tabular-nums text-foreground">{band.samples}</span>
          <button
            type="button"
            aria-label={`${S.samples} +`}
            onClick={() => setBandSamples(band.samples + 1)}
            disabled={band.samples === MAX_SAMPLES}
            className={step}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </span>
        <span className="h-5 w-px shrink-0 bg-border" />
        <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto rounded-full">
          {PRESET_IDS.map((id) => (
            <LabChip key={id} on={preset === id} onClick={() => setBandConfig(PRESETS[id])} className="shrink-0">
              {S.presets[id]}
            </LabChip>
          ))}
        </div>
      </div>
      {/* What the dots measured. A sheet, not modal: the page stays live
          under it, so a swipe in the band shows in it as it happens. */}
      <AdaptiveSurface
        id="band-lab-readout"
        open={readout}
        onOpenChange={setReadout}
        presentation={{ base: "sheet" }}
        sheetMaxWidth="400px"
        title={S.readout}
        closeLabel={S.close}
        fitContent
      >
        <Readout m={m} band={band} barKind={barKind} S={S} />
      </AdaptiveSurface>
    </div>
  );
}
