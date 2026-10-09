"use client";

import { useLabStrings } from "../i18n";
import { cn } from "@/lib/utils";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

/**
 * The Nightmare Lab at a glance: the towering silhouette wearing the wide hat
 * emerging from the darkness of a wardrobe, and the creeping dread line.
 */
export function NightmareSurface() {
  const S = useLabStrings(SURFACE_STRINGS);
  return (
    <SurfaceFrame className="flex flex-col items-center justify-center bg-black/95 px-4 py-2 overflow-hidden border border-neutral-900">
      {/* Background dark room gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,_#11141c_0%,_#050608_65%,_#000000_100%)] opacity-80" />

      {/* Mini Silhouette of the Tall Man */}
      <div className="relative z-10 flex flex-col items-center mt-2">
        <svg width="140" height="90" viewBox="0 0 140 90" fill="none" className="overflow-visible">
          {/* Hat crown */}
          <ellipse cx="70" cy="18" rx="14" ry="4" fill="#030406" />
          <path d="M 56 18 C 56 11, 84 11, 84 18 L 83 28 L 57 28 Z" fill="#07080c" />
          {/* Enormous flat circular brim */}
          <ellipse cx="70" cy="28" rx="46" ry="10" fill="#020204" stroke="#1c1f2b" strokeWidth="0.8" />
          {/* Subtle eyes */}
          <ellipse cx="67" cy="36" rx="1" ry="0.8" fill="#d2d7e4" />
          <ellipse cx="73" cy="36" rx="1" ry="0.8" fill="#d2d7e4" />
          {/* Gaunt head */}
          <path d="M 64 30 C 63 38, 65 44, 70 47 C 75 44, 77 38, 76 30 Z" fill="#07080b" />
          {/* Slender body */}
          <path
            d="M 70 47 
               C 58 48, 52 54, 50 64
               L 47 95
               L 93 95
               L 90 64
               C 88 54, 82 48, 70 47 Z"
            fill="#050609"
          />
        </svg>
      </div>

      {/* Live caption */}
      <div className="relative z-10 mt-1 flex items-center gap-1.5 font-mono text-[10px] text-neutral-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
        <span className="truncate">{S.nightmareAwake}</span>
      </div>
    </SurfaceFrame>
  );
}
