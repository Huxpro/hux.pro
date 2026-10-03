"use client";

import { ExperienceStage, LabShell, useLabStrings } from "@/systems/lab";
import { STRINGS } from "./strings";

export function DoorLabView() {
  const S = useLabStrings(STRINGS);
  return (
    <LabShell lab="door" layout="canvas" meta={S.meta}>
      <ExperienceStage lab="door" />
    </LabShell>
  );
}
