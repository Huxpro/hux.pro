"use client";

import iconJson from "@/content/icon.json";
import { normalizeIconConfig } from "@/lib/icon/config";
import { buildIconSvg } from "@/lib/icon/render";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { SurfaceFrame } from "./frame";

const config = normalizeIconConfig(iconJson);
const SIZES = [72, 40, 24, 16];

/**
 * The Icon Lab at a glance: the committed icon (content/icon.json), inlined so
 * the wordmark sets in the page's own mono, down the ladder of sizes it ships.
 */
export function IconSurface() {
  // One render per tile, each with its own id prefix, so the copies' defs
  // never cross-wire (the Icon Lab does the same for its previews).
  const tiles = useMemo(
    () =>
      SIZES.map((px) => ({
        px,
        html: buildIconSvg(config, { size: 512, idPrefix: `lab-surface-${px}`, fontFamily: "var(--font-mono)" }),
      })),
    [],
  );
  return (
    <SurfaceFrame className="flex items-end justify-center gap-5 px-4 pb-4 pt-5">
      {tiles.map(({ px, html }) => (
        <div key={px} className="flex flex-col items-center gap-1.5">
          <div
            className="overflow-hidden rounded-[22%] ring-1 ring-border/40 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            style={{ width: px, height: px }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <span className={cn(TYPE.labelSm, "tabular-nums")}>{px}</span>
        </div>
      ))}
    </SurfaceFrame>
  );
}
