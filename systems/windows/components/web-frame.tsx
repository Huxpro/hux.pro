"use client";

import { Glow } from "@/systems/glow";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// WebFrame — a web app in an <iframe>, with a "won't embed" fallback
//
// Many sites refuse framing (X-Frame-Options / CSP frame-ancestors), and the
// browser blocks that at a layer JS can't read cross-origin. So instead of
// pretending to detect it, we wait for the frame's `load`: if it never fires
// within a grace window, we surface a non-blocking banner offering to open the
// app in a real tab. If it does load, the banner never appears.
// =============================================================================

export function WebFrame({ url, title }: { url: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setStalled(true), 4000);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div className="relative h-full w-full bg-white dark:bg-neutral-900">
      {/* Loading: the site's glow working — the same travelling beam a field
          shows while it settles what was said (systems/glow), along the top
          of the page the way a browser's loading bar runs, over a blank
          ground. It sweeps out as the page lands. */}
      {!loaded && <div className="absolute inset-0 z-10 bg-background" />}
      <div className="pointer-events-none absolute inset-0 z-10">
        <Glow active={!loaded} shape="line" edge="top" processing reach={7} />
      </div>

      <iframe
        ref={ref}
        src={url}
        title={title}
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0"
        // Curated external apps, but still sandboxed defensively.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-modals"
        allow="fullscreen; autoplay; clipboard-read; clipboard-write; accelerometer; gyroscope"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {stalled && !loaded && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-black/10 bg-glass-sheet px-4 py-3 backdrop-blur-md dark:border-white/10">
          <p className="text-xs text-muted-foreground">
            This site may block embedding.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            Open in a new tab
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
