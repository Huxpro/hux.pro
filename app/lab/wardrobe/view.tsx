"use client";

import { ExperienceProse, ExperienceShell, ExperienceTitle, useLabStrings } from "@/systems/lab";
import { LANGUAGE } from "@/experiences/wardrobe/semantics";
import { WARDROBE_STRINGS } from "./strings";

// =============================================================================
// /lab/wardrobe, The Wardrobe: a childhood nightmare, in three blinks.
//
// The experience is experiences/wardrobe, built on packages/scene into
// public/dreams/wardrobe (the home folder opens the same page as an app).
// Hold to close your eyes; each time they open he is closer: in the wardrobe,
// at the open door, at the bed. The third time, you wake, and the door opens
// on its own. Its language layer makes it inspectable here.
// =============================================================================

export function WardrobeLabView() {
  const S = useLabStrings(WARDROBE_STRINGS);
  return (
    <ExperienceShell lab="wardrobe" how={S.how} language={LANGUAGE}>
      <ExperienceTitle>{S.title}</ExperienceTitle>
      {S.story.map((p) => (
        <ExperienceProse key={p}>{p}</ExperienceProse>
      ))}
    </ExperienceShell>
  );
}
