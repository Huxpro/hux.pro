"use client";

// =============================================================================
// /lab/vitre/site — the library template's "On hux.pro" page, for Vitre.
//
// How this site uses its own package, read-only: what vitre is drawing on
// this page now (from the package, useVitre), the site's rule for when the
// bezel is on (systems/ambient/lib/bezel.ts), and the files it lives in. It
// changes nothing — the knobs are the devtool's, one explicit tap away.
// =============================================================================

import { LabButton, LabSection, LibraryFiles, LibraryShell, useLabStrings, type LibraryFile } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useWallpaper } from "@/systems/ambient";
import { WALLPAPER_FAMILY_EDGES } from "@/systems/ambient/lib/bezel";
import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import { getWallpaperLook, WALLPAPER_LOOK_FAMILY, type WallpaperFamily } from "@/systems/ambient/lib/wallpaper";
import { useDevtool } from "@/systems/devtool";
import { useSyncExternalStore, type ReactNode } from "react";
import { useVitre } from "vitre";
import { SITE_STRINGS } from "./strings";

const FAMILIES: WallpaperFamily[] = ["picture", "wash"];

const role = (key: keyof typeof SITE_STRINGS.en.roles) => ({ en: SITE_STRINGS.en.roles[key], zh: SITE_STRINGS.zh.roles[key] });

const FILES: LibraryFile[] = [
  { path: "packages/vitre", role: role("pkg") },
  { path: "app/layout.tsx", role: role("layout") },
  { path: "systems/ambient/lib/bezel.ts", role: role("bezel") },
  { path: "systems/ambient/components/surface.tsx", role: role("surface") },
  { path: "systems/devtool/panel.tsx", role: role("devtool") },
  { path: "components/ui/use-hero-fade.ts", role: role("scroll") },
];

/** A client-only read, false on the server and the first render. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function VitreSiteView() {
  const S = useLabStrings(SITE_STRINGS);
  const vitre = useVitre();
  const wallpaper = useWallpaper();
  const devtool = useDevtool();
  const ios = useMounted() && isIOSBrowser();

  const family = WALLPAPER_LOOK_FAMILY[getWallpaperLook(wallpaper.kind, wallpaper.effectiveStyle)];
  const forced = wallpaper.devtoolOverrides.bezel !== undefined;
  const reason = forced
    ? S.reasonForced
    : !ios
      ? S.reasonNotIos
      : WALLPAPER_FAMILY_EDGES[family].bezel
        ? S.reasonOn
        : S.reasonWash;


  return (
    <LibraryShell lab="vitre" page="site">
      <div className="space-y-12">
        <LabSection title={S.now} note={S.nowNote}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Readout label={S.bezel}>{vitre.enabled ? S.on : S.off}</Readout>
            <Readout label="color">
              <Swatch color={vitre.color} />
            </Readout>
            <Readout label="band">{vitre.band}px</Readout>
            <Readout label="radius">{vitre.radius}px</Readout>
            <Readout label="scroll">{vitre.scroll}</Readout>
            <Readout label="ground">
              <Swatch color={vitre.ground} />
            </Readout>
          </div>
          <p className={TYPE.caption}>{reason}</p>
        </LabSection>

        <LabSection title={S.rule} note={S.ruleNote}>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-glass backdrop-blur-xl">
            <div className="grid grid-cols-3 border-b border-border/50 px-4 py-2 font-mono text-[11px] text-tertiary-foreground">
              <span>{S.family}</span>
              <span>bezel</span>
              <span>{S.softEdge}</span>
            </div>
            {FAMILIES.map((f) => (
              <div
                key={f}
                className={cn(
                  "grid grid-cols-3 px-4 py-2.5 font-mono text-xs text-muted-foreground",
                  f === family && "bg-foreground/[0.04] text-foreground",
                )}
              >
                <span>
                  {f}
                  {f === family && <span className="ml-2 text-[10px] text-tertiary-foreground">{S.current}</span>}
                </span>
                <span>{WALLPAPER_FAMILY_EDGES[f].bezel ? S.yes : S.no}</span>
                <span>{WALLPAPER_FAMILY_EDGES[f].softEdge ? S.yes : S.no}</span>
              </div>
            ))}
          </div>
        </LabSection>

        <LabSection title={S.files} note={S.filesNote}>
          <LibraryFiles files={FILES} />
        </LabSection>

        <LabSection title={S.try} note={S.tryNote}>
          <LabButton tone="primary" className="self-start" onClick={devtool.summon}>
            {S.openDevtool}
          </LabButton>
        </LabSection>
      </div>
    </LibraryShell>
  );
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-glass px-3 py-2.5 backdrop-blur-xl">
      <p className="font-mono text-[11px] text-tertiary-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-foreground">{children}</p>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-3 shrink-0 rounded-full border border-border" style={{ background: color }} />
      {color}
    </span>
  );
}
