import type { OsTheme } from "./types";

/**
 * Hux — the site as it was built: Apple's vocabulary in the site's own voice.
 * Liquid Glass surfaces (Tinted / Clear), the mono/serif type, iOS's press
 * wash and jiggle mode. Its visual source of truth is the site's stylesheet
 * itself; nothing overlays it.
 */
export const hux: OsTheme = {
  id: "hux",
  label: "osThemeHux",
  metadata: {
    platform: "apple",
    pressFeedback: "wash",
    editMode: "jiggle",
    layoutMotion: "tween",
    haptics: false,
    dynamicColor: false,
    openPage: "crossfade",
    materialSetting: "glass",
  },
};
