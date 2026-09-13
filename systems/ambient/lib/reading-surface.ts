/**
 * Home is the desktop; everything else is a reading surface.
 *
 * An image wallpaper is a picture, and a picture behind a 680px prose column is
 * a competing figure. So the two contexts treat it differently:
 *
 *   home (`/`)     full strength, sharp, untinted. It IS the content — the
 *                  widgets are a springboard floating on a desktop.
 *   everywhere else defocused behind a veil, with an edge vignette that recedes
 *                  it at the margins and leaves the prose column as the figure.
 *                  No card, no radius, no boxed article.
 *
 * Both halves of that are devtool-switchable (`wallpaperDimHome`,
 * `wallpaperReadingBlur`, `wallpaperReadingDim`) because it is a taste call and
 * the only way to settle a taste call is to look at both.
 *
 * The weather gradient needs none of this: it has no detail to compete with.
 */
export const WALLPAPER_HOME_PATH = "/";

export function isWallpaperHomePath(pathname: string | null): boolean {
  return pathname === WALLPAPER_HOME_PATH;
}

/** Whether the wallpaper should recede for reading on this route. */
export function isReadingSurface(params: {
  kind: "weather" | "image";
  pathname: string | null;
}): boolean {
  return params.kind === "image" && !isWallpaperHomePath(params.pathname);
}
