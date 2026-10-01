"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useOptionalMusic } from "@/systems/music";
import { SURFACE_BREAKPOINTS } from "@/systems/surface";
import type { SlidesMedia, VideoMedia, VideoPlatform } from "@/lib/log";
import { useInputCapability } from "@/services";
import {
  pipOffsetAtTop,
  readViewport,
  stageRectFor,
  theaterAvailable as theaterFits,
  type Viewport,
} from "./lib/geometry";
import { adHocAlbum, mediaToTrack } from "./lib/albums";
import { mediaKey, versionOf, withVersion } from "./lib/library";
import {
  enableIframeFullscreen,
  loadYouTubeAPI,
  resolveVideoId,
  type YTPlayerExt,
} from "./lib/player";
import type {
  Album,
  PlayerPhase,
  StageRect,
  TheaterMode,
  Track,
  TrackLanguage,
} from "./lib/types";
import { Stage } from "./components/stage";

// =============================================================================
// Theater Provider — the immersive video system's coordination layer.
//
// Owns the single persistent player (so audio survives mode + route changes,
// exactly like the Music system), the playlist model (albums → tracks), the
// current display mode (theater / PiP / minimized), and the stage geometry the
// chrome reads to stay aligned. The visual surfaces (theater overlay, PiP
// window, minimized Live Activity) are thin, state-bound consumers.
// =============================================================================

interface OpenOptions {
  albums: Album[];
  albumIndex?: number;
  trackIndex?: number;
  /** Force a mode; otherwise theater on tablet+/desktop, PiP on phones. */
  mode?: TheaterMode;
  /** Which version to play, for a track that has several. */
  language?: TrackLanguage | null;
  /** Seconds into the opened track to start at — a channel tuning in. */
  startAt?: number;
}

/** What a track shows for the media it came from: the commit's name. */
export interface MediaMeta {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
}

export interface OpenVideoInput {
  id?: string;
  url: string;
  platform: VideoPlatform;
  title?: string;
  subtitle?: string;
  thumbnail?: string | null;
  href?: string;
  mode?: TheaterMode;
}

interface TheaterContextValue {
  albums: Album[];
  /** The library's shelves (registered once), for entry points elsewhere. */
  registeredAlbums: Album[];
  albumIndex: number;
  trackIndex: number;
  album: Album | null;
  /** The track on the stage, wearing the version being played. */
  track: Track | null;
  /**
   * The language asked for this session, or null for each track's default
   * (the viewer's locale when the track has it). Set by the version switch,
   * and held across tracks: whoever switched a talk to English wants the
   * next talk that has an English version in English too.
   */
  language: TrackLanguage | null;
  mode: TheaterMode;
  minimized: boolean;
  phase: PlayerPhase;
  currentTime: number;
  duration: number;
  /** True on touch/coarse-pointer devices — theater chrome stays visible. */
  isCoarse: boolean;
  /** Viewport is large enough for the immersive theater (tablet+ / desktop). */
  theaterAvailable: boolean;
  /** Geometry of the persistent stage in the current mode. */
  rect: StageRect;
  /** The viewport the geometry above was measured against. */
  viewport: Viewport;
  pipOffset: { x: number; y: number };
  dragging: boolean;
  /** The playlist surface (albums + tracks) — the only browser PiP has. */
  isPlaylistOpen: boolean;

