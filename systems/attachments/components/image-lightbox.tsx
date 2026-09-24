"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { isImageMedia } from "@/lib/log";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  GLASS_BTN,
  GLASS_CLUSTER,
  THEATER_BACKDROP,
} from "@/systems/theater/lib/chrome";
import { useAttachments } from "../provider";

// =============================================================================
// ImageLightbox — a still, letterboxed, to be read.
//
// An image attached to a commit is usually something to read rather than to
// glance at: a poster, a figure, a page. The attachment surface shows it at
// the width of a sheet, which is a thumbnail for a 44×34 poster. The lightbox
// is its home instead (lib/policy.ts): the page steps back under the
// theater's veil, the image is fitted to the viewport with a margin all round
// (the letterbox), and from there it zooms — wheel or trackpad, a pinch,
// a double-click at the point to read, `+` / `-` / `0` — and pans by drag.
//
// Zoom and pan are react-zoom-pan-pinch; the modal is Base UI's Dialog (focus
// trap, scroll lock, Escape, the return of focus to the cover that opened
// it). The chrome is the theater's: a title line at the top left, a glass
// cluster at the top right. Scale 1 is "fit", so the readout says 100% when
// the whole image is in view; the ceiling is twice the image's own pixels,
// so the smallest footnote on a 4400px poster still resolves.
// =============================================================================

/**
 * Room kept around the fitted image: the top bar above it, a side margin, and
 * a band below that the hint sits in (split with the band above the image,
 * since the fitted image is centred in what is left).
 */
const TOP = 64;
const MARGIN = 24;
const BELOW = 56;

/** Past the image's native pixels, how far the zoom may still go. */
const OVERZOOM = 2;

export function ImageLightbox() {
  const { lightbox, lightboxOpen, closeLightbox } = useAttachments();
  const { locale } = useLocale();

  const media = lightbox ? lightbox.set.items[lightbox.index] : undefined;
  const image = media && isImageMedia(media) ? media : null;

  const ref = useRef<ReactZoomPanPinchRef | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [scale, setScale] = useState(1);
  const [maxScale, setMaxScale] = useState(8);

  // The ceiling is the image's own resolution over its fitted size.
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) return;
    setMaxScale(Math.max(2, (img.naturalWidth / img.clientWidth) * OVERZOOM));
  }, []);

  const fit = useCallback(() => {
    ref.current?.resetTransform(200);
    // Reset returns to the initial position, which was measured before the
    // image had a size; centre on what it is now.
    requestAnimationFrame(() => ref.current?.centerView(1, 0));
  }, []);

  // A resize changes the fitted size: land back at fit, and re-measure.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onResize = () => {
      measure();
      fit();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [lightboxOpen, measure, fit]);

  // `+` / `-` / `0` — the zoom keys of every image viewer.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const r = ref.current;
      if (!r) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        r.zoomIn(0.5);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        r.zoomOut(0.5);
      } else if (e.key === "0") {
        e.preventDefault();
        fit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, fit]);

  const title = lightbox?.set.title ?? "";
  const subtitle = lightbox?.set.subtitle;
  const src = image?.url ?? "";

  return (
    <Dialog.Root
      open={lightboxOpen && !!image}
      onOpenChange={(open) => {
        if (!open) closeLightbox();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-[10010]",
            THEATER_BACKDROP,
            "transition-opacity duration-200",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          initialFocus={closeRef}
          className={cn(
            "fixed inset-0 z-[10011] outline-none",
            "transition-[opacity,transform] duration-200 ease-out",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98]",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]",
          )}
        >
          {image && (
            <>
              <TransformWrapper
                key={lightbox?.key}
                ref={ref}
                minScale={1}
                maxScale={maxScale}
                centerOnInit
                centerZoomedOut
                limitToBounds
                wheel={{ step: 0.15 }}
                doubleClick={{ mode: "toggle", step: 1.5 }}
                onTransform={(_, state) => setScale(state.scale)}
              >
                <TransformComponent
                  wrapperClass="!absolute !inset-x-0 !bottom-0"
                  wrapperStyle={{ top: TOP, width: "100%", height: `calc(100% - ${TOP}px)` }}
                  contentClass="cursor-grab active:cursor-grabbing"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the zoom needs the full-resolution file untouched */}
                  <img
                    ref={imgRef}
                    src={src}
                    alt={image.alt ?? title}
                    draggable={false}
                    onLoad={() => {
                      measure();
                      ref.current?.centerView(1, 0);
                    }}
                    style={{
                      maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
                      maxHeight: `calc(100dvh - ${TOP + BELOW}px)`,
                    }}
                    className="block h-auto w-auto select-none rounded-md shadow-2xl ring-1 ring-border/50"
                  />
                </TransformComponent>
              </TransformWrapper>

              {/* The top bar: whose image this is, and the controls. */}
              <div
                className="system-chrome pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-4 sm:px-6"
                style={{ height: TOP }}
              >
                <div className="min-w-0">
                  <Dialog.Title className={cn(TYPE.mediaTitle, "truncate")}>
                    {title}
                  </Dialog.Title>
                  {subtitle && (
                    <Dialog.Description className={cn(TYPE.labelSm, "truncate")}>
                      {subtitle}
                    </Dialog.Description>
                  )}
                </div>
                <div className={cn(GLASS_CLUSTER, "pointer-events-auto shrink-0")}>
                  <button
                    type="button"
                    onClick={() => ref.current?.zoomOut(0.5)}
                    disabled={scale <= 1.001}
                    aria-label={t(locale, "lightboxZoomOut")}
                    title={`${t(locale, "lightboxZoomOut")} (−)`}
                    className={cn(GLASS_BTN, "h-8 w-8")}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={fit}
                    aria-label={t(locale, "lightboxFit")}
                    title={`${t(locale, "lightboxFit")} (0)`}
                    className={cn(
                      GLASS_BTN,
                      "h-8 min-w-[3.25rem] px-1.5 font-mono text-[11px] tabular-nums",
                    )}
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => ref.current?.zoomIn(0.5)}
                    disabled={scale >= maxScale - 0.001}
                    aria-label={t(locale, "lightboxZoomIn")}
                    title={`${t(locale, "lightboxZoomIn")} (+)`}
                    className={cn(GLASS_BTN, "h-8 w-8")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(locale, "lightboxOriginal")}
                    title={t(locale, "lightboxOriginal")}
                    className={cn(GLASS_BTN, "h-8 w-8")}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <Dialog.Close
                    ref={closeRef}
                    aria-label={t(locale, "lightboxClose")}
                    className={cn(GLASS_BTN, "h-8 w-8")}
                  >
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
              </div>

              {/* How to read it, until the reader has started to. */}
              <p
                aria-hidden
                className={cn(
                  TYPE.labelSm,
                  "system-chrome pointer-events-none absolute inset-x-0 bottom-2 text-center",
                  "transition-opacity duration-300",
                  scale > 1.001 && "opacity-0",
                )}
              >
                <span className="hidden sm:inline">{t(locale, "lightboxHint")}</span>
                <span className="sm:hidden">{t(locale, "lightboxHintTouch")}</span>
              </p>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
