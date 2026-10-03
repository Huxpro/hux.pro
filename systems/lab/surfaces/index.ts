import type { LabId } from "../catalog";
import type { ComponentType } from "react";
import { AttachmentsSurface } from "./attachments";
import { BandSurface } from "./band";
import { DoorSurface } from "./door";
import { GlowSurface } from "./glow";
import { IconSurface } from "./icon";
import { LegibilitySurface } from "./legibility";
import { VitreSurface } from "./vitre";
import { WorksSurface } from "./works";

/**
 * Each lab, small: the surface its card on /lab wears and the home screen's
 * Lab widget rotates through. One per entry in systems/lab/catalog.ts.
 */
export const LAB_SURFACES: Record<LabId, ComponentType> = {
  works: WorksSurface,
  attachments: AttachmentsSurface,
  icon: IconSurface,
  legibility: LegibilitySurface,
  glow: GlowSurface,
  band: BandSurface,
  vitre: VitreSurface,
  door: DoorSurface,
};

export { SurfaceFrame } from "./frame";