  /** Register the library's shelves once. */
  registerAlbums: (albums: Album[]) => void;
  open: (opts: OpenOptions) => void;
  /** Open at a specific track by id within the given albums. */
  openTrack: (albums: Album[], trackId: string, mode?: TheaterMode) => void;
  /**
   * Open the player for an arbitrary video (e.g. a commit-page click). Lands
   * on its entry in the library, at that very version, when the library
   * holds it; otherwise plays it as a one-off with the library a tab away.
   */
  openVideo: (input: OpenVideoInput) => void;
  /**
   * Open a piece of media on the stage. Whatever it is and wherever it was
   * clicked, the library is searched by the media's identity, so a deck
   * opened from /prompt and the same deck opened from /works land on the
   * same entry.
   */
  openMedia: (media: VideoMedia | SlidesMedia, meta: MediaMeta) => void;
  /** Play another version of the track on the stage (see `language`). */
  selectLanguage: (language: TrackLanguage) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  toPip: () => void;
  toTheater: () => void;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  selectAlbum: (index: number) => void;
  selectTrack: (index: number) => void;
  openPlaylist: () => void;
  closePlaylist: () => void;

  setPipOffset: (offset: { x: number; y: number }) => void;
  setDragging: (dragging: boolean) => void;
}

const TheaterContext = createContext<TheaterContextValue | undefined>(undefined);

/**
 * The stage — its occupant and its doors — and nothing that ticks.
 * `TheaterContext` carries `currentTime`, so everything subscribed to it
 * re-renders twice a second while a video plays. Anything that only sends
 * something to the stage (a cover's `openVideo`, the attachment system's
 * `openMedia`) or only asks what is on it (the feed's inline player, which
 * marks its place while its recording is in PiP) subscribes here instead.
 */
interface TheaterStageValue {
  track: Track | null;
  mode: TheaterMode;
  close: () => void;
  openVideo: (input: OpenVideoInput) => void;
  openMedia: TheaterContextValue["openMedia"];
}

const TheaterStageContext = createContext<TheaterStageValue | undefined>(undefined);

export function useOptionalTheaterStage() {
  return useContext(TheaterStageContext);
}

export function useTheater() {
  const ctx = useContext(TheaterContext);
  if (!ctx) throw new Error("useTheater must be used within TheaterProvider");
  return ctx;
}

export function useOptionalTheater() {
  return useContext(TheaterContext);
}

function ytPhase(state: YT.PlayerState): PlayerPhase {
  switch (state) {
    case YT.PlayerState.PLAYING:
      return "playing";
    case YT.PlayerState.PAUSED:
      return "paused";
    case YT.PlayerState.BUFFERING:
      return "loading";
    case YT.PlayerState.ENDED:
      return "ended";
    default:
      return "idle";
  }
}

