import type { AppLink } from "@/lib/app-icon-core";

/**
 * Built-in apps — the site's own surfaces, opened in the same window chrome
 * as an external app. They are not in `content/apps.json`: that catalog is
 * crawled for icons, and these have no remote origin to crawl.
 *
 * `featured: false` keeps them out of the home-screen folder (that folder is
 * other people's apps). They lead the ⌘K strip, and a fullscreen page of the
 * same app can shrink into one of these windows.
 */
export const BUILTIN_APPS: AppLink[] = [
  {
    id: "watch",
    title: "Watch",
    titleZh: "观看",
    runtime: "native",
    surface: "watch",
    url: "/works",
    size: "landscape",
    featured: false,
    keywords: ["video", "slides", "theater", "watch", "视频", "幻灯", "观看"],
  },
  {
    id: "music",
    title: "Music",
    titleZh: "音乐",
    runtime: "native",
    surface: "music",
    url: "/",
    size: "portrait",
    featured: false,
    keywords: ["music", "playlist", "now playing", "音乐", "播放"],
  },
  {
    id: "wallpaper",
    title: "Wallpaper",
    titleZh: "壁纸",
    runtime: "native",
    surface: "wallpaper",
    url: "/",
    size: "landscape",
    featured: false,
    keywords: ["wallpaper", "background", "壁纸", "背景"],
  },
  {
    id: "writing",
    title: "Writing",
    titleZh: "文字",
    runtime: "native",
    surface: "writing",
    url: "/writing",
    size: "portrait",
    featured: false,
    keywords: ["blog", "writing", "posts", "文字", "博客"],
  },
  {
    id: "prompt",
    title: "Prompt",
    titleZh: "提示",
    runtime: "native",
    surface: "prompt",
    url: "/prompt",
    size: "portrait",
    featured: false,
    keywords: ["prompt", "prompts", "principles", "提示", "原则"],
  },
];

export const BUILTIN_APPS_BY_ID = new Map(BUILTIN_APPS.map((app) => [app.id, app]));

export function builtinApp(id: string): AppLink | undefined {
  return BUILTIN_APPS_BY_ID.get(id);
}
