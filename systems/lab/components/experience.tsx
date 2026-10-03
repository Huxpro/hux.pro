"use client";

import { useLocale } from "@/services";
import { labById, type LabId } from "../catalog";

/**
 * The piece, phone-shaped, on the lab's canvas.
 *
 * The same document the home-screen app iframes (`play` on the catalog
 * entry), so the lab and the app cannot drift. The site's chrome stays
 * outside this frame: a window on the home screen is the piece alone.
 */
export function ExperienceStage({ lab }: { lab: LabId }) {
  const { locale } = useLocale();
  const entry = labById(lab);
  if (entry.kind !== "experience") return null;
  const join = entry.play.includes("?") ? "&" : "?";
  const src = `${entry.play}${join}lang=${locale}`;
  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="relative h-[calc(100svh-8.5rem)] max-h-[820px] overflow-hidden bg-[#0c0a09] sm:rounded-[1.75rem] sm:ring-1 sm:ring-white/10">
        <iframe
          src={src}
          title={entry.name[locale]}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
