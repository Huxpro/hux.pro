"use client";

import { Fragment } from "react";
import { MagicLink } from "@/components/magic-link/magic-link";
import { parseInline, resolveInlineTarget } from "@/lib/inline-links";

/**
 * A commit's text with its inline links (lib/inline-links.ts) as magic
 * links: a page peeks its card, a commit or a role its own peek, and a press
 * goes where the thing lives. The plain magic-link dress, the running-text
 * underline, so a name in the sentence reads as a link and nothing more.
 *
 * Each link stops its click: reading a name is not pressing the row the
 * sentence sits on.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, i) =>
        span.kind === "text" ? (
          <Fragment key={i}>{span.text}</Fragment>
        ) : (
          <span key={i} onClick={(e) => e.stopPropagation()}>
            <MagicLink {...resolveInlineTarget(span.target)} title={span.text}>
              {span.text}
            </MagicLink>
          </span>
        ),
      )}
    </>
  );
}
