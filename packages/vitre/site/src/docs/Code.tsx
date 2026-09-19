import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";

// =============================================================================
// Highlighted TSX, in the main site's themes. Shiki loads after the page, so
// the code shows as plain text for a moment and the first paint does not wait.
// =============================================================================

let highlighter: Promise<HighlighterCore> | null = null;

function loadHighlighter(): Promise<HighlighterCore> {
  highlighter ??= Promise.all([import("shiki/core"), import("shiki/engine/javascript")]).then(
    ([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        themes: [import("shiki/themes/one-light.mjs"), import("shiki/themes/one-dark-pro.mjs")],
        langs: [import("shiki/langs/tsx.mjs")],
        engine: createJavaScriptRegexEngine(),
      }),
  );
  return highlighter;
}

export function Code({ code }: { code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadHighlighter().then((h) => {
      if (!live) return;
      setHtml(
        h.codeToHtml(code, {
          lang: "tsx",
          themes: { light: "one-light", dark: "one-dark-pro" },
          defaultColor: false,
          transformers: [{ pre: (node) => void (node.properties.class = "docs-code") }],
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [code]);
  if (!html) {
    return (
      <pre className="docs-code">
        <code>{code}</code>
      </pre>
    );
  }
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
