// =============================================================================
// Theme Boot: the `dark` class before first paint.
//
// The provider (./theme.tsx) applies the theme in an effect, a frame after
// hydration at best, so a dark page painted light first: a white flash on every
// load, as long as the bundle took. On iOS 26 that first paint is also where
// Safari picks its chrome colour, from the root background (see
// packages/vitre).
//
// This script makes the provider's first decision before React runs: a saved
// light or dark is what it says; system, Follow the Sun and nothing saved all
// read the OS, which is what Follow the Sun trusts until the sun's answer
// arrives. The provider takes over from there. Its own module, not theme.tsx,
// because a value exported from a "use client" module reaches a server
// component as a client reference, not a string.
// =============================================================================

export const THEME_STORAGE_KEY = "hux_theme";

export const THEME_BOOT_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",dark);
}catch(e){}})()`;
