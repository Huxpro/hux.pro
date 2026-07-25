"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MusicTrack, PlayerState } from "./lib/types";
import { loadYouTubeAPI, getYouTubeThumbnail } from "./lib/youtube-player";
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
    return {
      videoId: data.video_id,
      title: data.title || "",
      artist: (data.author || "").replace(/ - Topic$/, ""),
      thumbnailUrl: getYouTubeThumbnail(data.video_id),
    };
  } catch {
    return null;
  }
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

  // --- Player state ---
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  // Track pending skip so we can force playVideo() on iOS Safari
  const pendingSkipRef = useRef(false);

  // --- Initialize YouTube player ---
  // The container div is rendered by this provider (always mounted), so the
  // player persists across route changes and audio never stops on navigation.
  useEffect(() => {
    if (!PLAYLIST_ID || initedRef.current) return;

    const container = playerContainerRef.current;
    if (!container) return;

    let destroyed = false;
    initedRef.current = true;

    setPlayerState("loading");

    // Safety net: if onReady never fires (e.g. the postMessage handshake
    // silently fails), escape the loading skeleton so the widget shows
    // actionable state instead of spinning forever.
    const readyTimeout = setTimeout(() => {
      if (!destroyed && !playerRef.current) setPlayerState("error");
    }, 15_000);

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
              // Cue the playlist without auto-playing
              setPlayerState("idle");
              setTrack(readTrack(player));
            },
            onStateChange: (event) => {
              if (destroyed) return;
              const mapped = ytStateToPlayerState(event.data);
              setPlayerState(mapped);
              setTrack(readTrack(player));
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
      playerRef.current?.destroy();
      playerRef.current = null;
      initedRef.current = false;
    };
  }, []);

  // --- Progress polling (only while playing) ---
  useEffect(() => {
    if (playerState !== "playing" || !playerRef.current) return;
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

  // --- Controls ---
  const play = useCallback(() => {
    // Mark on the user gesture so the Live Activity can appear while the
    // player is still buffering — not only after YouTube reports PLAYING.
    setHasPlayed(true);
    playerRef.current?.playVideo();
  }, []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const next = useCallback(() => {
    pendingSkipRef.current = true;
    playerRef.current?.nextVideo();
  }, []);
  const previous = useCallback(() => {
    pendingSkipRef.current = true;
    playerRef.current?.previousVideo();
  }, []);

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
