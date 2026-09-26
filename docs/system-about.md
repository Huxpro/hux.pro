# About

The introduction is a global full-screen surface in `systems/about`, mounted once in the root layout. `/about` is a shareable entry with the home screen underneath. `O` opens or dismisses it over the current page without changing the URL or scroll position. About is also in command search and the slash menu. Location remains searchable, without the old conflicting `O` shortcut.

The first visit opens the introduction. Dismissal persists as `hux_about_dismissed = "1"`; storage failures still allow the surface to close for the current visit. `/about` explicitly opens it even after dismissal. Escape, the close button, and “Come on in” dismiss it. A direct `/about` dismissal replaces the address with `/`.

The native modal dialog places the surface above browser windows and theater surfaces, makes the background inert, traps keyboard focus, and restores focus on dismissal. The title receives initial focus. Command shortcuts dismiss About before opening the palette. Badge launches dismiss it before the existing attachment or app launcher takes focus.

The full-screen transparent WebGL canvas draws a rounded-rectangle distance field. Interfering waves move colored filaments and wider halos around its edge. The canvas only exists while About is open, caps resolution at 1.5 device pixels and animation at 30 fps, pauses in hidden tabs, and renders one still frame for reduced motion. A static CSS rim covers unsupported WebGL or context loss. The surface respects the existing bezel inset and does not change Safari chrome settings.

The blur lives on the dialog itself, while its native backdrop uses the site's glass overlay token. Keep the standard `backdrop-filter` declaration after the prefixed one so CSS optimization retains it for Chromium. Only the copy animates in; the full-screen blur and rim stay fixed. Copy and inline project badges follow both site themes and English/Chinese locale.

See [Badge links](./badge-links.en.mdx) for authoring and live examples of every media kind.
