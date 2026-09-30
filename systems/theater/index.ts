// =============================================================================
// Theater System — immersive video player (theater modal + universal PiP)
//
// A global, persistent video system modeled on the Music system: one player
// that survives mode + route changes, surfaced as a large desktop theater
// modal, a cross-platform floating Picture-in-Picture window, or a minimized
// "now watching" Live Activity. Playlists ("albums") of videos ("tracks") can
// be browsed and navigated by click, scroll, swipe, or keyboard. The albums
// are shelves of one library: every recording and deck of mine on the site
// (lib/library.ts).
// =============================================================================

export {
  TheaterProvider,
  useTheater,
  useOptionalTheater,
  useOptionalTheaterStage,
} from "./provider";
export {
  TheaterSurfaces,
  TheaterActivity,
  TheaterPlaylistSheet,
  TheaterRegistrar,
  AlbumTabs,
  LanguageSwitch,
  TrackThumb,
} from "./components";
export {
  buildLibraryAlbums,
  buildLibraryTracks,
  featuredTracks,
  adHocAlbum,
  mediaToTrack,
  resolveVideoId,
  type Album,
  type Track,
  type TrackKind,
  type TrackLanguage,
  type TrackVersion,
  type VideoTrack,
  type SlidesTrack,
  type TheaterMode,
} from "./lib";
