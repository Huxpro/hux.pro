"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { loadYouTubeAPIIn } from "../lib/native-window";
import { embedUrlFor, type YTPlayerExt } from "../lib/player";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// NativeWindowPlayer: what the native picture-in-picture window shows.
//
// Rendered into the window's document through a portal, so it is this page's
// React tree, reading the same theater context. The window is the picture
// and nothing else: the browser draws its title bar (with its own "back to
// tab" and close, both of which bring the player back to the page), and the
// player's own controls are inside the frame. Transport from the page (the
// dock's Live Activity, which stands for the player while it is out) drives
// this player too: the provider sends play, pause and seek to whichever
// player is live.
//
// A YouTube video gets a player of its own here, made from the window's own
// copy of the IFrame API and started where the page's left off (see
// lib/native-window.ts for why it cannot be the same one). A deck or another
// platform's embed is a plain frame, and starts from the top: it has no API
// to say where it was.
// ---------------------------------------------------------------------------

export function NativeWindowPlayer() {
  const { nativeWindow } = useTheater();
  if (!nativeWindow) return null;
  return createPortal(<WindowStage win={nativeWindow} />, nativeWindow.document.body);
}

function WindowStage({ win }: { win: Window }) {
  const { track, nativeHandoff, attachNativePlayer, reportNativeState } = useTheater();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerExt | null>(null);
  const loadedRef = useRef<string | null>(null);

  const videoId =
    track?.kind === "video" && track.platform === "youtube" ? track.videoId : null;
  const embedUrl = useMemo(() => {
    if (!track || videoId) return null;
    if (track.kind === "slides") return track.url;
    return embedUrlFor(track.url, track.platform);
  }, [track, videoId]);

  // The window's YouTube player: made once, on the first YouTube track, and
  // handed each later one. It is attached to the provider when it is ready,
  // and from then on it is the one play / pause / seek reach.
  useEffect(() => {
    const existing = playerRef.current;
    if (!videoId) {
      try {
        existing?.stopVideo();
      } catch {
        /* noop */
      }
      loadedRef.current = null;
      return;
    }
    if (existing) {
      if (loadedRef.current !== videoId) {
        loadedRef.current = videoId;
        existing.loadVideoById(videoId);
      }
      return;
    }

    let cancelled = false;
    const { startAt, resume } = nativeHandoff();
    loadYouTubeAPIIn(win)
      .then((api) => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        const inner = win.document.createElement("div");
        host.appendChild(inner);
        const player = new api.Player(inner, {
          width: 480,
          height: 270,
          playerVars: {
            autoplay: resume ? 1 : 0,
            controls: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              loadedRef.current = videoId;
              const at = { videoId, startSeconds: startAt };
              if (resume) player.loadVideoById(at);
              else player.cueVideoById(at);
              attachNativePlayer(player);
            },
            onStateChange: (e) => reportNativeState(e.data),
          },
        }) as YTPlayerExt;
        playerRef.current = player;
      })
      .catch(() => {
        /* the API would not load in the window: the frame stays black */
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, win, nativeHandoff, attachNativePlayer, reportNativeState]);

  useEffect(() => () => attachNativePlayer(null), [attachNativePlayer]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* `theater-stage` for the stylesheet's rule that makes the API's
          iframe fill its box, copied over with the rest of the page's CSS. */}
      <div
        ref={hostRef}
        className="theater-stage"
        style={{ position: "absolute", inset: 0, opacity: videoId ? 1 : 0 }}
      />
      {embedUrl && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={track?.title ?? "Video"}
          allow={
            track?.kind === "slides"
              ? "fullscreen; clipboard-write"
              : "autoplay; fullscreen; picture-in-picture"
          }
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      )}
    </div>
  );
}
