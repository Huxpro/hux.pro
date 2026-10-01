import { TheaterReelForm } from "./reel-form";
import { TheaterTimelineForm } from "./timeline-form";
import { TheaterTourForm } from "./tour-form";

// The theater widget's forms, by the ids `HOME_WIDGETS` declares for it.
// One library (systems/theater/lib/library.ts), three readings: what is
// featured, when it was given, where.
export const THEATER_FORMS = {
  reel: TheaterReelForm,
  timeline: TheaterTimelineForm,
  tour: TheaterTourForm,
};
