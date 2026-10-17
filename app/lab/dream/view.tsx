"use client";

import { ExperienceProse, ExperienceShell, ExperienceTitle, useLabStrings } from "@/systems/lab";
import { DREAM_STRINGS } from "./strings";

// =============================================================================
// /lab/dream, A Dream, Told: a player for dreams written as intent trees.
//
// The experience is experiences/dream, built on packages/scene and
// packages/intents into public/scenes/dream. It has no dream of its own: it
// plays a tree's beats. Inspect lays the loop open, and there a new dream is
// told: the strong model writes a new tree (or the stand-in, from the words),
// and the same player plays it.
// =============================================================================

export function DreamLabView() {
  const S = useLabStrings(DREAM_STRINGS);
  return (
    <ExperienceShell lab="dream" how={S.how} inspect>
      <ExperienceTitle>{S.title}</ExperienceTitle>
      {S.story.map((p) => (
        <ExperienceProse key={p}>{p}</ExperienceProse>
      ))}
    </ExperienceShell>
  );
}
