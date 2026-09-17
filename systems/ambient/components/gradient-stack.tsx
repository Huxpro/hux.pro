"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { fixedBgTracker } from "../lib/fixed-bg-tracker";
import { GRADIENT_CROSSFADE_MS, type GradientLayerData } from "../lib/gradient";

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
//
// Picture wallpapers paint the 480px picker thumb first and fade the chosen
// @1x/@2x file on top once it has decoded — the same blur-up ryOS does with a
// 24px LQIP, using a thumb we already ship.
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
   */
  blurred: boolean;
  preview?: string | null;
  src?: string | null;
}

function useDecodedImage(src: string | null | undefined): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!src) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    const image = new Image();
    image.decoding = "async";
    const done = () => {
      if (!cancelled) setReady(true);
    };
    image.onload = () => {
      if (typeof image.decode !== "function") {
        done();
        return;
      }
      void image.decode().then(done).catch(done);
    };
    image.onerror = done;
    image.src = src;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);
  return ready;
}

function coverStyle(gradient: string, triple: boolean): React.CSSProperties {
  return {
    backgroundImage: gradient,
    backgroundSize: triple ? "cover, cover, 100% 100%" : "cover, 100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
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
  preview,
  src,
}: GradientLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fadeFull = Boolean(
    cover && preview && src && src !== preview && !shell && !cssFixedAttachment && !blurred
  );
  const fullReady = useDecodedImage(fadeFull ? src : null);
  const triple = Boolean(cover && preview && src && src !== preview);

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

  const style: React.CSSProperties = blurred || fadeFull ? {} : { backgroundImage: gradient };

  // Desktop widget: cheap native fixed attachment (no JS).
  if (cssFixedAttachment) {
    style.backgroundAttachment = "fixed";
    style.backgroundSize = "100vw 100vh";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }

  // Picture wallpapers must keep their aspect ratio. `cover` is layered so the
  // flat base underneath still stretches — see buildAsset() in lib/wallpaper.
  // It comes last so it wins over the widget sizing above.
  if (cover && !fadeFull) {
    style.backgroundSize = triple ? "cover, cover, 100% 100%" : "cover, 100% 100%";
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

  const thumbGradient = preview
    ? `url("${preview}"), linear-gradient(transparent, transparent)`
    : gradient;

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
      {fadeFull && preview && src && (
        <>
          <div
            className="absolute inset-0 origin-center scale-110"
            style={{
              ...coverStyle(thumbGradient, false),
              filter: "blur(16px)",
            }}
          />
          {/* `src` is fetched only via Image() until it has decoded, so the
              first paint is the thumb. Putting the full URL in CSS at opacity
              0 would start the retina download twice. */}
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{
              ...(fullReady
                ? coverStyle(`url("${src}"), linear-gradient(transparent, transparent)`, false)
                : {}),
              opacity: fullReady ? 1 : 0,
            }}
          />
        </>
      )}
      {blurred && (
        // Scaled past the layer so the blur has pixels to sample at the edges
        // instead of fading into nothing.
        <div
          className="absolute inset-0 scale-110"
          style={{
            // Radius from the legibility policy (`--wp-blur` on <html>): a
            // busy picture is defocused further than a calm one.
            filter: "blur(var(--wp-blur, 40px))",
            backgroundImage: gradient,
            backgroundSize: cover ? (triple ? "cover, cover, 100% 100%" : "cover, 100% 100%") : undefined,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
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
          preview={layer.preview}
          src={layer.src}
        />
      ))}
    </>
  );
}
