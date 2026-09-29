// =============================================================================
// The skin's storage keys and its boot script — a plain module (no
// "use client"), because the root layout is a server component and must
// receive the script as a string, not as a client reference.
// =============================================================================

export const SKIN_STORAGE_KEY = "hux_skin";
export const SCHEME_STYLE_STORAGE_KEY = "hux_skin_style";

/**
 * Runs in <head> before first paint: the stored skin and colour style onto
 * <html>, so the server's markup (which cannot know them) is never shown in
 * the wrong skin. Material unless the visitor chose Glass; kept in step with
 * `readStoredSkin` in services/skin.tsx.
 */
export const SKIN_BOOT = `(function(){var d=document.documentElement;try{var s=localStorage.getItem(${JSON.stringify(
  SKIN_STORAGE_KEY,
)});d.dataset.skin=s==="glass"?"glass":"material";var y=localStorage.getItem(${JSON.stringify(
  SCHEME_STYLE_STORAGE_KEY,
)});if(y)d.dataset.mdStyle=y}catch(e){d.dataset.skin="material"}})();`;
