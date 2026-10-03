"use client";

import { ExperienceProse, ExperienceShell, ExperienceTitle, useLabStrings } from "@/systems/lab";
import { TORCH_STRINGS } from "./strings";

// =============================================================================
// /lab/torch, Torch: the same dream as The Wardrobe, under the blanket.
//
// The experience is public/dreams/torch/index.html. Drag to shine the torch;
// his eyes are always in the dark just outside it, and the wardrobe door
// opens whenever the light is off it. After he has slipped away three times
// the torch fails, and in the dark he is at the bed.
// =============================================================================

export function TorchLabView() {
  const S = useLabStrings(TORCH_STRINGS);
  return (
    <ExperienceShell lab="torch" how={S.how}>
      <ExperienceTitle>{S.title}</ExperienceTitle>
      {S.story.map((p) => (
        <ExperienceProse key={p}>{p}</ExperienceProse>
      ))}
    </ExperienceShell>
  );
}
