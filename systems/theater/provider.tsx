"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { useOptionalMusic } from "@/systems/music";
import { SURFACE_BREAKPOINTS } from "@/systems/surface";
import type { SlidesMedia, VideoMedia, VideoPlatform } from "@/lib/log";
import { useInputCapability } from "@/services";
import {
  DEFAULT_PIP_PLACEMENT,
  readViewport,
  SIDECAR_ROOM,
  sidecarAvailable as sidecarFits,
  stageRectFor,
  theaterAvailable as theaterFits,
  type PipPlacement,
  type Viewport,
} from "./lib/geometry";
import { adHocAlbum, mediaToTrack } from "./lib/albums";
import {
  adoptPageLook,
  nativeWindowSupported,
  requestNativeWindow,
} from "./lib/native-window";
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
} from "./lib/types";
import { Stage } from "./components/stage";

// =============================================================================
// Theater Provider: the immersive video system's coordination layer.
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
  /** The curated default albums (registered once), for entry points elsewhere. */
  registeredAlbums: Album[];
  albumIndex: number;
  trackIndex: number;
  album: Album | null;
  track: Track | null;
  mode: TheaterMode;
  minimized: boolean;
  phase: PlayerPhase;
  currentTime: number;
  duration: number;
  /** True on touch/coarse-pointer devices; theater chrome stays visible. */
  isCoarse: boolean;
  /** Viewport is large enough for the immersive theater (tablet+ / desktop). */
  theaterAvailable: boolean;
  /** Viewport is wide enough to give the sidecar column its room (desk). */
  sidecarAvailable: boolean;
  /** Geometry of the persistent stage in the current mode. */
  rect: StageRect;
  /** The viewport the geometry above was measured against. */
  viewport: Viewport;
  /**
   * PiP is the phone's card (hanging under the dock, pulled down for the
   * playlist and pushed up into the dock) rather than the corner tile.
   */
  pipCard: boolean;
  /**
   * Where the PiP tile rests: a corner, a size, and whether it is stashed in a
   * side edge. The phone's card has one place and ignores it.
   */
  pipPlacement: PipPlacement;
  /** The tile's top-left while a drag is in progress, null otherwise. */
  pipDrag: { x: number; y: number } | null;
  dragging: boolean;
  /**
   * The native picture-in-picture window the player is in (Chromium desks),
   * or null. While it is open the page's stage is hidden and the theater's
   * Live Activity stands for it in the dock.
   */
  nativeWindow: Window | null;
  /** The browser can open one, and there is a pointer to ask with. */
  nativeWindowAvailable: boolean;
  /** Move the player into a native window. Call it from the click that asks. */
  popOut: () => void;
  /** Where the window's player starts, and whether it plays (read once). */
  nativeHandoff: () => { startAt: number; resume: boolean };
  /** The window's YouTube player once it is ready, and its state changes. */
  attachNativePlayer: (player: YTPlayerExt | null) => void;
  reportNativeState: (state: YT.PlayerState) => void;
  /** The playlist surface (albums + tracks). The only browser PiP has. */
  isPlaylistOpen: boolean;

  /** Register the default albums (curated talk playlists) once. */
  registerAlbums: (albums: Album[]) => void;
  open: (opts: OpenOptions) => void;
  /** Open at a specific track by id within the given albums. */
  openTrack: (albums: Album[], trackId: string, mode?: TheaterMode) => void;
  /**
   * Open the player for an arbitrary video (e.g. a commit-page click). Jumps to
   * the matching track inside the curated albums when possible; otherwise plays
   * it as a one-off while still exposing the curated albums to switch to.
   */
  openVideo: (input: OpenVideoInput) => void;
  /**
   * Open a piece of media on the stage, in the library it belongs to. A video
   * lands in its curated talk album when it has one (`openVideo`); a deck
   * lands in the Slides album beside every other deck. The two libraries are
   * never on screen together: a recording is browsed among recordings, a
   * deck among decks.
   */
  openMedia: (media: VideoMedia | SlidesMedia, meta: MediaMeta) => void;
  /** Register the Slides library (every deck in the log) once. */
  registerSlidesAlbum: (album: Album | null) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  toPip: () => void;
  toTheater: () => void;
  /** Dock the player into a column at the right edge (PiP where it won't fit). */
  toSidecar: () => void;

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

  setPipPlacement: (placement: PipPlacement) => void;
  setPipDrag: (drag: { x: number; y: number } | null) => void;
}

