// =============================================================================
// Theater System — immersive video player (theater modal + universal PiP)
//
// A global, persistent video system modeled on the Music system: one player
// that survives mode + route changes, surfaced as a large desktop theater
// modal, a cross-platform floating Picture-in-Picture window, or a minimized
// "now watching" Live Activity. Playlists ("albums") of videos ("tracks") can
// be browsed and navigated by click, scroll, swipe, or keyboard.
// =============================================================================

export { TheaterProvider, useTheater, useOptionalTheater } from "./provider";
export {
  TheaterSurfaces,
  TheaterActivity,
  TheaterRegistrar,
  TrackThumb,
} from "./components";
export {
  buildTalkAlbums,
  adHocAlbum,
  resolveVideoId,
  type Album,
  type Track,
  type TheaterMode,
} from "./lib";
