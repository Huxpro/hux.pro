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
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  /** Ref the widget should attach to its iframe container div */
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
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
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  // Track pending skip so we can force playVideo() on iOS Safari
  const pendingSkipRef = useRef(false);

  // --- Initialize YouTube player ---
  useEffect(() => {
    if (!PLAYLIST_ID || initedRef.current) return;

    // Wait for the container div to be in the DOM (the widget renders it)
    const container = playerContainerRef.current;
    if (!container) return;

    let destroyed = false;
    initedRef.current = true;

    setPlayerState("loading");

    // Timeout: if onReady never fires, fall back to error state so the
    // widget escapes the loading skeleton and shows actionable feedback.
    const timeout = setTimeout(() => {
      if (!destroyed && !playerRef.current) {
        console.warn("[Music] YouTube player timed out — onReady never fired. origin:", window.location.origin);
        setPlayerState("error");
      }
    }, 15_000);

    loadYouTubeAPI()
      .then((YTApi) => {
        if (destroyed) return;

        const player = new YTApi.Player(container, {
          height: 0,
          width: 0,
          playerVars: {
            listType: "playlist",
            list: PLAYLIST_ID,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              clearTimeout(timeout);
              // Cue the playlist without auto-playing
              setPlayerState("idle");
              setTrack(readTrack(player));
            },
            onStateChange: (event) => {
              if (destroyed) return;
              const mapped = ytStateToPlayerState(event.data);
              setPlayerState(mapped);
              setTrack(readTrack(player));
              // iOS Safari: nextVideo/previousVideo cues but doesn't auto-play.
              // Force playback when the new track is ready after a skip.
              if (pendingSkipRef.current && (mapped === "idle" || mapped === "paused")) {
                pendingSkipRef.current = false;
                player.playVideo();
              } else if (mapped === "playing") {
                pendingSkipRef.current = false;
              }
            },
            onError: (event) => {
              if (destroyed) return;
              clearTimeout(timeout);
              console.warn("[Music] YouTube player error, code:", event.data, "origin:", window.location.origin);
              setPlayerState("error");
            },
          },
        });

        playerRef.current = player;
      })
      .catch((err) => {
        clearTimeout(timeout);
        if (!destroyed) {
          console.warn("[Music] Failed to load YouTube IFrame API:", err);
          setPlayerState("error");
        }
      });

    return () => {
      destroyed = true;
      clearTimeout(timeout);
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
  const play = useCallback(() => playerRef.current?.playVideo(), []);
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
        isEnabled: settings.enabled,
        setEnabled,
        play,
        pause,
        next,
        previous,
        playerContainerRef,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
