# About

The introduction, floating over whatever page is already open.

```
systems/about/
├── provider.tsx                      # AboutProvider, useAbout() — seen once, then O
├── lib/glow.ts                       # the screen-edge shader
└── components/
    ├── glow-border.tsx               # WebGL canvas, CSS wash when WebGL2 is missing
    └── about-overlay.tsx             # blur, prose, project badges
```

## Who sees it

A visitor with no `hux_about_seen` in localStorage gets the overlay on the
first paint after hydration. Dismissing — Continue, Escape, or a press on the
blurred page — writes the flag. `O` opens it again from anywhere the keyboard
is not in a field and the command palette is closed. Inside slash mode, `O`
is the same command. Location, which used to own that letter, is `C`.

## The light

The border is a fragment shader on a full-viewport canvas. Colour travels
around the bezel: a soft band, plus a few brighter beams moving the other
way. The centre of the frame is left clear. `prefers-reduced-motion` holds
the beams still. Without WebGL2 the same edge is a static conic wash.

## Badge

`<Badge>` (and `<BadgeLink>`) is an MDX component. It is a chip — icon and
name — and a plain click opens the chip through the attachment policy's
native home:

| `kind` | where it opens |
|---|---|
| `link` (the default; a video host is read as a recording) | in-app browser, a tab when the page refuses framing, the router for a site path |
| `video` | theater |
| `slides` | theater |
| `image`, `social` | attachment surface |

```mdx
<Badge href="https://lynxjs.org" icon="globe">Lynx</Badge>
<Badge kind="video" platform="bilibili" href="https://www.bilibili.com/video/BV1LY411Q7hC/">COSCon</Badge>
<Badge kind="slides" href="https://huxpro.github.io/jsconfcn2017/">JSConf</Badge>
```

A modified click keeps the real `href`.
