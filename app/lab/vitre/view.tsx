"use client";

// =============================================================================
// Vitre Lab — /lab/vitre
//
// The page's edges and Safari's glass: packages/vitre, as this site
// configures it (systems/ambient/lib/bezel.ts). Not a demo of the package —
// that is /vitre, its own site — but the package on this page, now:
//
//   now      what vitre is drawing, read from vitre itself (useVitre), with a
//            drawing of the frame at the numbers it has
//   policy   the site's rule for when the bezel is on (a picture is framed, a
//            wash fades), with the row that is deciding right now
//   package  its three words — bezel, chrome, scroll
//
// The panel is the devtool's Bezel section at lab size. Tint, band and radius
// are the saved settings the devtool writes. The bezel switch and the scroll
// are session overrides, which only act while the devtool is enabled — so
// the lab enables it, as the Legibility Lab does, and puts it, the overrides
// and the hero exit back when you leave.
// =============================================================================

import { ColorField, Field, Section, Segmented, Slider, Toggle } from "@/app/lab/controls";
import { useLabStrings } from "@/app/lab/i18n";
import { LabSection, LabShell, labButtonClass } from "@/app/lab/shell";
import { useHeroExit, type HeroExit } from "@/components/ui/hero-exit";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useWallpaper } from "@/systems/ambient";
import {
  BEZEL_TINTS,
  isBezelHex,
  WALLPAPER_FAMILY_EDGES,
  type BezelTint,
} from "@/systems/ambient/lib/bezel";
import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import {
  getWallpaperLook,
  WALLPAPER_LOOK_FAMILY,
  type WallpaperFamily,
  type WallpaperLook,
} from "@/systems/ambient/lib/wallpaper";
import { useDevtool } from "@/systems/devtool";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_RADIUS_MAX,
  onPageScroll,
  pageScrollTop,
  useVitre,
  type VitreScroll,
} from "vitre";
import { FrameDrawing } from "@/components/lab/surfaces/vitre";
import { VITRE_STRINGS } from "./strings";

type TintChoice = (typeof BEZEL_TINTS)[number] | "custom";

const FAMILIES: WallpaperFamily[] = ["picture", "wash"];
const LOOKS_OF: Record<WallpaperFamily, WallpaperLook[]> = {
  picture: (Object.keys(WALLPAPER_LOOK_FAMILY) as WallpaperLook[]).filter((l) => WALLPAPER_LOOK_FAMILY[l] === "picture"),
  wash: (Object.keys(WALLPAPER_LOOK_FAMILY) as WallpaperLook[]).filter((l) => WALLPAPER_LOOK_FAMILY[l] === "wash"),
};

/** The page's scroll position, from vitre's page-scroll API (window or container alike). */
function usePageScrollTop() {
  return useSyncExternalStore(onPageScroll, () => Math.round(pageScrollTop()), () => 0);
}

