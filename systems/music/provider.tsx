"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MusicTrack, PlayerState, PlaylistEntry } from "./lib/types";
import { loadYouTubeAPI, getYouTubeThumbnail } from "./lib/youtube-player";
import {
  cacheTrackMeta,
  getCachedTrackMeta,
  normalizeAuthor,
  resolveTrackMetas,
} from "./lib/track-meta";
import {
  MOCK_DURATION,
  MOCK_PLAYLIST,
  isMusicMockEnabled,
  setMusicMockEnabled,
} from "./lib/mock";
import {
  type MusicSettings,
  PLAYLIST_ID,
  getDefaultMusicSettings,
  getMusicSettings,
  setMusicSettings,
} from "./lib/settings";

// =============================================================================
// Context
// =============================================================================

interface MusicContextType {
  track: MusicTrack | null;
  playerState: PlayerState;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total track duration in seconds */
  duration: number;
  /**
   * True after the user has started playback at least once this session.
   * Cueing the playlist alone does not set this — used to park the music
   * Live Activity only once listening has begun.
   */
  hasPlayed: boolean;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  /**
   * Offline mock backend (dev / headless verification — see lib/mock.ts).
   * Toggling hot-swaps the backend in place: the current player is torn
   * down, playback state is reset, and the other backend initializes —
   * no page reload. The flag is persisted so preload flows (Playwright
   * `addInitScript`) and later visits agree.
   */
  isMockEnabled: boolean;
  setMockEnabled: (enabled: boolean) => void;
  // --- Playlist browsing ---
  /** Ordered playlist entries (empty until the player reports them). */
  playlist: PlaylistEntry[];
  /** Index of the current track within `playlist`, -1 when unknown. */
  playlistIndex: number;
  /** Jump to (and play) the playlist entry at `index`. */
  playAt: (index: number) => void;
  /** Whether the global playlist sheet is open. */
  isPlaylistOpen: boolean;
  openPlaylist: () => void;
  closePlaylist: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}

export function useOptionalMusic() {
  return useContext(MusicContext);
}

// =============================================================================
// Helpers
// =============================================================================

function ytStateToPlayerState(state: YT.PlayerState): PlayerState {
  switch (state) {
    case YT.PlayerState.PLAYING:
      return "playing";
    case YT.PlayerState.PAUSED:
      return "paused";
    case YT.PlayerState.BUFFERING:
      return "loading";
    case YT.PlayerState.ENDED:
      return "ended";
    case YT.PlayerState.CUED:
    case YT.PlayerState.UNSTARTED:
    default:
      return "idle";
  }
}

function readTrack(player: YT.Player): MusicTrack | null {
  try {
    const data = player.getVideoData();
    if (!data?.video_id) return null;
    const track = {
      videoId: data.video_id,
      title: data.title || "",
      artist: normalizeAuthor(data.author || ""),
      thumbnailUrl: getYouTubeThumbnail(data.video_id),
    };
    // Free metadata: whatever plays gets remembered for the playlist browser.
    if (track.title) {
      cacheTrackMeta(track.videoId, { title: track.title, author: track.artist });
    }
    return track;
  } catch {
    return null;
  }
}

/** Map raw playlist video IDs to entries, joining any cached metadata. */
function toEntries(videoIds: string[]): PlaylistEntry[] {
  return videoIds.map((videoId) => {
    const meta = getCachedTrackMeta(videoId);
    return {
      videoId,
      title: meta?.title ?? null,
      author: meta?.author ?? null,
      thumbnailUrl: getYouTubeThumbnail(videoId),
    };
  });
}

// =============================================================================
// Provider
// =============================================================================

