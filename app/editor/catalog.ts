/**
 * The hidden `/editor` family — authoring surfaces and labs.
 *
 * This used to be one page: a WYSIWYG editor for `content/log.json`. It is
 * now a small set of pages that share a prefix, a dropdown, and the `e`
 * slash letter. The name "editor" is slightly wrong for most of them
 * (they are labs, not editors) and still right for the door:
 *
 *   - `/editor` itself is an editor. `e` lands there.
 *   - The others are readouts of a system (attachments, legibility, icon,
 *     theater chrome). Calling the family "labs" would be more accurate
 *     and would collide with Language (`l`) as a letter.
 *   - Routes stay under `/editor`. Bookmarks, docs, and the slash letter
 *     are muscle memory; renaming the URL is not worth it.
 *   - The dropdown is how you move between them. The slash list stays
 *     a lettered launcher, so `e` does not grow a submenu, and the
 *     palette does not list the labs.
 */

export type EditorId =
  | "log"
  | "attachments"
  | "icon"
  | "legibility"
  | "glow"
  | "theater";

export interface EditorEntry {
  id: EditorId;
  href: string;
  /** Mono title in the toolbar / dropdown. */
  title: string;
  /** One-line what it is. */
  hint: string;
}

export const EDITORS: readonly EditorEntry[] = [
  {
    id: "log",
    href: "/editor",
    title: "log.json",
    hint: "Works timeline, as it prints",
  },
  {
    id: "attachments",
    href: "/editor/attachments",
    title: "attachments",
    hint: "Every media render path",
  },
  {
    id: "icon",
    href: "/editor/icon",
    title: "icon.json",
    hint: "App icon studio",
  },
  {
    id: "legibility",
    href: "/editor/legibility",
    title: "legibility",
    hint: "Ink, glass, wallpaper",
  },
  {
    id: "glow",
    href: "/editor/glow",
    title: "glow",
    hint: "The one light, at every scale",
    label: "Glow lab",
  },
  {
    id: "theater",
    href: "/editor/theater-variants",
    title: "theater",
    hint: "Fullscreen chrome variants",
  },
];

export function editorFromPath(pathname: string): EditorEntry {
  const exact = EDITORS.find((e) => e.href === pathname);
  if (exact) return exact;
  // `/editor/attachment` (singular) and any nested lab path.
  if (pathname.startsWith("/editor/attachment")) {
    return EDITORS.find((e) => e.id === "attachments")!;
  }
  if (pathname.startsWith("/editor/icon")) {
    return EDITORS.find((e) => e.id === "icon")!;
  }
  if (pathname.startsWith("/editor/legibility")) {
    return EDITORS.find((e) => e.id === "legibility")!;
  }
  if (pathname.startsWith("/editor/glow")) {
    return EDITORS.find((e) => e.id === "glow")!;
  }
  if (pathname.startsWith("/editor/theater")) {
    return EDITORS.find((e) => e.id === "theater")!;
  }
  return EDITORS[0];
}
