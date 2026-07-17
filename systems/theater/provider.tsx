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
import type { VideoPlatform } from "@/lib/log";
import { useInputCapability } from "@/services";
import { readViewport, stageRectFor, type Viewport } from "./lib/geometry";
import { adHocAlbum } from "./lib/albums";
import {
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
  /** Force a mode; otherwise theater on desktop, PiP on touch/coarse. */
  mode?: TheaterMode;
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
  /** True on touch/coarse-pointer devices — theater falls back to PiP. */
  isCoarse: boolean;
  /** Geometry of the persistent stage in the current mode. */
  rect: StageRect;
  pipOffset: { x: number; y: number };
  dragging: boolean;

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

  setPipOffset: (offset: { x: number; y: number }) => void;
  setDragging: (dragging: boolean) => void;
}

const TheaterContext = createContext<TheaterContextValue | undefined>(undefined);

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
  const [albumIndex, setAlbumIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [mode, setMode] = useState<TheaterMode>("closed");
  const [minimized, setMinimized] = useState(false);

  // --- Player state ---
  const [phase, setPhase] = useState<PlayerPhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Geometry ---
  const [viewport, setViewport] = useState<Viewport>(() => readViewport());
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Touch-primary devices (and very narrow windows) get the floating PiP by
  // default rather than the heavy theater takeover. Uses the app's canonical
  // input-capability service (detect-it) instead of a raw hover media query,
  // which is unreliable (e.g. always "hover: none" in headless Chrome).
  const isCoarse = primaryInput === "touch" || viewport.width < 640;

  const album = albums[albumIndex] ?? null;
  const track = album?.tracks[trackIndex] ?? null;

  const effectiveMode: TheaterMode = minimized ? "closed" : mode;
  // The stage always sits at a *visible* mode's rect; hidden states fade/scale
  // it out in place rather than moving it, so opening reads as a clean morph.
  const geomMode: "theater" | "pip" =
    mode === "pip" ? "pip" : isCoarse ? "pip" : "theater";
  const rect = useMemo(
    () => stageRectFor(geomMode, viewport, pipOffset),
    [geomMode, viewport, pipOffset],
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
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
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
      })
      .catch(() => setPhase("error"));
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
        return;
      }
      if (loadedVideoRef.current !== track.videoId) {
        loadedVideoRef.current = track.videoId;
        playerRef.current.loadVideoById(track.videoId);
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
  }, [track?.id, track?.platform, track?.videoId, mode, minimized, ensurePlayer]);

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
  // strands the user mid-navigation.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setMode((m) => (m === "theater" ? "pip" : m));
    }
  }, [pathname]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const resolveMode = useCallback(
    (requested?: TheaterMode): TheaterMode => {
      if (requested) return requested;
      return isCoarse ? "pip" : "theater";
    },
    [isCoarse],
  );

  const open = useCallback(
    ({ albums: next, albumIndex: ai = 0, trackIndex: ti = 0, mode: m }: OpenOptions) => {
      if (next.length === 0) return;
      setAlbums(next);
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
    setMode(isCoarse ? "pip" : "theater");
  }, [isCoarse]);

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
    rect,
    pipOffset,
    dragging,
    registerAlbums,
    open,
    openTrack,
    openVideo,
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
    setPipOffset,
    setDragging,
  };

  return (
    <TheaterContext.Provider value={value}>
      {children}
      <Stage
        hostRef={hostRef}
        rect={rect}
        track={track}
        active={mode !== "closed"}
        visible={visible}
        dragging={dragging}
      />
    </TheaterContext.Provider>
  );
}
