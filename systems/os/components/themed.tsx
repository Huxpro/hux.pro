import type { ReactNode } from "react";

// =============================================================================
// Themed — a slot whose DOM differs by theme.
//
// Most differences between themes are the stylesheet's (tokens, the
// `android:` / `hux:` variants). Where the *structure* differs — a spinner
// that is a ring in one theme and a morphing shape in the other, a section
// only one theme has — both forms are rendered and the stylesheet shows the
// one for the theme on <html>. Nothing reads the theme in React to choose, so
// a returning visitor gets the right form on the first frame, with no second
// render and no hydration mismatch, and a switch is a stylesheet change.
//
// The wrappers are `display: contents` while shown, so they add no box: a
// flex or grid parent lays the children out as if the wrapper were not
// there. With no theme on <html> at all (no script), the Hux form shows —
// the site as built.
//
// Where a whole subtree costs something to keep mounted in the theme that
// hides it (a live animation, a network read), gate it on the theme's
// metadata in React instead (`useOsTheme().meta`).
// =============================================================================

export function Themed({ hux, android }: { hux?: ReactNode; android?: ReactNode }) {
  return (
    <>
      {hux !== undefined && <span data-themed="hux" className="contents android:hidden">{hux}</span>}
      {android !== undefined && (
        <span data-themed="android" className="hidden android:contents">
          {android}
        </span>
      )}
    </>
  );
}
