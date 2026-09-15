// =============================================================================
// Capability detection for the shader wallpaper.
// =============================================================================

let webgl2Cache: boolean | null = null;

/** Whether this browser can create a WebGL2 context (cached per session). */
export function supportsWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    webgl2Cache = !!gl;
    // Free the probe context eagerly; browsers cap live contexts.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export interface WallpaperQualityProfile {
  /** Target internal pixel count; the canvas is upscaled by CSS beyond it. */
  pixelBudget: number;
  /** Frame-rate cap. */
  maxFps: number;
}

/**
 * The scene is soft (gradients, fbm clouds), so rendering below device
 * resolution and letting CSS upscale is nearly invisible — and it is what
 * keeps a full-screen five-octave fbm affordable on phones.
 */
export function getWallpaperQualityProfile(): WallpaperQualityProfile {
  const coarse = isCoarsePointer();
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;
  if (coarse) {
    return { pixelBudget: cores <= 4 ? 320_000 : 480_000, maxFps: 45 };
  }
  return { pixelBudget: cores <= 4 ? 700_000 : 1_100_000, maxFps: 60 };
}
