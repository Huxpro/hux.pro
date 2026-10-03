"use client";

import { useLocale } from "@/services";
import { experienceById, type LabId } from "../catalog";
import { experienceSrc } from "../components/experience";
import { SurfaceFrame } from "./frame";

/**
 * An experience at a glance: the document itself, small, held on its first
 * frame (`?stage=0`) with its own controls hidden (`quiet`). Still live, so
 * what it does on its own (a door that gives, an eye in the gap) it does
 * here too. The host is the way in; the frame takes no taps.
 */
export function ExperienceSurface({ id }: { id: LabId }) {
  const lab = experienceById(id);
  const { locale } = useLocale();
  return (
    <SurfaceFrame className="bg-black">
      <iframe
        src={experienceSrc(lab.experience.src, locale, { stage: "0", quiet: "1" })}
        title={lab.name[locale]}
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
      />
    </SurfaceFrame>
  );
}

export function WardrobeSurface() {
  return <ExperienceSurface id="wardrobe" />;
}
