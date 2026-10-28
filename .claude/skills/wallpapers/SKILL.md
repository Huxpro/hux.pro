---
name: wallpapers
description: Adding, replacing or re-encoding a built-in wallpaper on hux.pro. Use when editing the catalog in systems/ambient/lib/wallpaper.ts, files under public/wallpapers/, or public/wallpapers/sources.json.
---

# Wallpapers

1. Record the file's provenance in `public/wallpapers/sources.json`. A light /
   dark pair is marked `"encode": "graphic"` or `"photo"`; a single photograph
   goes under `photos`.
2. `pnpm wallpapers:encode <id>` (with no id it re-encodes every photo and
   every pair marked `encode`). It prints the base colour and dimensions.
3. Add the entry to `BUILT_IN_WALLPAPERS` with `pair(…)` or `photo(…)`,
   pasting what the script printed.
4. `pnpm wallpapers:check`: the catalog, `sources.json` and the files agree,
   and sharpness, size and byte budget hold.
5. `pnpm wallpapers:profile`, and commit
   `systems/ambient/lib/wallpaper-profiles.json`. It drives legibility on that
   wallpaper. CI doesn't check it, so `pnpm wallpapers:profile:check`
   yourself.

Budgets: the full file is the smallest cover of 5120×3200, never upscaled;
a graphic pair past 2MB means something went wrong, photographs get 8MB.

Which half of a pair shows follows the app theme, by design. Bezel and soft
edge come from the wallpaper's family (`WALLPAPER_FAMILY_EDGES`), never per
wallpaper.

More: `docs/wallpapers.md`, `docs/system-legibility.md` (profiles).
