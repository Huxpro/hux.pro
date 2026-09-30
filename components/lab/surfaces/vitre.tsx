"use client";

import { useLabStrings } from "@/app/lab/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

/**
 * The Vitre lab at a glance: the library, not this site's use of it — a phone
 * as the demo draws itself by default, in the bezel's black with the page's
 * aurora inside and Safari's bars taking the colour, and what the package is.
 */
export function VitreSurface() {
  const S = useLabStrings(SURFACE_STRINGS);
  return (
    <SurfaceFrame className="flex items-center justify-center gap-5 px-4">
      <DemoPhone />
      <div className="min-w-0 space-y-1.5">
        <p className="font-mono text-sm text-foreground">vitre</p>
        <p className={cn(TYPE.caption, "max-w-[11rem]")}>{S.vitreTagline}</p>
        <p className={TYPE.labelSm}>React · iOS 26 Safari</p>
      </div>
    </SurfaceFrame>
  );
}

/** A 60×124 iPhone: black chrome (the bezel colour), rounded page, aurora. */
function DemoPhone() {
  return (
    <div
      aria-hidden
      className="relative h-[124px] w-[60px] shrink-0 overflow-hidden rounded-[14px] bg-black shadow-raised ring-1 ring-black/40"
    >
      {/* Status bar and toolbar: the chrome, in the bezel's black. */}
      <span className="absolute left-1/2 top-[5px] h-[5px] w-[18px] -translate-x-1/2 rounded-full bg-white/15" />
      <div
        className="absolute inset-x-[3px] bottom-[15px] top-[14px] overflow-hidden rounded-[7px]"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 10%, #b9a8ff 0%, transparent 60%), radial-gradient(100% 70% at 90% 40%, #8fe3e8 0%, transparent 55%), linear-gradient(180deg, #eef2ff, #ffffff)",
        }}
      >
        <div className="flex flex-col gap-[3px] p-[5px]">
          <span className="h-[3px] w-1/3 rounded-full bg-black/25" />
          <span className="mt-[3px] h-[6px] w-5/6 rounded-sm bg-black/20" />
          <span className="h-[9px] w-full rounded-[3px] bg-white/70" />
          <span className="h-[9px] w-full rounded-[3px] bg-white/70" />
          <span className="h-[9px] w-full rounded-[3px] bg-white/70" />
        </div>
      </div>
      <span className="absolute inset-x-[12px] bottom-[5px] h-[6px] rounded-full bg-white/15" />
    </div>
  );
}
