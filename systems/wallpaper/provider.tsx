"use client";

import { useTheme } from "@/services";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getWallpaperPair,
  resolveCatalogPair,
  resolvePairVariant,
  resolveWallpaperSrc,
  wallpaperDocumentClassNames,
  wallpaperLabel,
  toggleGlassMaterial,
  type GlassMaterial,
  type ThemeVariant,
  type WallpaperAppearance,
  type WallpaperKind,
  type WallpaperPair,
  type WallpaperSettings,
  getDefaultWallpaperSettings,
  getWallpaperSettings,
  setWallpaperSettings,
} from "./lib";

// =============================================================================
// Wallpaper System — weather and image are mutually exclusive kinds
// of the same full-page surface.
// =============================================================================

export const WALLPAPER_CROSSFADE_MS = 700;

export interface WallpaperLayerData {
  id: number;
  src: string;
}

export interface WallpaperDebugOverride {
  kind?: WallpaperKind;
  imageId?: string;
  appearance?: WallpaperAppearance;
}

interface WallpaperContextType {
  kind: WallpaperKind;
  imageId: string;
  appearance: WallpaperAppearance;
  /** iOS Liquid Glass material. Clear thins `--glass*` on image wallpaper. */
  glass: GlassMaterial;
  pair: WallpaperPair;
  /** Resolved light/dark variant after auto + theme. */
  variant: ThemeVariant;
  src: string;
  thumb: string;
  /** Crossfade stack: [...settled, newest]. */
  layers: WallpaperLayerData[];
  setKind: (kind: WallpaperKind) => void;
  setImageId: (id: string) => void;
  setAppearance: (appearance: WallpaperAppearance) => void;
  setGlass: (glass: GlassMaterial) => void;
  toggleGlass: () => void;
  selectWeather: () => void;
  selectImage: (id: string) => void;
  label: (locale: "en" | "zh", weatherModeLabel?: string) => string;
  debugOverride: WallpaperDebugOverride;
  setDebugOverride: (override: WallpaperDebugOverride) => void;
}

const WallpaperContext = createContext<WallpaperContextType | undefined>(
  undefined
);

export function useWallpaper() {
  const context = useContext(WallpaperContext);
  if (!context) {
    throw new Error("useWallpaper must be used within WallpaperProvider");
  }
  return context;
}

export function useOptionalWallpaper() {
  return useContext(WallpaperContext);
}

export function WallpaperProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [settings, setSettingsState] = useState<WallpaperSettings>(
    getDefaultWallpaperSettings
  );
  const [debugOverride, setDebugOverride] = useState<WallpaperDebugOverride>(
    {}
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSettingsState(getWallpaperSettings());
  }, []);

  const updateSettings = useCallback((partial: Partial<WallpaperSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      setWallpaperSettings(next);
      return next;
    });
  }, []);

  const setKind = useCallback(
    (kind: WallpaperKind) => {
      if (kind === settings.kind) return;
      updateSettings({ kind });
    },
    [settings.kind, updateSettings]
  );

  const setImageId = useCallback(
    (id: string) => {
      if (!getWallpaperPair(id) || id === settings.imageId) return;
      updateSettings({ imageId: id });
    },
    [settings.imageId, updateSettings]
  );

  const setAppearance = useCallback(
    (appearance: WallpaperAppearance) => {
      if (appearance === settings.appearance) return;
      updateSettings({ appearance });
    },
    [settings.appearance, updateSettings]
  );

  const setGlass = useCallback(
    (glass: GlassMaterial) => {
      if (glass === settings.glass) return;
      updateSettings({ glass });
    },
    [settings.glass, updateSettings]
  );

  const toggleGlass = useCallback(() => {
    updateSettings({ glass: toggleGlassMaterial(settings.glass) });
  }, [settings.glass, updateSettings]);

  const selectWeather = useCallback(() => {
    updateSettings({ kind: "weather" });
  }, [updateSettings]);

  const selectImage = useCallback(
    (id: string) => {
      if (!getWallpaperPair(id)) return;
      updateSettings({ kind: "image", imageId: id });
    },
    [updateSettings]
  );

  const kind = debugOverride.kind ?? settings.kind;
  const imageId = debugOverride.imageId ?? settings.imageId;
  const appearance = debugOverride.appearance ?? settings.appearance;
  const glass = settings.glass;
  const pair = useMemo(() => resolveCatalogPair(imageId), [imageId]);
  const variant = resolvePairVariant(appearance, theme);
  const src = resolveWallpaperSrc(pair, appearance, theme);
  const thumb = resolveWallpaperSrc(pair, appearance, theme, { thumb: true });

  const [layers, setLayers] = useState<WallpaperLayerData[]>([]);
  const layerIdRef = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect -- crossfade stack, same as ambient gradientLayers */
  useEffect(() => {
    if (kind !== "image") {
      setLayers((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.src === src) return prev;
      layerIdRef.current += 1;
      return [...prev, { id: layerIdRef.current, src }];
    });
  }, [kind, src]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (layers.length <= 1) return;
    const timeout = window.setTimeout(() => {
      setLayers((prev) => (prev.length <= 1 ? prev : prev.slice(-1)));
    }, WALLPAPER_CROSSFADE_MS + 50);
    return () => window.clearTimeout(timeout);
  }, [layers]);

  const label = useCallback(
    (locale: "en" | "zh", weatherModeLabel?: string) =>
      wallpaperLabel({
        kind,
        pair,
        appearance,
        locale,
        weatherModeLabel,
      }),
    [kind, pair, appearance]
  );

  useEffect(() => {
    const root = document.documentElement;
    const { image, read } = wallpaperDocumentClassNames(kind, pathname);
    root.classList.toggle("wallpaper-image", image);
    root.classList.toggle("wallpaper-read", read);
    root.classList.toggle("glass-tinted", glass === "tinted");
    return () => {
      root.classList.remove("wallpaper-image", "wallpaper-read", "glass-tinted");
    };
  }, [kind, pathname, glass]);

  return (
    <WallpaperContext.Provider
      value={{
        kind,
        imageId,
        appearance,
        glass,
        pair,
        variant,
        src,
        thumb,
        layers,
        setKind,
        setImageId,
        setAppearance,
        setGlass,
        toggleGlass,
        selectWeather,
        selectImage,
        label,
        debugOverride,
        setDebugOverride,
      }}
    >
      {children}
    </WallpaperContext.Provider>
  );
}
