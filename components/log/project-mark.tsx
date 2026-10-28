/**
 * ProjectMark: the face a project wears.
 *
 * A project row on /works used to wear the package glyph every other project
 * wore, so the gutter said "this is a project" eleven times and never which
 * one. A project is a thing with a name and a face (Lynx has a mark, React
 * has one, Hermes has one), and the About already gives each its official
 * icon on a `<Badge>`. This is that icon on the row, at the row's size: the
 * home-screen icon the site declares (rounded, filling its tile) or a
 * favicon on a white plate, and a monogram in the chapter's colour for a
 * project whose site has none.
 *
 * `BadgeMark` in components/magic-link sets the same icon in `em`, to sit in
 * a sentence; this one is sized by the caller, to sit in a column beside a
 * rail. Two boxes for one face, so the face is resolved once
 * (`commitMark`, components/magic-link/resolve.ts) and only the box differs.
 */

import type { BadgeIcon } from "@/components/magic-link/resolve";
import { cn } from "@/lib/utils";

export function ProjectMark({
  icon,
  className,
}: {
  icon: BadgeIcon;
  /** The box: its size and its corner. */
  className?: string;
}) {
  if (icon.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a glyph-sized icon; next/image would only add a wrapper
      <img
        src={icon.src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          "block shrink-0 select-none overflow-hidden",
          // The plate's inset is in `em`, never `%`: a percentage padding
          // is of the containing block's width, and on a 32px icon in a
          // 300px cell it grew the box to 48px and left no content box for
          // the image to draw in. The caller's font size sets it.
          icon.fill ? "object-cover" : "bg-white object-contain p-[0.12em]",
          className,
        )}
      />
    );
  }
  if (icon.type === "monogram") {
    return (
      <span
        aria-hidden
        className={cn(
          "relative block shrink-0 select-none",
          !icon.color && "bg-foreground/60",
          className,
        )}
        style={icon.color ? { backgroundColor: icon.color } : undefined}
      >
        <span className="absolute inset-0 grid place-items-center font-mono text-[0.6em] font-semibold leading-none text-white">
          {icon.letter}
        </span>
      </span>
    );
  }
  return null;
}
