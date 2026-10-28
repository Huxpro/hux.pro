"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AskLoadError } from "./skeleton";

// =============================================================================
// A piece of Ask that arrives after the surface it sits in.
//
// The surface is already on screen (the command card jumped, the drawer came
// up, the panel is docked) with a skeleton in it. This loads the piece, fades
// it in over that skeleton, and then lets the skeleton go. The second time
// the piece is free: the module is already here, so it paints with the
// surface instead of fading in again.
// =============================================================================

const FADE_MS = 300;

export function FadeSlot({
  ready,
  fallback,
  children,
}: {
  /** The real piece can paint. False keeps only the skeleton. */
  ready: boolean;
  fallback: ReactNode;
  children: ReactNode;
}) {
  // Ready on the first paint: there is nothing to fade over.
  const [shown, setShown] = useState(ready);
  const [settled, setSettled] = useState(ready);

  useEffect(() => {
    if (!ready || settled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Two frames, not one. A rAF runs before that frame is painted, so a
    // single one would flip the piece to opaque before the browser had ever
    // painted it transparent, and the fade would have nothing to start from.
    // The same wait a kept-mounted sheet uses on the way in (sheet.tsx).
    // Reduced motion still waits those frames, then settles with the fade
    // itself turned off (`motion-reduce:transition-none`), so the skeleton
    // does not linger.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setShown(true);
        if (reduced) setSettled(true);
      });
    });
    const done = reduced ? 0 : window.setTimeout(() => setSettled(true), FADE_MS + 40);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      if (done) window.clearTimeout(done);
    };
  }, [ready, settled]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {!settled && (
        <div
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", shown && "invisible")}
          // Once the piece is fading in it is the one to read and to use.
          inert={shown}
          aria-hidden={shown || undefined}
        >
          {fallback}
        </div>
      )}
      {ready && (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            !settled && "absolute inset-0",
            shown ? "opacity-100" : "pointer-events-none opacity-0",
            "transition-opacity duration-300 ease-out motion-reduce:transition-none",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The default export of `load`, shown after `fallback`. `fallback` is called
 * as a render function and must not itself call hooks; a component it returns
 * may.
 */
export function askLazy<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  fallback: (props: P) => ReactNode,
) {
  let cached: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const loadOnce = () => {
    if (cached) return Promise.resolve(cached);
    pending ??= load().then((mod) => {
      cached = mod.default;
      return mod.default;
    }).catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };

  return function AskLazy(props: P) {
    const [Comp, setComp] = useState<ComponentType<P> | null>(() => cached);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (Comp) return;
      let live = true;
      loadOnce().then((Loaded) => {
        if (live) setComp(() => Loaded);
      }).catch(() => {
        if (live) setFailed(true);
      });
      return () => {
        live = false;
      };
    }, [Comp]);

    return (
      <FadeSlot ready={Comp !== null} fallback={failed ? <AskLoadError /> : fallback(props)}>
        {Comp && <Comp {...props} />}
      </FadeSlot>
    );
  };
}
