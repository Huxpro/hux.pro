import type { AppLink, SystemAppId } from "@/lib/app-icon-core";

// =============================================================================
// Built-in apps — the site's own features and pages, as windows
//
// Two kinds, one list each:
//
//   system  — a feature that used to own a surface of its own (the playlist
//             sheet, the wallpaper picker, the theater modal). Its window body
//             is a component registered by the layout (see SystemAppBodies in
//             components/system-app-frame.tsx), rendered in this document so it
//             shares every provider with the page.
//   page    — a route. The fullscreen page, shrunk: a same-origin frame of the
//             route that knows it is one (lib/embed.ts) and so draws no dock,
//             palette or wallpaper of its own. Expanding it navigates the top
//             document there and closes the window.
//
// Both are ordinary `AppLink`s, so everything that already speaks apps — the
// shelf tile, the ⌘K strip, the dock pill, the window menu — speaks these too.
// =============================================================================

export const SYSTEM_APPS: Record<SystemAppId, AppLink> = {
  music: {
    id: "system:music",
    title: "Music",
    titleZh: "音乐",
    url: "/",
    runtime: "system",
    system: "music",
    size: "portrait",
    icon: "/app-icons/system-music.svg",
    keywords: ["music", "playlist", "song", "音乐", "歌单"],
  },
  wallpaper: {
    id: "system:wallpaper",
    title: "Wallpaper",
    titleZh: "壁纸",
    url: "/",
    runtime: "system",
    system: "wallpaper",
    size: "portrait",
    icon: "/app-icons/system-wallpaper.svg",
    keywords: ["wallpaper", "background", "weather", "壁纸", "背景"],
  },
  theater: {
    id: "system:theater",
    title: "Theater",
    titleZh: "影院",
    url: "/works",
    runtime: "system",
    system: "theater",
    size: "landscape",
    icon: "/app-icons/system-theater.svg",
    keywords: ["theater", "video", "talk", "slides", "deck", "影院", "视频", "演讲"],
  },
};

/** The fullscreen sections that can shrink into a window, by first segment. */
const PAGE_SECTIONS: Record<string, Omit<AppLink, "id" | "url" | "runtime">> = {
  writing: {
    title: "Writing",
    titleZh: "文章",
    icon: "/app-icons/page-writing.svg",
    keywords: ["blog", "writing", "posts", "文章", "博客"],
  },
  prompt: {
    title: "Prompt",
    titleZh: "提示",
    icon: "/app-icons/page-prompt.svg",
    keywords: ["prompt", "beliefs", "提示"],
  },
  works: {
    title: "Works",
    titleZh: "作品",
    icon: "/app-icons/page-works.svg",
    keywords: ["works", "projects", "log", "作品"],
  },
};

/** The page apps worth launching from nowhere: each section at its index. */
export const PAGE_APPS: AppLink[] = Object.entries(PAGE_SECTIONS).map(
  ([section, meta]) => pageApp(`/${section}`, meta.title, section),
);

/** Every built-in, in launcher order. */
export const BUILTIN_APPS: AppLink[] = [
  SYSTEM_APPS.music,
  SYSTEM_APPS.wallpaper,
  SYSTEM_APPS.theater,
  ...PAGE_APPS,
];

function sectionOf(path: string): string {
  return path.split(/[?#]/)[0].split("/").filter(Boolean)[0] ?? "";
}

/**
 * The page app for a route. Keyed by section, not by path: shrinking an
 * article while the Writing window is already open sends that window to the
 * article rather than opening a second one — one window per app, as ever.
 * A route outside the known sections still shrinks, titled by its page.
 */
export function pageApp(path: string, title?: string, section = sectionOf(path)): AppLink {
  const meta = PAGE_SECTIONS[section];
  return {
    ...(meta ?? { title: title ?? section }),
    id: `page:/${section}`,
    url: path,
    runtime: "page",
    size: "landscape",
  };
}

/** Whether a route can shrink: anything but the desktop itself. */
export function canShrink(path: string): boolean {
  return sectionOf(path) !== "";
}
