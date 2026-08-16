// =============================================================================
// YouTube IFrame Player API — Singleton loader
// Follows the same pattern as the Twitter SDK loader in
// components/log/media/twitter.tsx (singleton promise, script injection).
// =============================================================================

let apiPromise: Promise<typeof YT> | null = null;

/**
 * Load the YouTube IFrame API script exactly once and resolve when
 * `window.YT.Player` is available.
 */
export function loadYouTubeAPI(): Promise<typeof YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser"));
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    // Already loaded
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // The API calls this global callback when ready
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (existing) {
      // Script tag exists but API not ready yet — the callback will fire
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Failed to load YouTube IFrame API"));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * YouTube thumbnail URL from a video ID.
 * `mqdefault` is 320×180 (native 16:9, no letterboxing) — clean for
 * square album-art crops via object-fit:cover without scaling hacks.
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// =============================================================================
// TypeScript declarations for the YouTube IFrame API
// =============================================================================

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    enum PlayerState {
      UNSTARTED = -1,
      ENDED = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5,
    }

    interface PlayerOptions {
      height?: number | string;
      width?: number | string;
      videoId?: string;
      playerVars?: PlayerVars;
      events?: PlayerEvents;
    }

    interface PlayerVars {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      disablekb?: 0 | 1;
      fs?: 0 | 1;
      modestbranding?: 0 | 1;
      rel?: 0 | 1;
      listType?: "playlist" | "user_uploads";
      list?: string;
      loop?: 0 | 1;
      origin?: string;
      playsinline?: 0 | 1;
    }

    interface PlayerEvents {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
    }

    interface PlayerEvent {
      target: Player;
    }

    interface OnStateChangeEvent {
      target: Player;
      data: PlayerState;
    }

    interface OnErrorEvent {
      target: Player;
      data: number;
    }

    interface VideoData {
      video_id: string;
      title: string;
      author: string;
    }

    class Player {
      constructor(
        elementId: string | HTMLElement,
        options: PlayerOptions,
      );
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      nextVideo(): void;
      previousVideo(): void;
      playVideoAt(index: number): void;
      getPlayerState(): PlayerState;
      getVideoData(): VideoData;
      getCurrentTime(): number;
      getDuration(): number;
      setVolume(volume: number): void;
      getVolume(): number;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      setShuffle(shuffle: boolean): void;
      setLoop(loop: boolean): void;
      getPlaylist(): string[];
      getPlaylistIndex(): number;
      destroy(): void;
    }
  }
}

export {};
