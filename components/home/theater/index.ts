import { TheaterChannelForm } from "./channel-form";
import { TheaterReelForm } from "./reel-form";
import { TheaterTourForm } from "./tour-form";

// The theater widget's forms, by the ids `HOME_WIDGETS` declares for it.
// One library (systems/theater/lib/library.ts), three readings: what is
// featured, what is on now, where it was said.
export const THEATER_FORMS = {
  reel: TheaterReelForm,
  channel: TheaterChannelForm,
  tour: TheaterTourForm,
};
