import { DEFAULT_OS_THEME, OS_THEMES } from "../themes";

// =============================================================================
// The theme's storage keys and its boot script — a plain module (no
// "use client"), because the root layout is a server component and must
// receive the script as a string, not as a client reference.
// =============================================================================

export const OS_THEME_STORAGE_KEY = "hux_os_theme";
/** Android theme: the Material colour style (tonal spot, vibrant, …). */
export const MD_STYLE_STORAGE_KEY = "hux_md_style";
/** Android theme: which colour option seeds the palette (`SeedChoice`). */
export const MD_SEED_STORAGE_KEY = "hux_md_seed";

/**
 * Keys this setting used to live under, and how an old value reads now.
 * The theme was once a "skin" (material / glass); the migration runs in the
 * boot script, before anything reads the new keys.
 */
const LEGACY = {
  skin: "hux_skin",
  style: "hux_skin_style",
  seed: "hux_skin_seed",
} as const;

/** Theme id → platform, for the boot script (mirrors the registry). */
const PLATFORMS = Object.fromEntries(
  Object.values(OS_THEMES).map((t) => [t.id, t.metadata.platform]),
);

/**
 * Runs in <head> before first paint: migrates the old keys once, then puts
 * the stored theme (and the Android theme's colour style) onto <html> as
 * `data-os-theme` / `data-os-platform` / `data-md-style`, so the server's
 * markup — which cannot know them — is never shown in the wrong theme. The
 * same attributes are kept by `applyRootOsTheme` (./root.ts) afterwards.
 */
export const OS_THEME_BOOT = `(function(){var d=document.documentElement,P=${JSON.stringify(
  PLATFORMS,
)},t=${JSON.stringify(DEFAULT_OS_THEME)};try{var L=localStorage;function m(a,b,f){var v=L.getItem(a);if(v!==null){if(L.getItem(b)===null)L.setItem(b,f?f(v):v);L.removeItem(a)}}m(${JSON.stringify(
  LEGACY.skin,
)},${JSON.stringify(OS_THEME_STORAGE_KEY)},function(v){return v==="glass"?"hux":"android"});m(${JSON.stringify(
  LEGACY.style,
)},${JSON.stringify(MD_STYLE_STORAGE_KEY)});m(${JSON.stringify(LEGACY.seed)},${JSON.stringify(
  MD_SEED_STORAGE_KEY,
)});var s=L.getItem(${JSON.stringify(OS_THEME_STORAGE_KEY)});if(s&&P[s])t=s;var y=L.getItem(${JSON.stringify(
  MD_STYLE_STORAGE_KEY,
)});if(y)d.dataset.mdStyle=y}catch(e){}d.dataset.osTheme=t;d.dataset.osPlatform=P[t]})();`;
