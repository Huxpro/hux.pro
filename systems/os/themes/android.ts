import type { OsTheme } from "./types";

/**
 * Android — Material 3 Expressive, as Android 16 draws it. Opaque tonal
 * surfaces coloured from the wallpaper, Google Sans Flex, Compose's ripple,
 * the resize frame, springs, the container transform. Its visual source of
 * truth is the overlay in app/themes/android/, every rule of which is scoped
 * to `:root[data-os-theme="android"]`.
 */
export const android: OsTheme = {
  id: "android",
  label: "osThemeAndroid",
  metadata: {
    platform: "android",
    pressFeedback: "ripple",
    editMode: "frame",
    layoutMotion: "spring",
    haptics: true,
    dynamicColor: true,
    openPage: "container-transform",
    materialSetting: "wallpaper-colors",
  },
};
