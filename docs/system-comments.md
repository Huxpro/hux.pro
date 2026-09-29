# Comments

What readers say under a post, kept where the code is.

```
lib/comments.ts                 # GISCUS config, commentTermFor(slug), giscusThemeUrl()
components/post/comments.tsx    # <Comments term> — the frame, the protocol, the session
public/giscus/
├── base.css                    # the widget in the site's ink (structure, both themes)
├── light.css                   # light inputs, imports base.css
└── dark.css                    # dark inputs, imports base.css
giscus.json                     # which sites may embed this repo's discussions
```

## Why giscus

The site is static with no API routes, so a comment system has to be someone
else's server. Of the GitHub-backed ones:

| | Backed by | Threads / replies | Reactions | Secret in the browser | State |
|---|---|---|---|---|---|
| **giscus** | Discussions | yes | yes | no (GitHub App) | maintained |
| utterances | Issues | no | no | no | quiet since 2022 |
| Gitalk | Issues | no | no | OAuth client secret | quiet |

giscus keeps each post's conversation as a Discussion in `huxpro/hux.pro`,
readers sign in with the GitHub account they already have, and there is no
tracker, no ad and no database of ours. A reader who would rather not
authorize the app can comment on GitHub itself — the count above the thread
links to the Discussion.

## One thread per post

`commentTermFor(slug)` is `writing/<slug>`: the Discussion is keyed by the
slug, not the path, so `/writing/foo/en` and `/writing/foo/zh` are one
conversation. `strict` matching finds it by a hash of that title, so
`writing/react` can never land in `writing/react-native`. The first comment
or reaction creates it (giscus does, in the `Comments` category).

## The frame is ours

`<Comments>` is giscus's `client.js`, kept to what a React page needs:

- **Lazy.** Nothing loads until the reader is within 1200px of the end of the
  post (an `IntersectionObserver`; a frame that starts at zero height cannot
  use `loading="lazy"`, browsers load hidden frames eagerly).
- **Sized by the widget.** giscus reports `resizeHeight`; the frame never
  scrolls. Until the first report, a mono `loading comments…` holds the place.
- **Themed by the theme service,** not the OS: the stylesheet URL is built
  from `useTheme()`, and a later change is sent as `setConfig` — never as a
  new `src`, which would reload the thread. The frame's `color-scheme` is set
  to the same theme, or the browser would paint it an opaque canvas.
- **The session** is giscus's: sign-in redirects back with `?giscus=<session>`
  and `#comments`; it is moved to `localStorage["giscus-session"]` (the key
  `client.js` uses) on mount, and dropped on sign-out or a stale credential.
- **Language** follows the UI locale (`en` / `zh-CN`), like the rest of the
  chrome — not the post's.
- **Off until configured.** With no `categoryId` the component renders
  nothing.

## The look

The widget is giscus's page inside an iframe, so nothing from `globals.css`
reaches it. `public/giscus/*.css` restate the ladder there
([system-legibility.md](./system-legibility.md)): one ink per theme, every
text colour and wash an alpha of it, the frame transparent so the page or the
wallpaper shows through. Keep `light.css` / `dark.css` in step with the
`:root` / `.dark` inputs in `globals.css`.

- **No boxes.** Comments are separated by a hairline, not carded; replies hang
  off a 1px thread line.
- **Mono is the machine layer:** counts, times, `owner`, the Markdown hint.
  Names and text are Inter; emphasis in a comment is the Newsreader italic,
  as in the article (upright in Chinese).
- **Controls are the reader's:** Oldest / Newest and Write / Preview are the
  inset-track segmented control; reactions are pills on the muted wash; the
  one filled control — Comment, Sign in with GitHub — is the ink.
- **Links are the ink,** underlined at `--ink-line` in text, bare in chrome.
  No blue anywhere; syntax colours in code are GitHub's (the content brings
  the colour).
- On a phone the text takes the full measure instead of hanging under the
  name, and the field is 16px so iOS does not zoom into it.

Every rule is scoped under `#__next`: giscus builds Tailwind with
`important: "#__next"`, so a utility on the same element outranks a bare
class selector. giscus loads the stylesheet with `crossorigin="anonymous"`;
`next.config.ts` serves `/giscus/*` with `Access-Control-Allow-Origin: *`.

To look at a change, open any post locally — `localhost` is allowed by
`giscus.json` — with `NEXT_PUBLIC_GISCUS_CATEGORY_ID` set.

## Setup (once, on GitHub)

1. Repository **Settings → General → Features → Discussions**: on.
2. Install the giscus app on `huxpro/hux.pro`: [github.com/apps/giscus](https://github.com/apps/giscus).
3. **Discussions → categories → New category** `Comments`, format
   **Announcement** (only maintainers and giscus open threads; anyone replies).
4. Its id: `https://giscus.app/api/discussions/categories?repo=huxpro/hux.pro`
   → `categories[].id` for `Comments`. Put it in `GISCUS.categoryId`
   (`lib/comments.ts`), or set `NEXT_PUBLIC_GISCUS_CATEGORY_ID` on the
   deployment.

`giscus.json` at the repository root limits embedding to `hux.pro` and
`localhost`; add a preview domain there if previews should show comments.