export function TheaterProvider({ children }: { children: React.ReactNode }) {
  const music = useOptionalMusic();
  const pathname = usePathname();
  const { primaryInput } = useInputCapability();

  // --- Playlist + mode state ---
  const [albums, setAlbums] = useState<Album[]>([]);
  const [registeredAlbums, setRegisteredAlbums] = useState<Album[]>([]);
  const [language, setLanguage] = useState<TrackLanguage | null>(null);
  /** The opened track's start offset; any other track starts at 0. */
  const [start, setStart] = useState<{ id: string; seconds: number } | null>(
    null,
  );
  const [albumIndex, setAlbumIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [mode, setMode] = useState<TheaterMode>("closed");
  const [minimized, setMinimized] = useState(false);
  const [isPlaylistOpen, setPlaylistOpen] = useState(false);

  // --- Player state ---
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Geometry ---
  const [viewport, setViewport] = useState<Viewport>(() => readViewport());
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Touch vs mouse only affects chrome (hover-to-reveal vs always-on). Mode
  // selection is viewport-sized: phones get PiP, tablet+ gets theater — an
  // iPad is touch-primary but has plenty of room for the immersive modal.
  const isCoarse = primaryInput === "touch" || viewport.width < 640;
  const theaterAvailable = theaterFits(viewport);

  const album = albums[albumIndex] ?? null;
  const shelved = album?.tracks[trackIndex] ?? null;
  const track = useMemo(() => {
    const version = language
      ? shelved?.versions?.find((v) => v.language === language)
      : undefined;
    const worn = shelved && version ? withVersion(shelved, version) : shelved;
    return worn && start && start.id === worn.id
      ? { ...worn, startAt: start.seconds }
      : worn;
  }, [shelved, language, start]);

  const effectiveMode: TheaterMode = minimized ? "closed" : mode;
  // The stage always sits at a *visible* mode's rect; hidden states fade/scale
  // it out in place rather than moving it, so opening reads as a clean morph.
  // If theater is requested on a phone-sized viewport, keep PiP geometry.
  const geomMode: "theater" | "pip" =
    mode === "theater" && theaterAvailable ? "theater" : "pip";

  // The playlist sheet and the PiP window share a phone screen rather than
  // overlapping: the window goes to the top of the screen and the sheet takes
  // everything under it (the sheet's top detent is the window's bottom edge —
  // see `playlistDetents`). The park is derived, not stored — closing the
  // sheet puts the window back where the user left it with no bookkeeping, and
  // no frame has the two disagreeing. It is the phone's problem only: the
  // tablet panel and the desktop window leave the PiP's corner alone.
  //
  // What the chrome reads and drags from is this *effective* offset, so a drag
  // that starts on a parked window starts where the window is. Pushed against
  // the park it moves sideways and no further down: under the list is not a
  // place the window can be while the list is up.
  const parkedForPlaylist =
    isPlaylistOpen &&
    mode === "pip" &&
    !minimized &&
    viewport.width < SURFACE_BREAKPOINTS.sm;
  const effectiveOffset = useMemo(
    () => (parkedForPlaylist ? pipOffsetAtTop(viewport, pipOffset) : pipOffset),
    [parkedForPlaylist, viewport, pipOffset],
  );
  const rect = useMemo(
    () => stageRectFor(geomMode, viewport, effectiveOffset),
    [geomMode, viewport, effectiveOffset],
  );
  const visible = mode !== "closed" && !minimized;

  // --- Viewport tracking (drives stage geometry) ---
  useEffect(() => {
    const sync = () => setViewport(readViewport());
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  // --- YouTube player (persistent) ---
  const playerRef = useRef<YTPlayerExt | null>(null);
  const readyRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pendingVideoRef = useRef<string | null>(null);
  const pendingStartRef = useRef(0);
  const loadedVideoRef = useRef<string | null>(null);

  const ensurePlayer = useCallback(() => {
    if (playerRef.current || !hostRef.current) return;
    const host = hostRef.current;
    const inner = document.createElement("div");
    host.appendChild(inner);
    setPhase("loading");
    loadYouTubeAPI()
      .then((YTApi) => {
        const player = new YTApi.Player(inner, {
          width: 356,
          height: 200,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            playsinline: 1,
            fs: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              enableIframeFullscreen(host);
              const pending = pendingVideoRef.current;
              if (pending) {
                pendingVideoRef.current = null;
                loadedVideoRef.current = pending;
                (player as YTPlayerExt).loadVideoById(
                  pending,
                  pendingStartRef.current,
                );
              }
            },
            onStateChange: (e) => {
              setPhase(ytPhase(e.data));
            },
            onError: () => setPhase("error"),
          },
        }) as YTPlayerExt;
        playerRef.current = player;
        enableIframeFullscreen(host);
      })
      .catch(() => setPhase("error"));
  }, []);

  // YouTube (and other embeds) inject their iframe after first paint — keep
  // the fullscreen allow-list patched so iPad doesn't fall back to PiP.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    enableIframeFullscreen(host);
    const obs = new MutationObserver(() => enableIframeFullscreen(host));
    obs.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["allow"],
    });
    return () => obs.disconnect();
  }, []);

  // Load / stop the underlying player as the current track or mode changes.
  useEffect(() => {
    if (effectiveMode === "closed" && mode === "closed") {
      // Fully closed: stop playback but keep the player instance for reuse.
      try {
        playerRef.current?.stopVideo();
      } catch {
        /* player may be gone */
      }
      loadedVideoRef.current = null;
      return;
    }

    if (!track) return;

    if (track.platform === "youtube" && track.videoId) {
      ensurePlayer();
      if (!readyRef.current || !playerRef.current) {
        pendingVideoRef.current = track.videoId;
        pendingStartRef.current = track.startAt ?? 0;
        return;
      }
      if (loadedVideoRef.current !== track.videoId) {
        loadedVideoRef.current = track.videoId;
        playerRef.current.loadVideoById(track.videoId, track.startAt ?? 0);
      }
    } else {
      // Non-YouTube track plays in its own iframe (rendered by <Stage />) —
      // silence the YouTube player so audio never overlaps.
      try {
        playerRef.current?.stopVideo();
      } catch {
        /* noop */
      }
      loadedVideoRef.current = null;
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.platform, track?.videoId, track?.startAt, mode, minimized, ensurePlayer]);

  // Pause background music whenever a video starts playing.
  useEffect(() => {
    if (phase === "playing") music?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- Progress polling (YouTube only, while playing) ---
  useEffect(() => {
    if (phase !== "playing" || !playerRef.current) return;
    const poll = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {
        /* player may be destroyed */
      }
    };
    poll();
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [phase]);

  // Backfill a real title for ad-hoc YouTube tracks (opened from a bare video
  // click) once the player reports its metadata.
  useEffect(() => {
    if (!track || track.platform !== "youtube") return;
    if (phase !== "playing" && phase !== "paused") return;
    if (track.title && track.title !== "Video") return;
    const p = playerRef.current;
    if (!p) return;
    try {
      const data = p.getVideoData();
      const title = data?.title;
      if (!title) return;
      setAlbums((prev) =>
        prev.map((al, ai) =>
          ai !== albumIndex
            ? al
            : {
                ...al,
                tracks: al.tracks.map((tk, ti) =>
                  ti !== trackIndex ? tk : { ...tk, title },
                ),
              },
        ),
      );
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, track?.id, track?.platform, track?.title, albumIndex, trackIndex]);

  // --- Body scroll lock while the theater modal owns the screen ---
  useEffect(() => {
    if (effectiveMode !== "theater") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [effectiveMode]);

  // Collapse to PiP (keep playing) on route change so the theater modal never
  // strands the user mid-navigation. The playlist goes with it: the page under
  // it is a new page, and a list left standing over it is stale chrome.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setMode((m) => (m === "theater" ? "pip" : m));
      setPlaylistOpen(false);
    }
  }, [pathname]);

  // The playlist belongs to PiP and the Live Activity. The theater has its own
  // album tabs and rail, and closing the player ends the session entirely.
  useEffect(() => {
    if (mode === "theater" || mode === "closed") setPlaylistOpen(false);
  }, [mode]);

  // Phone-sized (or short) viewports can't host theater chrome — drop to PiP
  // rather than rendering a crushed modal if the window is resized / rotated.
  useEffect(() => {
    if (!theaterAvailable) {
      setMode((m) => (m === "theater" ? "pip" : m));
    }
  }, [theaterAvailable]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const resolveMode = useCallback(
    (requested?: TheaterMode): TheaterMode => {
      if (requested === "theater" && !theaterAvailable) return "pip";
      if (requested) return requested;
      return theaterAvailable ? "theater" : "pip";
    },
    [theaterAvailable],
  );

  const open = useCallback(
    ({
      albums: next,
      albumIndex: ai = 0,
      trackIndex: ti = 0,
      mode: m,
      language: lang = null,
      startAt,
    }: OpenOptions) => {
      if (next.length === 0) return;
      setAlbums(next);
      setLanguage(lang);
      const opened = next[ai]?.tracks[ti];
      setStart(opened && startAt ? { id: opened.id, seconds: startAt } : null);
      setAlbumIndex(Math.min(Math.max(ai, 0), next.length - 1));
      const tracks = next[ai]?.tracks ?? [];
      setTrackIndex(Math.min(Math.max(ti, 0), Math.max(tracks.length - 1, 0)));
      setMinimized(false);
      setPipOffset({ x: 0, y: 0 });
      setMode(resolveMode(m));
    },
    [resolveMode],
  );

  const openTrack = useCallback(
    (next: Album[], trackId: string, m?: TheaterMode) => {
      let ai = 0;
      let ti = 0;
      outer: for (let a = 0; a < next.length; a++) {
        const idx = next[a].tracks.findIndex((t) => t.id === trackId);
        if (idx >= 0) {
          ai = a;
          ti = idx;
          break outer;
        }
      }
      open({ albums: next, albumIndex: ai, trackIndex: ti, mode: m });
    },
    [open],
  );

  const registerAlbums = useCallback((next: Album[]) => {
    setRegisteredAlbums(next);
  }, []);

  /**
   * Open the library at this media, at the very version that was clicked.
   * False when the library does not hold it.
   */
  const openInLibrary = useCallback(
    (key: string, m?: TheaterMode): boolean => {
      for (let a = 0; a < registeredAlbums.length; a++) {
        const tracks = registeredAlbums[a].tracks;
        for (let i = 0; i < tracks.length; i++) {
          const version = versionOf(tracks[i], key);
          if (!version) continue;
          open({
            albums: registeredAlbums,
            albumIndex: a,
            trackIndex: i,
            mode: m,
            language: version.language ?? null,
          });
          return true;
        }
      }
      return false;
    },
    [registeredAlbums, open],
  );

  const openVideo = useCallback(
    (input: OpenVideoInput) => {
      if (openInLibrary(mediaKey(input.url, input.platform), input.mode)) {
        return;
      }
      // Not mine, or not listed → play as a one-off, with the library's
      // shelves still there to switch into.
      const track: Track = {
        id: input.id ?? input.url,
        kind: "video",
        platform: input.platform,
        url: input.url,
        videoId: resolveVideoId(input.url, input.platform),
        title: input.title ?? "Video",
        subtitle: input.subtitle,
        thumbnail: input.thumbnail ?? null,
        href: input.href,
      };
      const adhoc = adHocAlbum(track, input.title ?? "Video");
      open({
        albums: [adhoc, ...registeredAlbums],
        albumIndex: 0,
        trackIndex: 0,
        mode: input.mode,
      });
    },
    [registeredAlbums, open, openInLibrary],
  );

  const openMedia = useCallback(
    (media: VideoMedia | SlidesMedia, meta: MediaMeta) => {
      if (media.kind === "video") {
        openVideo({
          id: meta.id,
          url: media.url,
          platform: media.platform,
          thumbnail: media.thumbnail,
          title: meta.title,
          subtitle: meta.subtitle,
          href: meta.href,
        });
        return;
      }
      if (openInLibrary(mediaKey(media.url))) return;
      // A deck the library does not hold (an MDX page's) plays alone.
      const track = mediaToTrack(media, meta);
      if (!track) return;
      open({ albums: [adHocAlbum(track, track.title)], albumIndex: 0, trackIndex: 0 });
    },
    [openVideo, openInLibrary, open],
  );

  const selectLanguage = useCallback(
    (next: TrackLanguage) => setLanguage(next),
    [],
  );

  const close = useCallback(() => {
    setMode("closed");
    setMinimized(false);
    setPhase("idle");
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => {
    setMinimized(false);
    setMode((m) => (m === "closed" ? "pip" : m));
  }, []);
  const toPip = useCallback(() => {
    setMinimized(false);
    setMode("pip");
  }, []);
  const toTheater = useCallback(() => {
    setMinimized(false);
    setMode(theaterAvailable ? "theater" : "pip");
  }, [theaterAvailable]);

  const play = useCallback(() => {
    try {
      playerRef.current?.playVideo();
    } catch {
      /* noop */
    }
  }, []);
  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* noop */
    }
  }, []);
  const togglePlay = useCallback(() => {
    if (phase === "playing") pause();
    else play();
  }, [phase, play, pause]);

  const clampTrack = useCallback(
    (ai: number, ti: number) => {
      const tracks = albums[ai]?.tracks ?? [];
      if (tracks.length === 0) return;
      setAlbumIndex(ai);
      setTrackIndex(Math.min(Math.max(ti, 0), tracks.length - 1));
    },
    [albums],
  );

  const next = useCallback(() => {
    const tracks = album?.tracks ?? [];
    // A channel loops, as its schedule does; it never runs on into the next.
    if (album?.live) clampTrack(albumIndex, (trackIndex + 1) % tracks.length);
    else if (trackIndex < tracks.length - 1) clampTrack(albumIndex, trackIndex + 1);
    else if (albumIndex < albums.length - 1) clampTrack(albumIndex + 1, 0);
  }, [album, albumIndex, trackIndex, albums.length, clampTrack]);

  // A channel plays on: when a program ends, the next one starts. Only the
  // YouTube player says when it ended; a Bilibili program waits for "next".
  useEffect(() => {
    if (phase === "ended" && album?.live) next();
  }, [phase, album?.live, next]);

  const previous = useCallback(() => {
    if (trackIndex > 0) clampTrack(albumIndex, trackIndex - 1);
    else if (albumIndex > 0) {
      const prevTracks = albums[albumIndex - 1]?.tracks ?? [];
      clampTrack(albumIndex - 1, Math.max(prevTracks.length - 1, 0));
    }
  }, [albumIndex, trackIndex, albums, clampTrack]);

  const seek = useCallback((seconds: number) => {
    try {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    } catch {
      /* noop */
    }
  }, []);

  const selectAlbum = useCallback(
    (index: number) => clampTrack(index, 0),
    [clampTrack],
  );
  const selectTrack = useCallback(
    (index: number) => clampTrack(albumIndex, index),
    [albumIndex, clampTrack],
  );

  // Named after the Music system's playlist surface — the same gesture, the
  // same words, so an entry point anywhere reads the same in both systems.
  const openPlaylist = useCallback(() => setPlaylistOpen(true), []);
  const closePlaylist = useCallback(() => setPlaylistOpen(false), []);

  // Escape closes the player (a standard modal affordance). Track/album
  // navigation via keyboard and scroll is intentionally omitted on desktop —
  // clicking the album tabs / playlist rail / arrows is the single, clear path.
  useEffect(() => {
    if (effectiveMode === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [effectiveMode, close]);

  const stageValue = useMemo<TheaterStageValue>(
    () => ({ track, mode, close, openVideo, openMedia }),
    [track, mode, close, openVideo, openMedia],
  );

  const value: TheaterContextValue = {
    albums,
    registeredAlbums,
    albumIndex,
    trackIndex,
    album,
    track,
    language,
    mode,
    minimized,
    phase,
    currentTime,
    duration,
    isCoarse,
    theaterAvailable,
    rect,
    viewport,
    pipOffset: effectiveOffset,
    dragging,
    isPlaylistOpen,
    registerAlbums,
    open,
    openTrack,
    openVideo,
    openMedia,
    selectLanguage,
    close,
    minimize,
    restore,
    toPip,
    toTheater,
    play,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    selectAlbum,
    selectTrack,
    openPlaylist,
    closePlaylist,
    setPipOffset,
    setDragging,
  };

  return (
    <TheaterContext.Provider value={value}>
      <TheaterStageContext.Provider value={stageValue}>
        {children}
      </TheaterStageContext.Provider>
      <Stage
        hostRef={hostRef}
        rect={rect}
        track={track}
        active={mode !== "closed"}
        visible={visible}
        dragging={dragging}
        pip={geomMode === "pip"}
      />
    </TheaterContext.Provider>
  );
}
