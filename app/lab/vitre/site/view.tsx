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
import { useMounted } from "@/components/ui/use-mounted";
import type { ReactNode } from "react";
import { useVitre } from "vitre";
import { SITE_STRINGS } from "./strings";

const FAMILIES: WallpaperFamily[] = ["picture", "wash"];

const FILES: LibraryFile[] = [
  {
    path: "packages/vitre",
    role: {
      en: "The package: <Vitre>, the boot script, the page-scroll API.",
      zh: "包本身：<Vitre>、启动脚本、页面滚动 API。",
    },
  },
  {
    path: "app/layout.tsx",
    role: {
      en: "The boot script in <head>: the first frame, before React.",
      zh: "<head> 里的启动脚本：React 之前的第一帧。",
    },
  },
  {
    path: "systems/ambient/lib/bezel.ts",
    role: {
      en: "The rule above, the bezel tints, and the boot resolver.",
      zh: "上面那条规则、bezel 的配色，以及启动解析器。",
    },
  },
  {
    path: "systems/ambient/components/surface.tsx",
    role: {
      en: "<Vitre> around every page, with the wallpaper as its backdrop.",
      zh: "每一页外面的 <Vitre>，壁纸是它的背景层。",
    },
  },
  {
    path: "systems/devtool/panel.tsx",
    role: {
      en: "The devtool's Bezel section: every knob, live.",
      zh: "开发者工具的 Bezel 一节：每个旋钮，实时生效。",
    },
  },
  {
    path: "components/ui/use-hero-fade.ts",
    role: {
      en: "One of the places the site listens to the page's scroll through vitre, so it works in either scroll.",
      zh: "本站通过 vitre 监听页面滚动的地方之一，两种滚动方式下都能用。",
    },
  },
];

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
