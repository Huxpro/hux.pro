"use client";

import { useLocale } from "@/services";
import { experienceSrc } from "../components/experience";
import { SurfaceFrame } from "./frame";

/**
 * Reintent Core at a glance: The Wardrobe it hosts, on its first frame
 * (`?stage=0`) with its own controls hidden (`quiet`), like an experience's card.
 */
export function ReintentSurface() {
  const { locale } = useLocale();
  return (
    <SurfaceFrame className="bg-black">
      <iframe
        src={experienceSrc("/scenes/reintent/index.html", locale, { stage: "0", quiet: "1" })}
        title="Reintent Core"
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
      />
    </SurfaceFrame>
  );
}
