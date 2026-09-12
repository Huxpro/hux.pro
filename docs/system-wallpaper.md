# Wallpaper System

Weather, images and a plain surface are mutually exclusive wallpaper sources.
Open **Wallpaper** in commands (`⌘K`, search “wallpaper” / “壁纸”), or press `/` then `W`.
The secondary window applies and saves changes immediately. Escape / Back returns to
commands; Done closes it. The window scrolls within the mobile viewport and keeps
keyboard focus inside its controls.

## Appearance

- **Auto** follows the site's resolved appearance, including system theme changes.
- **Light / Dark** pins the wallpaper variant without changing the site's theme.
- Pick a built-in pair, or use the two selectors to combine different wallpapers
  for light and dark appearances.
- Weather retains its Full screen / Widgets only placement. Plain disables both
  weather layers and image wallpaper.

The four built-in Apple pairs are Big Sur, Monterey, iOS 13 and iOS 14. Eight full
images and eight thumbnails total approximately 550 KiB. Only the active full image
loads; thumbnails load when the gallery opens. There are no runtime remote image
requests and no image optimization server is required.

## Ownership and persistence

`AmbientProvider` owns the single wallpaper selection alongside existing location
and weather preferences in `hux_ambient_settings`. `useWallpaper()` exposes saved
settings, effective settings, the resolved asset and an update action.

`systems/wallpaper/catalog.ts` defines validated IDs and appearance resolution.
`AmbientSurface` mounts one source. Weather full-screen and widget flags are gated
by that source **after** devtool gradient overrides, so forcing a weather layer
cannot put it over an image. Images use a fixed cover layer with a theme-colored
veil to preserve reading contrast. Failed images fall back to the theme background.
The image layer exposes `data-status="loading|ready|error"` for inspection.

Old Full / Widget / Off settings migrate without changing the visitor's choice;
legacy Adaptive maps to Full. First-visit iOS retains Widgets only. Invalid settings
and removed image IDs fall back safely. Image preferences and weather placement are
retained when switching sources.

Sunrise/sunset timing, weather queries, greetings and `AmbientPhaseActivity` remain
independent. A sun event may show its Dock notification and weather details while
an image stays on the page; it never switches the selected wallpaper.

## Devtool

The Wallpaper section previews source, pair and appearance, and displays the
resolved source, variant and asset path. Overrides are ephemeral, ignored while
Devtool is disabled, and reset on reload. **Reset preview** restores saved settings.
Editing the actual wallpaper settings also clears wallpaper and full/widget
rendering overrides so the user's selection is visible.

Use Time Of Day → Sunrise / Sunset to check the notification alongside any image.
Weather and Gradient sections continue to control weather rendering when Weather
is the selected source.

## Assets

`public/wallpapers/sources.json` records pinned original download URLs, zero-based
HEIC frame indices, output dimensions, byte counts and SHA-256 hashes. Originals are
Apple artwork archived by:

- [macOS wallpaper archive](https://github.com/benediktkr/Deeeee-macOS-Wallpapers)
- [iOS wallpaper archive](https://github.com/spheres0/ios-wallpapers)

Apple retains rights to the artwork. Archive repository licenses are not presented
as licenses for Apple's artwork. Original HEIC files are not shipped. The selected
frames were decoded with macOS ImageIO, resized to at most 2400 px (480 px for
thumbnails), converted to sRGB WebP at quality 84 (74 for thumbnails), without
upscaling. Keep provenance and hashes current when replacing assets.

## Verification

Run `node --experimental-strip-types --test tests/wallpaper.test.ts` (Node 22.6+),
`pnpm exec tsc --noEmit`, and the production build.

Browser checks should include:

- Search and `/ W` entry, Back / Escape, focus wrapping, close and reopen.
- Every pair, mixed pairs, Auto on system theme changes, fixed Light / Dark.
- Weather Full / Widgets only, Image and Plain; no overlapping backgrounds.
- Reload persistence, existing weather settings and first-visit iOS defaults.
- Devtool preview/reset/disable and sunrise/sunset notifications + expanded details.
- Block an image request: plain fallback, no broken-image icon or weather takeover.
- Desktop, 390 px mobile, 320 px mobile and short landscape viewports, both themes.
