import { Maximize2, PictureInPicture2, Volume2 } from "lucide-react";

// ---------------------------------------------------------------------------
// The three exclusive player views and their shared vocabulary, so the
// labelled SurfaceSwitch (Live Activity) and the icon-only move buttons
// (theater toolbar, PiP bar) never drift on icon or wording.
// ---------------------------------------------------------------------------

export type TheaterSurface = "theater" | "pip" | "mini";

export const SURFACE_ICON = {
  theater: Maximize2,
  pip: PictureInPicture2,
  mini: Volume2,
} as const;

export const SURFACE_LABEL_KEY = {
  theater: "theaterSurfaceTheater",
  pip: "theaterSurfacePip",
  mini: "theaterSurfaceMini",
} as const;