export function MusicProvider({ children }: { children: React.ReactNode }) {
  // --- Settings (hydration-safe) ---
  const [settings, setSettingsState] = useState<MusicSettings>(
    getDefaultMusicSettings,
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState(getMusicSettings());
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettingsState((prev) => {
      const next = { ...prev, enabled };
      setMusicSettings(next);
      return next;
    });
  }, []);

  // --- Mock backend flag ---
  // Lazy-initialized straight from localStorage (false on the server): safe
  // without the usual hydration effect because no markup depends on it — it
  // only steers effects and control callbacks. Changing it re-runs the init
  // effect below, which swaps backends in place.
  const [isMockEnabled, setMockState] = useState(isMusicMockEnabled);
  const setMockEnabled = useCallback((enabled: boolean) => {
    setMusicMockEnabled(enabled); // persist for preload flows / next visits
    setMockState(enabled);
  }, []);

  // --- Player state ---
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistEntry[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const [isPlaylistOpen, setPlaylistOpen] = useState(false);
  const [wantsPlayer, setWantsPlayer] = useState(false);
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  // Track pending skip so we can force playVideo() on iOS Safari
  const pendingSkipRef = useRef(false);
  // Play was requested before the IFrame API finished constructing the player.
  const pendingPlayRef = useRef(false);
  const pendingPlayAtRef = useRef<number | null>(null);
  // Offline mock mode (dev / headless verification) — see lib/mock.ts.
  const mockRef = useRef(false);
  const mockIndexRef = useRef(0);

  // --- Playlist sync (real player only) ---
  // The IFrame API populates getPlaylist() asynchronously after cueing, so
  // this is safe to call often: it only commits state when something changed.
  const syncPlaylist = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const ids = player.getPlaylist() ?? [];
      if (ids.length > 0) {
        setPlaylist((prev) =>
          prev.length === ids.length &&
          prev.every((e, i) => e.videoId === ids[i])
            ? prev
            : toEntries(ids),
        );
      }
      setPlaylistIndex(player.getPlaylistIndex());
    } catch {
      /* player not ready */
    }
  }, []);

  const requestPlayer = useCallback((opts?: { play?: boolean }) => {
    if (opts?.play) pendingPlayRef.current = true;
    setWantsPlayer(true);
  }, []);

  // --- Initialize player (or mock) ---
  // The container div is rendered by this provider (always mounted), so the
  // player persists across route changes and audio never stops on navigation.
  // Init itself waits for the first play / playlist open so the YouTube
  // IFrame API stays off the home TTI path. Re-runs when `isMockEnabled`
  // flips: the cleanup tears the old backend down and the next run
  // initializes the other one — a live backend swap.
  useEffect(() => {
    if (!wantsPlayer) return;
    if (!PLAYLIST_ID || initedRef.current) return;

    // Reset every cross-backend bit so a swap starts from scratch (all
    // no-ops on first mount). `hasPlayed` matters most: leaving it true
    // would park the Live Activity for a player that never played.
    // Synchronous setState is deliberate throughout this effect — same
    // client-only init pattern as the settings load above.
    pendingSkipRef.current = false;
    mockIndexRef.current = 0;
    /* eslint-disable react-hooks/set-state-in-effect */
    setHasPlayed(false);
    setCurrentTime(0);
    setDuration(0);
    setTrack(null);
    setPlaylist([]);
    setPlaylistIndex(-1);

    // Mock mode: skip the IFrame API entirely; drive the same state machine
    // from a fixture so every music surface works offline.
    if (isMockEnabled) {
      initedRef.current = true;
      mockRef.current = true;
      const entry = MOCK_PLAYLIST[0];
      setPlaylist(MOCK_PLAYLIST);
      setPlaylistIndex(0);
      setTrack({
        videoId: entry.videoId,
        title: entry.title ?? "",
        artist: entry.author ?? "",
        thumbnailUrl: entry.thumbnailUrl,
      });
      setDuration(MOCK_DURATION);
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        setHasPlayed(true);
        setPlayerState("playing");
      } else {
        setPlayerState("idle");
      }
      return () => {
        initedRef.current = false;
        mockRef.current = false;
      };
    }

    const container = playerContainerRef.current;
    if (!container) return;

    let destroyed = false;
    initedRef.current = true;

    setPlayerState("loading");
    /* eslint-enable react-hooks/set-state-in-effect */

    // Safety net: if onReady never fires (e.g. the postMessage handshake
    // silently fails), escape the loading skeleton so the widget shows
    // actionable state instead of spinning forever.
    const readyTimeout = setTimeout(() => {
      if (!destroyed && !playerRef.current) setPlayerState("error");
    }, 15_000);

    // getPlaylist() starts returning data some time after cueing — poll
    // until it lands, then stop.
    let playlistPoll: ReturnType<typeof setInterval> | null = null;

    loadYouTubeAPI()
      .then((YTApi) => {
        if (destroyed) return;

        const player = new YTApi.Player(container, {
          // The IFrame API requires a viewport of at least 200×200px for the
          // postMessage handshake to complete — a 0×0 (or display:none) player
          // never fires onReady. The host div is kept off-screen instead.
          height: 200,
          width: 200,
          playerVars: {
            listType: "playlist",
            list: PLAYLIST_ID,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            // Recommended by the IFrame API to authorize the JS-API origin.
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              clearTimeout(readyTimeout);
              // Cue the playlist without auto-playing unless play() already ran.
              setPlayerState("idle");
              setTrack(readTrack(player));
              if (pendingPlayAtRef.current !== null) {
                const index = pendingPlayAtRef.current;
                pendingPlayAtRef.current = null;
                pendingPlayRef.current = false;
                player.playVideoAt(index);
              } else if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                player.playVideo();
              }
              playlistPoll = setInterval(() => {
                syncPlaylist();
                try {
                  if ((player.getPlaylist() ?? []).length > 0 && playlistPoll) {
                    clearInterval(playlistPoll);
                    playlistPoll = null;
                  }
                } catch {
                  /* keep polling */
                }
              }, 500);
            },
            onStateChange: (event) => {
              if (destroyed) return;
              const mapped = ytStateToPlayerState(event.data);
              setPlayerState(mapped);
              setTrack(readTrack(player));
              syncPlaylist();
              if (mapped === "playing") setHasPlayed(true);
              // iOS Safari: nextVideo/previousVideo cues but doesn't auto-play.
              // Force playback when the new track is ready after a skip.
              if (pendingSkipRef.current && (mapped === "idle" || mapped === "paused")) {
                pendingSkipRef.current = false;
                player.playVideo();
              } else if (mapped === "playing") {
                pendingSkipRef.current = false;
              }
            },
            onError: () => {
              if (destroyed) return;
              clearTimeout(readyTimeout);
              setPlayerState("error");
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        clearTimeout(readyTimeout);
        if (!destroyed) setPlayerState("error");
      });

    return () => {
      destroyed = true;
      clearTimeout(readyTimeout);
      if (playlistPoll) clearInterval(playlistPoll);
      playerRef.current?.destroy();
      playerRef.current = null;
      initedRef.current = false;
    };
  }, [isMockEnabled, syncPlaylist, wantsPlayer]);

  // --- Progress polling (only while playing) ---
  useEffect(() => {
    if (playerState !== "playing") return;

    // Mock: tick a fake clock.
    if (mockRef.current) {
      const id = setInterval(() => {
        setCurrentTime((t) => Math.min(t + 1, MOCK_DURATION));
      }, 1000);
      return () => clearInterval(id);
    }

    if (!playerRef.current) return;
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
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [playerState]);

  // --- Lazy title resolution ---
  // Only once the playlist browser is opened (never on plain page load) —
  // resolves missing titles via oEmbed with bounded concurrency, filling
  // rows in progressively. Results are cached in localStorage, so this
  // fires real requests at most once per video ever.
  useEffect(() => {
    if (!isPlaylistOpen || mockRef.current) return;
    const missing = playlist.filter((e) => !e.title).map((e) => e.videoId);
    if (missing.length === 0) return;
    return resolveTrackMetas(missing, (videoId, meta) => {
      setPlaylist((prev) =>
        prev.map((e) =>
          e.videoId === videoId
            ? { ...e, title: meta.title, author: meta.author }
            : e,
        ),
      );
    });
  }, [isPlaylistOpen, playlist]);

  // --- Controls ---
  const play = useCallback(() => {
    // Mark on the user gesture so the Live Activity can appear while the
    // player is still buffering — not only after YouTube reports PLAYING.
    setHasPlayed(true);
    if (mockRef.current) {
      setPlayerState("playing");
      return;
    }
    if (playerRef.current) {
      playerRef.current.playVideo();
      return;
    }
    if (!isMockEnabled) setPlayerState("loading");
    requestPlayer({ play: true });
  }, [isMockEnabled, requestPlayer]);
  const pause = useCallback(() => {
    if (mockRef.current) {
      setPlayerState("paused");
      return;
    }
    playerRef.current?.pauseVideo();
  }, []);

  const mockJumpTo = useCallback((index: number) => {
    const entry = MOCK_PLAYLIST[index];
    if (!entry) return;
    mockIndexRef.current = index;
    setPlaylistIndex(index);
    setTrack({
      videoId: entry.videoId,
      title: entry.title ?? "",
      artist: entry.author ?? "",
      thumbnailUrl: entry.thumbnailUrl,
    });
    setCurrentTime(0);
    setHasPlayed(true);
    setPlayerState("playing");
  }, []);

  const next = useCallback(() => {
    if (mockRef.current) {
      mockJumpTo((mockIndexRef.current + 1) % MOCK_PLAYLIST.length);
      return;
    }
    if (!playerRef.current) {
      requestPlayer({ play: true });
      return;
    }
    pendingSkipRef.current = true;
    playerRef.current.nextVideo();
  }, [mockJumpTo, requestPlayer]);
  const previous = useCallback(() => {
    if (mockRef.current) {
      mockJumpTo(
        (mockIndexRef.current - 1 + MOCK_PLAYLIST.length) %
          MOCK_PLAYLIST.length,
      );
      return;
    }
    if (!playerRef.current) {
      requestPlayer({ play: true });
      return;
    }
    pendingSkipRef.current = true;
    playerRef.current.previousVideo();
  }, [mockJumpTo, requestPlayer]);

  const playAt = useCallback(
    (index: number) => {
      if (mockRef.current) {
        mockJumpTo(index);
        return;
      }
      if (!playerRef.current) {
        pendingPlayAtRef.current = index;
        requestPlayer({ play: true });
        return;
      }
      // Same iOS-Safari guard as next/previous: playVideoAt may only cue.
      pendingSkipRef.current = true;
      setHasPlayed(true);
      playerRef.current.playVideoAt(index);
    },
    [mockJumpTo, requestPlayer],
  );

  const openPlaylist = useCallback(() => {
    setPlaylistOpen(true);
    requestPlayer();
  }, [requestPlayer]);
  const closePlaylist = useCallback(() => setPlaylistOpen(false), []);

  return (
    <MusicContext.Provider
      value={{
        track,
        playerState,
        currentTime,
        duration,
        hasPlayed,
        isEnabled: settings.enabled,
        setEnabled,
        play,
        pause,
        next,
        previous,
        isMockEnabled,
        setMockEnabled,
        playlist,
        playlistIndex,
        playAt,
        isPlaylistOpen,
        openPlaylist,
        closePlaylist,
      }}
    >
      {children}
      {/* Global YouTube player host — always mounted so playback persists
          across navigation. Pushed off-screen (not collapsed to 0×0 or
          display:none) so the player keeps the ≥200×200 viewport the IFrame
          API needs to fire onReady, while staying invisible. */}
      <div
        ref={playerContainerRef}
        className="fixed pointer-events-none"
        aria-hidden
        style={{ left: -9999, top: -9999, width: 200, height: 200 }}
      />
    </MusicContext.Provider>
  );
}
