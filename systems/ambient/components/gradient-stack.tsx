"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { fixedBgTracker } from "../lib/fixed-bg-tracker";
import {
  GRADIENT_CROSSFADE_MS,
  GRADIENT_DEFOCUS_MS,
  type GradientLayerData,
} from "../lib/gradient";

// ---------------------------------------------------------------------------
// GradientStack — the shared crossfade renderer.
//
// Instead of dipping the gradient to transparent and swapping colors (which
// reads as a flash), we keep a small stack of gradient layers. When the weather
// or phase changes, the provider pushes a new layer; the topmost layer fades in
// over the settled one beneath it, so colors morph smoothly. The provider prunes
// old layers once the crossfade completes.
//
// One renderer serves both the full-page background and the per-widget overlays,
// so they share identical transition behaviour — and the iOS `fixedBgTracker`
// (background-attachment polyfill + viewport-relative edge mask) keeps working
// per layer. It is also source-agnostic: weather gradients and picture
// wallpapers are both just a `background-image`, which is what lets the two
// crossfade into each other when the wallpaper source changes.
// ---------------------------------------------------------------------------

interface GradientLayerProps {
  gradient: string;
  /** Only the topmost (newest) layer animates in; older layers sit at full. */
  isTop: boolean;
  durationMs: number;
  /** Card element used by the iOS tracker; null for the full-page background. */
  shell: HTMLElement | null;
  /** iOS: simulate background-attachment: fixed via the tracker. */
  positionBackground: boolean;
  /** Viewport-relative edge-fade mask (tracker) or static mask (full page). */
  edgeMask: string | null;
  /** Desktop widget: native background-attachment: fixed via CSS. */
  cssFixedAttachment: boolean;
  /** Picture wallpaper: scale to cover rather than stretch. */
  cover: boolean;
  /**
   * Reading page: defocus the picture. The blur is painted on an inner element
   * so the mask on this layer stays crisp and unscaled — and this path is only
   * taken full-page, never through the widget tracker.
   *
   * It fades in and out over the sharp layer rather than replacing it, so going
   * on and off a reading page is a defocus of the picture already on screen —
   * no second source, no layer push, no crossfade between two blurred copies.
   */
  blurred: boolean;
}

function GradientLayer({
  gradient,
  isTop,
  durationMs,
  shell,
  positionBackground,
  edgeMask,
  cssFixedAttachment,
  cover,
  blurred,
}: GradientLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // iOS / tracked positioning + mask. The tracker writes styles directly to the
  // element each frame, so it must own this layer's background-position & mask.
  useEffect(() => {
    if (!shell || !ref.current) return;
    if (!positionBackground && !edgeMask) return;
    return fixedBgTracker.register(shell, ref.current, {
      positionBackground,
      edgeMask: edgeMask ?? undefined,
    });
  }, [shell, positionBackground, edgeMask]);

  // The sharp picture is always painted: the defocus is an overlay that fades
  // in over it, and it needs something underneath to defocus INTO — otherwise
  // the fade starts from the bare page background.
  const style: React.CSSProperties = { backgroundImage: gradient };

  // Desktop widget: cheap native fixed attachment (no tracker).
  if (cssFixedAttachment) {
    style.backgroundAttachment = "fixed";
    style.backgroundSize = "100vw 100vh";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }

  // Picture wallpapers must keep their aspect ratio. `cover` is layered so the
  // flat base underneath still stretches — see buildAsset() in lib/wallpaper.
  // It comes last so it wins over the widget sizing above.
  if (cover) {
    style.backgroundSize = "cover, 100% 100%";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }

  // Full-page background: static mask (the layer is already viewport-fixed, so
  // no per-frame tracking is needed). Tracked masks go through fixedBgTracker.
  if (!shell && edgeMask) {
    style.WebkitMaskImage = edgeMask;
    style.maskImage = edgeMask;
    style.WebkitMaskRepeat = "no-repeat";
    style.maskRepeat = "no-repeat";
    style.WebkitMaskSize = "100% 100%";
    style.maskSize = "100% 100%";
  }

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className="absolute inset-0"
      style={style}
      initial={isTop ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: durationMs / 1000, ease: "easeInOut" }}
    >
      {/* `initial={false}`: a cold load onto a reading page lands defocused
          rather than animating into it. Every later toggle fades. */}
      <AnimatePresence initial={false}>
        {blurred && (
          <motion.div
            key="defocus"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: GRADIENT_DEFOCUS_MS / 1000, ease: "easeInOut" }}
          >
            {/* Scaled past the frame so the blur has pixels to sample at the
                edges instead of fading into nothing. */}
            <div
              className="absolute inset-0 scale-110 blur-2xl"
              style={{
                backgroundImage: gradient,
                backgroundSize: cover ? "cover, 100% 100%" : undefined,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface GradientStackProps {
  layers: GradientLayerData[];
  durationMs?: number;
  shell?: HTMLElement | null;
  positionBackground?: boolean;
  edgeMask?: string | null;
  cssFixedAttachment?: boolean;
  blurred?: boolean;
}

export function GradientStack({
  layers,
  durationMs = GRADIENT_CROSSFADE_MS,
  shell = null,
  positionBackground = false,
  edgeMask = null,
  cssFixedAttachment = false,
  blurred = false,
}: GradientStackProps) {
  return (
    <>
      {layers.map((layer, i) => (
        <GradientLayer
          key={layer.id}
          gradient={layer.gradient}
          isTop={i === layers.length - 1}
          durationMs={durationMs}
          shell={shell}
          positionBackground={positionBackground}
          edgeMask={edgeMask}
          cssFixedAttachment={cssFixedAttachment}
          cover={layer.cover ?? false}
          blurred={blurred}
        />
      ))}
    </>
  );
}
