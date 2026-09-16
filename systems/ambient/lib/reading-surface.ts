/**
 * Home is the desktop; everything else is a reading surface.
 *
 * A wallpaper behind a 680px prose column is a competing figure. So the two
 * contexts treat it differently:
 *
 *   home (`/`)     full strength, sharp, untinted. It IS the content — the
 *                  widgets are a springboard floating on a desktop.
 *   everywhere else behind a veil of the page colour, so the prose column is
 *                  the figure; a picture is defocused as well. No card, no
 *                  radius, no boxed article.
 *
 * Both halves of that are devtool-switchable (`wallpaperReadingBlur`,
 * `wallpaperReadingDim`) because it is a taste call and the only way to settle
 * a taste call is to look at both. The veil applies to every kind — the Sky
 * and the Gradient recede too; the blur only to a picture, which is the only
 * kind with detail to defocus.
 */
export const WALLPAPER_HOME_PATH = "/";

/**
 * The Legibility Lab looks at the wallpaper the way the home screen does —
 * sharp, unveiled — and simulates the reading treatment inside one of its own
 * specimens, so it is a desktop too.
 */
export const LEGIBILITY_LAB_PATH = "/editor/legibility";

/**
 * The Sky Engine Lab paints its own scene full-page as the stage; a veil over
 * it would hide the very thing being tuned.
 */
export const SKY_LAB_PATH = "/editor/sky";

export function isWallpaperHomePath(pathname: string | null): boolean {
  return (
    pathname === WALLPAPER_HOME_PATH ||
    pathname === LEGIBILITY_LAB_PATH ||
    pathname === SKY_LAB_PATH
  );
}

/** Whether the wallpaper should recede for reading on this route. */
export function isReadingSurface(params: { pathname: string | null }): boolean {
  return !isWallpaperHomePath(params.pathname);
}
