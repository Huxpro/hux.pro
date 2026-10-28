// =============================================================================
// Dock System: shared "Live Activity" pill ⇄ panel surface
//
// A coordination layer (DockProvider/useDock) + a reusable morph primitive
// (LiveActivity) + the top-of-screen layout (Dock). Activities from other
// systems (music, ambient) plug in by rendering a <LiveActivity /> as a child
// of <Dock />. A one-line notice from anywhere is `showNotice` (notice.ts),
// shown in the same place.
// =============================================================================

export { Dock, LiveActivity, SampleActivities } from "./components";
export { DockProvider, useDock } from "./provider";
export {
  dismissNotice,
  NOTICE_DURATION_MS,
  NOTICE_SLOT_ATTRIBUTE,
  showNotice,
  useNotice,
  type Notice,
} from "./notice";
export {
  CAPSULE,
  GAP,
  MAX_SAMPLES,
  OUTSET_X,
  PRESETS,
  bandGeometry,
  presetOf,
  readBand,
  setBandBar,
  setBandConfig,
  setBandDock,
  setBandMet,
  setBandOpen,
  setBandSamples,
  strip,
  subscribeBand,
  useBand,
  useBandGeometry,
  useBandSelect,
  type BandConfig,
  type BandForm,
  type BandGeometry,
  type BandGroup,
  type BandMode,
  type BandState,
  type PresetId,
} from "./band";
export { useBandOccupant } from "./components/use-band-occupant";
