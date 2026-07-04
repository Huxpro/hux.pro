"use client";

import { useEffect } from "react";
import { useOptionalDevtool, type DevtoolPageMeta as PageMeta } from "./provider";

/**
 * DevtoolPageMeta — a render-nothing bridge that publishes the current route's
 * frontmatter into the devtool context so the panel's inspector can show it.
 *
 * Rendered by page components (e.g. a blog post page) with the verbatim
 * frontmatter for the locale being viewed. Registers on mount / prop change
 * and clears on unmount, so navigating away from a post empties the inspector.
 *
 * Uses the *optional* devtool hook so it's a no-op if ever rendered outside the
 * provider — it must never throw from inside page content.
 */
export function DevtoolPageMeta({ slug, lang, language, frontmatter }: PageMeta) {
  const devtool = useOptionalDevtool();
  const setPageMeta = devtool?.setPageMeta;

  // slug + lang identify exactly one source file, so they fully determine
  // `frontmatter` — no need to serialize the object to detect changes. Keying on
  // the primitives (vs the fresh-every-render object identity) also avoids
  // walking the frontmatter on every render for every visitor.
  const key = `${slug}|${lang}|${language ?? ""}`;

  useEffect(() => {
    if (!setPageMeta) return;
    setPageMeta({ slug, lang, language, frontmatter });
    return () => setPageMeta(null);
    // `key` stands in for slug/lang/language/frontmatter; re-run only when it
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setPageMeta]);

  return null;
}
