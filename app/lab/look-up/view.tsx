"use client";

import { ExperienceProse, ExperienceShell, ExperienceTitle, useLabStrings } from "@/systems/lab";
import { LOOK_UP_STRINGS } from "./strings";

// =============================================================================
// /lab/look-up, Look Up: the same dream as The Wardrobe, from the pillow.
//
// The experience is public/dreams/look-up/index.html. Drag up to raise your
// eyes along him; the higher, the heavier, and they sink back when you let
// go. At the top he is looking at you, and then he bends.
// =============================================================================

export function LookUpLabView() {
  const S = useLabStrings(LOOK_UP_STRINGS);
  return (
    <ExperienceShell lab="look-up" how={S.how}>
      <ExperienceTitle>{S.title}</ExperienceTitle>
      {S.story.map((p) => (
        <ExperienceProse key={p}>{p}</ExperienceProse>
      ))}
    </ExperienceShell>
  );
}