/** A client-only read, the same on the server and the first render. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function VitreLabView() {
  const S = useLabStrings(VITRE_STRINGS);
  const vitre = useVitre();
  const wallpaper = useWallpaper();
  const devtool = useDevtool();
  const heroExit = useHeroExit();
  const scrollTop = usePageScrollTop();
  const mounted = useMounted();
  const ios = mounted && isIOSBrowser();

  const look = getWallpaperLook(wallpaper.kind, wallpaper.effectiveStyle);
  const family = WALLPAPER_LOOK_FAMILY[look];
  const forced = wallpaper.devtoolOverrides.bezel !== undefined;

  // --- The session overrides need the devtool on; put everything back on leave.
  const live = useRef({ wallpaper, devtool });
  useEffect(() => {
    live.current = { wallpaper, devtool };
  });
  useEffect(() => {
    const { wallpaper: w, devtool: d } = live.current;
    const initial = {
      devtool: d.isEnabled,
      overrides: w.devtoolOverrides,
      heroExit: d.heroExitOverride,
    };
    d.setEnabled(true);
    return () => {
      const { wallpaper: w2, devtool: d2 } = live.current;
      w2.setDevtoolOverrides(initial.overrides);
      d2.setHeroExitOverride(initial.heroExit);
      d2.setEnabled(initial.devtool);
    };
  }, []);

  const setOverride = (patch: { bezel?: boolean; scroll?: VitreScroll }) =>
    wallpaper.setDevtoolOverrides({ ...wallpaper.devtoolOverrides, ...patch });

  // A custom tint keeps its colour while the picker is open on it.
  const [customHex, setCustomHex] = useState<string>(() =>
    isBezelHex(wallpaper.bezelTint) ? wallpaper.bezelTint : "#3a3a3a",
  );
  const tintChoice: TintChoice = isBezelHex(wallpaper.bezelTint) ? "custom" : wallpaper.bezelTint;

  const meta = S.meta(vitre.enabled, vitre.color, vitre.band, vitre.radius, vitre.scroll);

  const panel = (
    <>
      <Section title={S.bezel}>
        <Toggle value={wallpaper.bezel} onChange={(on) => setOverride({ bezel: on })} label={S.bezelOn} />
        {forced && (
          <button
            type="button"
            onClick={() => setOverride({ bezel: undefined })}
            className="self-start font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {S.auto}
          </button>
        )}
        <Field label={S.tint} hint={wallpaper.bezelColor}>
          <Segmented<TintChoice>
            value={tintChoice}
            onChange={(choice) =>
              wallpaper.setBezelTint(choice === "custom" ? (customHex as BezelTint) : choice)
            }
            options={[...BEZEL_TINTS, "custom" as const].map((value) => ({ value, label: S.tints[value] }))}
          />
        </Field>
        {tintChoice === "custom" && (
          <ColorField
            value={wallpaper.bezelTint}
            onChange={(hex) => {
              if (!isBezelHex(hex)) return;
              setCustomHex(hex);
              wallpaper.setBezelTint(hex);
            }}
          />
        )}
        <Field label={S.band} hint={`${wallpaper.bezelBand}px`}>
          <Slider
            value={wallpaper.bezelBand}
            min={BEZEL_BAND_MIN}
            max={BEZEL_BAND_MAX}
            step={1}
            onChange={(v) => wallpaper.setBezelBand(v)}
          />
        </Field>
        <Field label={S.radius} hint={`${wallpaper.bezelRadius}px`}>
          <Slider
            value={wallpaper.bezelRadius}
            min={0}
            max={BEZEL_RADIUS_MAX}
            step={2}
            onChange={(v) => wallpaper.setBezelRadius(v)}
          />
        </Field>
      </Section>
      <Section title={S.page}>
        <Field label={S.scroll} hint={wallpaper.devtoolOverrides.scroll ? S.forced : undefined}>
          <Segmented<VitreScroll>
            value={wallpaper.bezelScroll}
            onChange={(scroll) => setOverride({ scroll })}
            options={(["window", "container"] as const).map((value) => ({ value, label: S.scrolls[value] }))}
          />
        </Field>
        <Field label={S.heroExit}>
          <Segmented<HeroExit>
            value={heroExit}
            onChange={devtool.setHeroExitOverride}
            options={(["fade", "scroll"] as const).map((value) => ({ value, label: S.heroExits[value] }))}
          />
        </Field>
        <p className={TYPE.captionQuiet}>{S.panelNote}</p>
      </Section>
    </>
  );

  return (
    <LabShell
      lab="vitre"
      layout="workbench"
      meta={meta}
      actions={
        <a href="/vitre" className={labButtonClass()}>
          {S.docs}
          <ArrowUpRight />
        </a>
      }
      panel={panel}
    >
      <LabSection title={S.now} note={S.nowNote}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-5 sm:gap-8">
          <FrameDrawing
            className="sm:hidden"
            scale={0.22}
            on={vitre.enabled}
            color={vitre.color}
            band={vitre.band}
            radius={vitre.radius}
            ground={vitre.ground}
          />
          <FrameDrawing
            className="hidden sm:block"
            on={vitre.enabled}
            color={vitre.color}
            band={vitre.band}
            radius={vitre.radius}
            ground={vitre.ground}
          />
          <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-xs sm:gap-x-6">
            <Row k={S.stateBezel} v={vitre.enabled ? S.on : S.off} strong />
            <Row
              k={S.stateChrome}
              v={
                <span className="inline-flex items-center gap-2">
                  <Swatch color={vitre.enabled ? vitre.color : vitre.ground} />
                  {S.chromeNote(vitre.enabled ? vitre.color : vitre.ground)}
                </span>
              }
            />
            <Row k={S.stateBand} v={`${vitre.band}px`} />
            <Row k={S.stateRadius} v={`${vitre.radius}px`} />
            <Row k={S.stateScroll} v={S.scrolls[vitre.scroll]} />
            <Row
              k={S.stateGround}
              v={
                <span className="inline-flex items-center gap-2">
                  <Swatch color={vitre.ground} />
                  {vitre.ground}
                </span>
              }
            />
            <Row k={S.statePlatform} v={mounted ? (ios ? S.ios : S.notIos) : "…"} />
            <Row k={S.stateScrollTop} v={`${scrollTop}px`} />
          </dl>
        </div>
      </LabSection>

      <LabSection title={S.policy} note={S.policyNote}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-separate border-spacing-0 font-mono text-xs">
            <thead>
              <tr className="text-left text-tertiary-foreground">
                {[S.colFamily, S.colLooks, S.colBezel, S.colSoftEdge].map((h) => (
                  <th key={h} className="border-b border-border/50 px-3 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAMILIES.map((f) => {
                const edges = WALLPAPER_FAMILY_EDGES[f];
                const here = f === family;
                return (
                  <tr key={f} className={cn(here && "bg-foreground/[0.04]")}>
                    <td className="border-b border-border/30 px-3 py-2.5 text-foreground">
                      {S.families[f]}
                      {here && <span className="ml-2 text-tertiary-foreground">← {S.current}</span>}
                    </td>
                    <td className="border-b border-border/30 px-3 py-2.5 text-muted-foreground">
                      {LOOKS_OF[f].map((l) => (
                        <span key={l} className={cn("mr-2", l === look && "text-foreground underline underline-offset-4")}>
                          {S.looks[l]}
                        </span>
                      ))}
                    </td>
                    <td className="border-b border-border/30 px-3 py-2.5 text-foreground">
                      {edges.bezel ? S.on : S.off}
                      {here && forced && <span className="ml-2 text-amber-500/90">· {S.forced}</span>}
                    </td>
                    <td className="border-b border-border/30 px-3 py-2.5 text-foreground">
                      {edges.softEdge ? S.on : S.off}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LabSection>

      <LabSection title={S.words} note={S.wordsNote}>
        <dl className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["bezel", S.wordBezel],
              ["chrome", S.wordChrome],
              ["scroll", S.wordScroll],
            ] as const
          ).map(([word, meaning]) => (
            <div key={word} className="rounded-2xl bg-muted/40 p-4">
              <dt className={cn(TYPE.rowTitle, "font-mono")}>{word}</dt>
              <dd className={cn(TYPE.caption, "mt-1")}>{meaning}</dd>
            </div>
          ))}
        </dl>
      </LabSection>
    </LabShell>
  );
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <>
      <dt className="text-tertiary-foreground">{k}</dt>
      <dd className={cn("min-w-0 tabular-nums", strong ? "text-foreground" : "text-muted-foreground")}>{v}</dd>
    </>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="size-3 shrink-0 rounded-sm border border-border/60" style={{ background: color }} />;
}