const TheaterContext = createContext<TheaterContextValue | undefined>(undefined);

/**
 * The stage (its occupant and its entry points) and nothing that ticks.
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

/** `useSyncExternalStore` for a fact that never changes after load. */
const noSubscription = () => () => {};

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
  const [slidesAlbum, setSlidesAlbum] = useState<Album | null>(null);
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
  const [pipPlacement, setPipPlacement] = useState<PipPlacement>(DEFAULT_PIP_PLACEMENT);
  const [pipDrag, setPipDrag] = useState<{ x: number; y: number } | null>(null);
  const dragging = pipDrag !== null;

  // Touch vs mouse only affects chrome (hover-to-reveal vs always-on). Mode
  // selection is viewport-sized: phones get PiP, tablet+ gets theater. An
  // iPad is touch-primary but has plenty of room for the immersive modal.
  const isCoarse = primaryInput === "touch" || viewport.width < 640;
  const theaterAvailable = theaterFits(viewport);
  const sidecarAvailable = sidecarFits(viewport);

  const album = albums[albumIndex] ?? null;
  const track = album?.tracks[trackIndex] ?? null;

  const effectiveMode: TheaterMode = minimized ? "closed" : mode;
  // The stage always sits at a *visible* mode's rect; hidden states fade/scale
  // it out in place rather than moving it, so opening reads as a clean morph.
  // If theater is requested on a phone-sized viewport, keep PiP geometry.
  const geomMode: "theater" | "pip" | "sidecar" =
    mode === "theater" && theaterAvailable
      ? "theater"
      : mode === "sidecar" && sidecarAvailable
        ? "sidecar"
        : "pip";

  // On a phone, PiP is one object with the dock: a card hanging under the
  // dock's pill row, the Live Activity's pill when pushed up, the card with
  // the playlist under it when pulled down. The card's home is the top of
  // the screen, which is where the playlist sheet needs the video to be, so
  // the two split the screen with nothing to park (see `playlistDetents`).
  const pipCard = viewport.width < SURFACE_BREAKPOINTS.sm;
  const rect = useMemo(
    () => stageRectFor(geomMode, viewport, pipPlacement, pipDrag, pipCard),
    [geomMode, viewport, pipPlacement, pipDrag, pipCard],
  );
  const visible = mode !== "closed" && !minimized;

  // --- The sidecar's room ---
  // A docked sidecar is a place on the page, so the page moves over for it:
  // `--sidecar-room` on <html> is read by globals.css (the body's right
  // padding and the page column's bleed). Only while it shows: minimized,
  // the column is gone and so is the room.
  const sidecarShowing = geomMode === "sidecar" && !minimized;
  useEffect(() => {
    if (!sidecarShowing) return;
    const root = document.documentElement;
    root.style.setProperty("--sidecar-room", `${SIDECAR_ROOM}px`);
    return () => {
      root.style.removeProperty("--sidecar-room");
    };
  }, [sidecarShowing]);

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

  // --- The native window (lib/native-window.ts) ---
  const [nativeWindow, setNativeWindow] = useState<Window | null>(null);
  // The window's own YouTube player. While it exists it is the live one:
  // play, pause, seek and the clock all go to it, and the page's is paused.
  const nativePlayerRef = useRef<YTPlayerExt | null>(null);
  const handoffRef = useRef({ startAt: 0, resume: false });
  // Set when the session is ending, so the window closing does not hand
  // playback back to a player that is being stopped.
  const endingRef = useRef(false);
  const nativeSupported = useSyncExternalStore(
    noSubscription,
    nativeWindowSupported,
    () => false,
  );
  const nativeWindowAvailable = nativeSupported && !isCoarse;

  // --- YouTube player (persistent) ---
  const playerRef = useRef<YTPlayerExt | null>(null);
  /** The player that is playing: the window's while there is one. */
  const livePlayer = useCallback(
    () => nativePlayerRef.current ?? playerRef.current,
    [],
  );
  const readyRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pendingVideoRef = useRef<string | null>(null);
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
                (player as YTPlayerExt).loadVideoById(pending);
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

  // YouTube (and other embeds) inject their iframe after first paint. Keep
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

    // In a native window the window's player has the track
    // (components/native-window.tsx); the page's stays paused where it was.
    if (nativeWindow) return;

    if (!track) return;

    if (track.platform === "youtube" && track.videoId) {
      ensurePlayer();
      if (!readyRef.current || !playerRef.current) {
        pendingVideoRef.current = track.videoId;
        return;
      }
      if (loadedVideoRef.current !== track.videoId) {
        loadedVideoRef.current = track.videoId;
        playerRef.current.loadVideoById(track.videoId);
      }
    } else {
      // Non-YouTube track plays in its own iframe (rendered by <Stage />).
      // Silence the YouTube player so audio never overlaps.
      try {
        playerRef.current?.stopVideo();
      } catch {
        /* noop */
      }
      loadedVideoRef.current = null;
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.platform, track?.videoId, mode, minimized, nativeWindow, ensurePlayer]);

  // Pause background music whenever a video starts playing.
  useEffect(() => {
    if (phase === "playing") music?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- Progress polling (YouTube only, while playing) ---
  useEffect(() => {
    if (phase !== "playing" || !livePlayer()) return;
    const poll = () => {
      const p = livePlayer();
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
  }, [phase, livePlayer]);

  // Backfill a real title for ad-hoc YouTube tracks (opened from a bare video
  // click) once the player reports its metadata.
  useEffect(() => {
    if (!track || track.platform !== "youtube") return;
    if (phase !== "playing" && phase !== "paused") return;
    if (track.title && track.title !== "Video") return;
    const p = livePlayer();
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

  // The playlist belongs to PiP and the Live Activity. The theater and the
  // sidecar each have their own,
  // album tabs and rail, and closing the player ends the session entirely.
  useEffect(() => {
    if (mode === "theater" || mode === "sidecar" || mode === "closed") {
      setPlaylistOpen(false);
    }
  }, [mode]);

  // Phone-sized (or short) viewports can't host theater chrome. Drop to PiP
  // rather than rendering a crushed modal if the window is resized / rotated.
  useEffect(() => {
    if (!theaterAvailable) {
      setMode((m) => (m === "theater" ? "pip" : m));
    }
  }, [theaterAvailable]);

  // The same for the sidecar: a window narrowed past its room floats again.
  useEffect(() => {
    if (!sidecarAvailable) {
      setMode((m) => (m === "sidecar" ? "pip" : m));
    }
  }, [sidecarAvailable]);

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
    ({ albums: next, albumIndex: ai = 0, trackIndex: ti = 0, mode: m }: OpenOptions) => {
      if (next.length === 0) return;
      setAlbums(next);
      setAlbumIndex(Math.min(Math.max(ai, 0), next.length - 1));
      const tracks = next[ai]?.tracks ?? [];
      setTrackIndex(Math.min(Math.max(ti, 0), Math.max(tracks.length - 1, 0)));
      setMinimized(false);
      // The corner and size are the user's and outlive a session; a stash is
      // a "not now" for the video that was playing, not for the next one.
      setPipPlacement((p) => (p.stash ? { ...p, stash: null } : p));
      setPipDrag(null);
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

  const openVideo = useCallback(
    (input: OpenVideoInput) => {
      const videoId = resolveVideoId(input.url, input.platform);
      // Try to locate the video inside the curated albums first, so a click on
      // /works lands inside the right playlist with full navigation context.
      for (let a = 0; a < registeredAlbums.length; a++) {
        const idx = registeredAlbums[a].tracks.findIndex(
          (tk) =>
            tk.url === input.url ||
            (videoId && tk.videoId && tk.videoId === videoId) ||
            (input.id && tk.id === input.id),
        );
        if (idx >= 0) {
          open({
            albums: registeredAlbums,
            albumIndex: a,
            trackIndex: idx,
            mode: input.mode,
          });
          return;
        }
      }
      // Not curated → play as a one-off album, but keep the curated albums
      // available to switch into.
      const track: Track = {
        id: input.id ?? input.url,
        kind: "video",
        platform: input.platform,
        url: input.url,
        videoId,
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
    [registeredAlbums, open],
  );

  const registerSlidesAlbum = useCallback((next: Album | null) => {
    setSlidesAlbum(next);
  }, []);

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
      const track = mediaToTrack(media, meta);
      if (!track) return;
      // Open the Slides library at this deck, with every other deck a card
      // away. A deck the log does not list (an MDX page's) plays alone.
      const idx = slidesAlbum
        ? slidesAlbum.tracks.findIndex((tk) => tk.url === track.url)
        : -1;
      if (slidesAlbum && idx >= 0) {
        open({ albums: [slidesAlbum], albumIndex: 0, trackIndex: idx });
        return;
      }
      open({ albums: [adHocAlbum(track, track.title)], albumIndex: 0, trackIndex: 0 });
    },
    [openVideo, slidesAlbum, open],
  );

  const close = useCallback(() => {
    if (nativeWindow) {
      endingRef.current = true;
      nativeWindow.close();
    }
    setMode("closed");
    setMinimized(false);
    setPhase("idle");
    setCurrentTime(0);
    setDuration(0);
  }, [nativeWindow]);

  // Any move back onto the page closes the native window first; its
  // `pagehide` hands playback back (`bringBack` below) and the move then
  // decides the shape.
  const leaveNativeWindow = useCallback(() => {
    nativeWindow?.close();
  }, [nativeWindow]);

  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => {
    leaveNativeWindow();
    setMinimized(false);
    setMode((m) => (m === "closed" ? "pip" : m));
  }, [leaveNativeWindow]);
  const toPip = useCallback(() => {
    leaveNativeWindow();
    setMinimized(false);
    setMode("pip");
  }, [leaveNativeWindow]);
  const toSidecar = useCallback(() => {
    leaveNativeWindow();
    setMinimized(false);
    setMode(sidecarAvailable ? "sidecar" : "pip");
  }, [sidecarAvailable, leaveNativeWindow]);
  const toTheater = useCallback(() => {
    leaveNativeWindow();
    setMinimized(false);
    setMode(theaterAvailable ? "theater" : "pip");
  }, [theaterAvailable, leaveNativeWindow]);

  // Back from the window: the page's player picks up where the window's got
  // to, on whatever track it got to, playing if it was. Then the stage shows
  // again in the shape it had.
  const bringBack = () => {
    const from = nativePlayerRef.current;
    nativePlayerRef.current = null;
    setNativeWindow(null);
    if (endingRef.current) {
      endingRef.current = false;
      return;
    }
    let at = 0;
    let playing = false;
    try {
      if (from) {
        at = from.getCurrentTime();
        // YT.PlayerState.PLAYING, as a number: the window's API is not this
        // tab's, and this tab's may never have loaded.
        playing = from.getPlayerState() === 1;
      }
    } catch {
      /* the window's player is already gone */
    }
    const main = playerRef.current;
    if (track?.kind === "video" && track.platform === "youtube" && track.videoId && main && readyRef.current) {
      try {
        if (loadedVideoRef.current !== track.videoId) {
          loadedVideoRef.current = track.videoId;
          main.loadVideoById({ videoId: track.videoId, startSeconds: at });
        } else {
          main.seekTo(at, true);
        }
        if (playing) main.playVideo();
        else main.pauseVideo();
      } catch {
        /* noop */
      }
    }
    setMinimized(false);
  };
  const bringBackRef = useRef(bringBack);
  useEffect(() => {
    bringBackRef.current = bringBack;
  });

  const popOut = useCallback(() => {
    if (!nativeWindowSupported() || nativeWindow || !track) return;
    const isYouTube = track.kind === "video" && track.platform === "youtube";
    let startAt = 0;
    try {
      startAt = isYouTube ? (playerRef.current?.getCurrentTime() ?? 0) : 0;
    } catch {
      /* not ready yet: start from the top */
    }
    handoffRef.current = {
      startAt,
      // A recording plays on in the window if it was playing (or about to);
      // a deck or another platform's embed simply opens there.
      resume: !isYouTube || phase === "playing" || phase === "loading",
    };
    requestNativeWindow()
      .then((win) => {
        const teardown = adoptPageLook(win);
        try {
          playerRef.current?.pauseVideo();
        } catch {
          /* noop */
        }
        win.addEventListener(
          "pagehide",
          () => {
            teardown();
            bringBackRef.current();
          },
          { once: true },
        );
        setNativeWindow(win);
        setPlaylistOpen(false);
        setMinimized(true);
      })
      .catch(() => {
        /* refused (no gesture, or already open elsewhere): stay on the page */
      });
  }, [nativeWindow, track, phase]);

  const nativeHandoff = useCallback(() => handoffRef.current, []);
  const attachNativePlayer = useCallback((player: YTPlayerExt | null) => {
    nativePlayerRef.current = player;
  }, []);
  const reportNativeState = useCallback((state: YT.PlayerState) => {
    setPhase(ytPhase(state));
  }, []);

  const play = useCallback(() => {
    try {
      livePlayer()?.playVideo();
    } catch {
      /* noop */
    }
  }, [livePlayer]);
  const pause = useCallback(() => {
    try {
      livePlayer()?.pauseVideo();
    } catch {
      /* noop */
    }
  }, [livePlayer]);
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
    if (trackIndex < tracks.length - 1) clampTrack(albumIndex, trackIndex + 1);
    else if (albumIndex < albums.length - 1) clampTrack(albumIndex + 1, 0);
  }, [album, albumIndex, trackIndex, albums.length, clampTrack]);

  const previous = useCallback(() => {
    if (trackIndex > 0) clampTrack(albumIndex, trackIndex - 1);
    else if (albumIndex > 0) {
      const prevTracks = albums[albumIndex - 1]?.tracks ?? [];
      clampTrack(albumIndex - 1, Math.max(prevTracks.length - 1, 0));
    }
  }, [albumIndex, trackIndex, albums, clampTrack]);

  const seek = useCallback(
    (seconds: number) => {
      try {
        livePlayer()?.seekTo(seconds, true);
        setCurrentTime(seconds);
      } catch {
        /* noop */
      }
    },
    [livePlayer],
  );

  const selectAlbum = useCallback(
    (index: number) => clampTrack(index, 0),
    [clampTrack],
  );
  const selectTrack = useCallback(
    (index: number) => clampTrack(albumIndex, index),
    [albumIndex, clampTrack],
  );

  // Named after the Music system's playlist surface: the same gesture, the
  // same words, so an entry point anywhere reads the same in both systems.
  const openPlaylist = useCallback(() => setPlaylistOpen(true), []);
  const closePlaylist = useCallback(() => setPlaylistOpen(false), []);

  // Escape closes the theater (a standard modal affordance). It does nothing
  // to PiP: the tile is not modal, and an Escape pressed there was almost
  // always meant for something else (a menu, a sheet), which ended the
  // video and lost its place. Track/album navigation via keyboard and scroll
  // is intentionally omitted on desktop. Clicking the album tabs / playlist
  // rail / arrows is the single path.
  useEffect(() => {
    if (effectiveMode !== "theater") return;
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
    mode,
    minimized,
    phase,
    currentTime,
    duration,
    isCoarse,
    theaterAvailable,
    sidecarAvailable,
    rect,
    viewport,
    pipCard,
    pipPlacement,
    pipDrag,
    dragging,
    isPlaylistOpen,
    nativeWindow,
    nativeWindowAvailable,
    popOut,
    nativeHandoff,
    attachNativePlayer,
    reportNativeState,
    registerAlbums,
    open,
    openTrack,
    openVideo,
    openMedia,
    registerSlidesAlbum,
    close,
    minimize,
    restore,
    toPip,
    toTheater,
    toSidecar,
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
    setPipPlacement,
    setPipDrag,
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
        active={mode !== "closed" && !nativeWindow}
        visible={visible}
        dragging={dragging}
        pip={geomMode !== "theater"}
      />
    </TheaterContext.Provider>
  );
}
