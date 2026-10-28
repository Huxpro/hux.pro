---
skills: [ui-tokens]
---

# Design System

The site's visual language: two voices (Prose and System), three type
families and the roles built from them, a greyscale palette, the page
column, and how a finger presses things. Start here. Two parts have pages of
their own and are only summarised below: the text colour ladder and its
wallpaper behaviour ([Legibility](./system-legibility.md)), and the material
floating surfaces are made of ([Glass](./system-glass.md)). Why the site
looks like an OS at all is [Design Philosophy](./design-philosophy.md);
motion is [Motion](./motion.md).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/design-system/prose-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="An article on a phone: a mono back link, a sans title, a mono meta line, then sans body text with a serif italic talk title, all set straight on the receded wallpaper with no card." />
  <img src="/img/docs/design-system/system-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home screen on a phone: a mono identifier, a large serif greeting, app icons, then glass widget cards with mono labels and a sans list of posts." />
</div>

The same phone, a post on the left (`/writing/avoiding-success-at-all-cost`)
and the home screen on the right. The article is a document: no box, sans for
the structure, the serif only where a work title is emphasised, mono only for
the machine row (`/writing`, `sep 2018 · 6 min`). The home screen is System:
the greeting is serif and set like a title, every card is glass, every label
is lowercase mono. Both are greyscale; the colour is the wallpaper's.
(Headless Chromium; the weather widget's data was stubbed.)

## Two voices

Every piece of UI is either a document or part of the OS. The choice decides
its surface, its type and how it answers a press.

| | Prose | System |
|---|---|---|
| What | Something you read: an article, a doc, the `/writing` list, `/works` rows | Something you operate: the home grid, ⌘K, the Dock, sheets, windows, widgets |
| Surface | None. Text sits on the page (on a receded wallpaper away from `/`) | Glass (`bg-glass…`), border `border-border/50`, `shadow-raised` / `shadow-overlay` |
| Type | `.prose-article` or a role on the `reading-foreground` rung; serif only for emphasis | `TYPE` roles; serif for the poetic title (`TITLE_POETIC`), mono for labels and metadata |
| Selection | Selectable; a long-press on a link previews it | `.system-chrome`, `.system-surface` or `.system-voice` (see [Touch](#touch)) |
| Titles | `TITLE_READER`, selectable | `TITLE_POETIC`, not selectable |

A page can carry both: an index page (`PageLayout`'s `poetic` variant) has a
System header (back link, poetic title in `.system-voice`) over a Prose list.

## Typography

### Fonts

Loaded with `next/font/google` in `app/layout.tsx`, exposed as CSS variables
and mapped to Tailwind families in `app/globals.css`:

| Family | Font | Used for |
|---|---|---|
| `font-sans` (`--font-sans`) | Inter, normal and italic | Structure: titles, rows, body, prose headings. The default on `body` |
| `font-serif` (`--font-serif-latin`, `--font-serif-cjk`, `serif`) | Newsreader (normal and italic), then Noto Serif SC (400 / 700) | Emphasis and voice: poetic titles, the greeting, `em`, blockquotes, a post's dek, `TYPE.voice` / `aside` |
| `font-mono` (`--font-mono`) | JetBrains Mono, normal and italic | The machine layer: labels, dates, tags, nav, kbd, code |

Italics are loaded, not synthesised: a Latin work title (`*The Gay Science*`)
is italic even in a mono row, and a slanted Inter is a sheared roman, not
Inter Italic. Chinese has no italic: Noto Serif SC is loaded without one, and
Chinese emphasis is the serif set upright (`.prose-article[lang="zh"] em`,
`TYPE.dek`'s `[&:lang(zh)]:not-italic`). Newsreader's x-height is smaller
than Inter's, so Latin serif set beside sans is nudged up 6.25 %
(`1.0625em` on `em` and blockquotes, 15px for `TYPE.voice`); Chinese takes no
correction.

**Sans for structure, serif for emphasis, mono for the machine.** That is the
whole contract between the families: serif is somebody's thinking, sans and
mono are the system talking about it.

### Roles

Recurring text recipes are named once in `lib/typography.ts` (`TYPE`): a
size, a family, a tracking and a rung of the ink ladder in one class string.
Components compose a role with their own layout classes; the Legibility Lab
composes the same string into its specimens, so the two cannot drift.

![A grid with the five text rungs as rows (foreground, reading-foreground, muted-foreground, tertiary-foreground, quaternary-foreground) and the three families as columns. Each cell lists the TYPE roles on that rung in that family with their size: rowTitle, rowHeading, mediaTitle, TITLE_READER and prose headings on foreground sans; TITLE_POETIC and dek on foreground serif; reading and .prose-article on reading sans; voice and prose em on reading serif; body, message, caption, appLabel on secondary sans; label, meta, identifier, nav, kbd on secondary mono; captionQuiet, aside, rowMeta, labelSm on tertiary; hash alone on quaternary mono.](/img/docs/design-system/type-roles.svg)

Every role, placed by rung (row) and family (column). Mono never goes above
secondary and only `hash` sits on quaternary; the serif never labels
anything. Mono metadata sits on two rungs by one rule: beside a title it
annotates (`rowMeta`, tertiary), standing alone it is the information
(`meta`, secondary).

- Use a role where one fits. Where none does, write the classes inline; when
  the recipe recurs, promote it to `TYPE`, not the other way round.
- Labels are set as written, in lowercase mono (`writing`, `jul 2020`,
  `retry`), never `uppercase tracking-wider`. A proper name keeps its case.
- Mono UI is `text-xs` everywhere (`labelSm`, 10px, is the dense exception
  for caption strips and tag rows). Idle on its rung, `text-foreground` on
  hover. The family already marks the layer; no size or weight hierarchy
  inside it.
- Which rung a piece of text takes, and the per-role "where" table:
  [Legibility, Typography roles](./system-legibility.md).

### Titles

Two constants in `components/ui/header-zone.tsx`, one per voice. Callers add
`text-foreground`.

| Constant | Classes | Where |
|---|---|---|
| `TITLE_POETIC` | `font-serif text-3xl sm:text-4xl tracking-tight system-voice cursor-default` | The greeting, every index page's title (Writing, Docs, …). System voice: not selectable. No subtitle under it |
| `TITLE_READER` | `font-sans text-xl sm:text-2xl font-medium leading-tight` | An article's title. Content: selectable. Inside `.reader-masthead` it scales with the reader's type size (1.25× / 1.5× `--reading-size`) |

### Prose

`.prose-article` (`app/globals.css`) sets MDX content, after
[paco.me](https://paco.me) and [ibelick.com](https://ibelick.com): sans
throughout, headings de-weighted rather than enlarged, serif only for
emphasis.

![The typography test document on a desk: a mono back link and meta line, a medium sans title, sans body text, a medium sans h2, smaller sans h3s, and one phrase in Newsreader italic inside a sans sentence.](/img/docs/design-system/type-specimen.png)

`/docs/typography-test/en`, light theme. The headings are the same family
and weight as each other and only a step larger than the body; what lifts
them is the ink (body is 85 %, headings 100 %). The one serif on screen is
the italic phrase.

| Element | Spec |
|---|---|
| Body | `--reading-size` (16px; 15px / 18px with `data-reading-size="small"` / `"large"` on `<html>`), line-height 1.75, `text-reading-foreground` |
| `h1` / `h2` / `h3` | Sans medium, `text-foreground`, 1.25em / 1.125em / 1em. Not uppercase |
| `em` | Serif italic; 1.0625em in Latin; upright in Chinese |
| `strong` | Inter semibold |
| Blockquote | Serif italic, `text-foreground/70`, no border; a hanging `“` in `--muted-foreground` |
| Links (`.prose-article a`, `.prose-link`) | `text-foreground`, underline in `decoration-ink-line`; on a hover-capable pointer the line goes to `--foreground` |
| Lists | Markers drawn in `::before` in `--muted-foreground` (`•`, or the counter) |
| Inline code | `font-mono`, 0.875em, `bg-muted`, `rounded` |
| Code block | `bg-muted/50`, `border-border`, `rounded-lg`; token colours from Shiki's light / dark themes, background from the site |
| Table | Header `bg-muted/50`, row hover `bg-muted/30` |
| Figure caption | Centred, 0.875em, `text-muted-foreground` |

Every size in an article is an `em` of `--reading-size`, and every block
margin a multiple of it (paragraph 1.5×, `h2` 4× above, list item 0.5×), so
the reader's size setting moves the whole composition. A component embedded
in prose opts out with `.not-prose`.

### Home screen

| Element | Spec |
|---|---|
| System identifier (`λhux`) | `TYPE.identifier`: mono `text-xs` `tracking-wider`, secondary |
| Greeting | `TITLE_POETIC` |
| Context line ("Last read *…*") | `text-sm sm:text-base`; sans on secondary, the title in serif italic `text-foreground` |
| Widget titles | `TYPE.label` |
| App labels | `TYPE.appLabel` (11px, secondary) |

## Colour

The palette is greyscale, in OKLCH. The content brings the colour: a
wallpaper, a cover, a photograph. No accent colour; don't introduce one.
The two hues that exist carry a meaning, not a brand: red for an error or a
destructive action (`--destructive`, below) and green for "live" (the
devtool's switches, `WidgetStatus`'s dot).

**Text and washes are the ink at an alpha.** One `--ink` per theme
(`oklch(0.145 0 0)` light, `oklch(0.93 0 0)` dark), and every text and wash
token is a percentage of it, so the same token composites over white, over
glass, over a picture. Text picks one of five rungs: `text-foreground`,
`text-reading-foreground` (running text, 85 %), `text-muted-foreground`
(54 / 60 %), `text-tertiary-foreground` (32 / 36 %) and
`text-quaternary-foreground` (20 / 22 %, separators and other decoration).
Washes are `bg-muted` (4 / 6 %), `bg-accent` (7 / 10 %) and `border-border`
(9 / 10 %). Never `text-*/NN` (pick the rung) and never
`decoration-*/NN` (use `decoration-ink-line`). The full ladder, the
wallpaper boost, relief, the flipped `.ink-bare` zones and the lab that
tunes them: [Legibility](./system-legibility.md).

**Tint is never on ink.** The one exception to greyscale is opt-in: **Tint:
Wallpaper** (`data-tint="wallpaper"` on `<html>`) mixes the picture's
dominant colour into the glass base (`--tint-glass`, 14 %) and the accent
wash and focus ring (`--tint-accent`, 28 %). Text stays neutral.

**Floating surfaces are glass.** Widgets, the palette, sheets, windows and
capsules paint with `bg-glass`, `-strong`, `-overlay`, `-sheet` or `-popover`
(or `GLASS_PANEL` / `GLASS_CAPSULE` from `lib/glass.ts`), so one setting,
Tinted or Clear, restyles all of them. `bg-card/NN` and `bg-popover/NN` are a
lint error outside `lib/glass.ts`. Which token goes on which surface:
[Glass](./system-glass.md).

The remaining inputs are the page and the solid surfaces the glass is mixed
from:

| Variable | Light | Dark |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.2178 0 0)` (#1a1a1a, after [paco.me](https://paco.me)) |
| `--card` | `oklch(1 0 0)` | `oklch(0.19 0 0)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |

Opaque `bg-card` / `bg-popover` (no modifier) is for what is not floating
glass: menus from `components/ui`, a pressed pill's solid state.
`--destructive` (`oklch(0.58 0.22 27)` / `oklch(0.704 0.191 22.216)`) is the
one hue among the tokens, for an error or a destructive action: a failed
voice request, a bad bundle URL, a destructive row in a phone sheet's menu.
`--primary`, `--chart-*` and `--sidebar-*` are shadcn's literal values,
used by `components/ui`.

Elevation is two shadows (`@theme` in `globals.css`): `shadow-raised` for
resting floating controls and hover peeks, `shadow-overlay` for the palette,
an expanded Live Activity, the devtool. Black in both themes; in dark mode
the border does most of the separating.

## Spacing and layout

- **The column.** `--page-col: 680px` with `--page-gutter: 1.5rem`
  (`PageLayout`, `components/ui/page-layout.tsx`). On an article the reader
  can pick 600 / 680 / 760px (`data-reading-measure`), only where all three
  fit (`measure:`, ≥ 760px).
- **Page padding.** `pt-16 sm:pt-24 pb-32 sm:pb-40`, the same on content
  pages and the home screen.
- **The header.** Index pages and the home screen start content at the same
  height: `HeaderZone` is `h-44 sm:h-48`, the nav in a fixed `h-11` slot, the
  title centred in the rest.
- **Prose rhythm.** In multiples of `--reading-size` (see [Prose](#prose)).

### Home screen grid

The home screen is a *composition*, not a document: identifier → greeting →
widget grid. Two rules keep it at home on any display (`app/home-view.tsx`,
`components/ui/sortable-masonry.tsx`):

- **Centred when there is room.** `main` is `min-h-svh` and the composition
  carries auto margins, so it settles optically centred on tall screens
  (iPad Pro portrait, large desktops) and snaps back to the top-anchored
  layout the moment the content outgrows the viewport. Phones, tablets and
  normal laptops are unchanged.
- **More widgets, not bigger ones.** Column count and container width move
  together so a widget stays ~330px wide at every step, iPad-springboard
  style (`gridScale`):

  | Breakpoint | Columns | Container |
  |---|---|---|
  | — | 1 | 680px |
  | `sm` | 2 | 680px |
  | `lg` | 3 | 1024px |
  | `roomy` | 3 (4 with ≥ 8 widgets) | 1152px (1344px) |

  The fourth column waits for enough widgets to fill it: CSS multicol
  balances by height, so a fourth column over a handful of cards reads as a
  lopsided, half-empty grid. `roomy:` (defined in `globals.css`) is the last
  step's gate: ≥ 96rem wide **and** ≥ 1000px tall, since the point is to
  spend space the screen actually has spare; a short ultrawide is already
  scrolling and keeps the familiar desktop board.

## Touch

Touch gets the iOS contract, not a mouse's. Tailwind's `hover:` is gated on
`(hover: hover)`, so a finger never sees a hover wash; without an `active:`
state a tap on a row gives no feedback at all. The classes in `globals.css`
carry the chrome policies; cover press lives with the artwork tokens
(`COVER_WASH` in `lib/glass.ts`). Nothing is inferred from the pointer type
at runtime.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/design-system/row-rest.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Writing index on a phone at rest: a serif title, EN / All chips, and a list of post titles with mono dates, no row highlighted." />
  <img src="/img/docs/design-system/row-press.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same list with the third row pressed: a soft rounded wash behind 'React Is Not Vue, Obviously' and its date." />
</div>

`/writing` on a phone, at rest and with a row pressed (`:active` forced in
headless Chromium). The row is `pressable … hover:bg-muted/50
active:bg-muted/60`: the wash on the right is what a finger gets on the
touch-down frame, and the only feedback it gets.

| Class | Where | What it does |
|---|---|---|
| `pressable` | Rows, links, buttons, tiles: anything with a `hover:` wash | Pair with an `active:` colour (or, on chrome buttons, a scale). The `:active` rule zeroes the transition so the highlight lands on the **touch-down frame**; release eases out through the element's own `transition-*`. Also drops the grey tap flash and the double-tap zoom delay |
| `COVER_WASH` | Media covers: talks thumbs, `/works` tiles, inline players (`lib/glass.ts`) | iOS Photos / Music / Home Screen: a dark wash over the **art** on touch-down, not a scale of the card. The control is `group/thumb pressable` so a press on a sibling cover or the commit row cannot dim every thumbnail |
| `widget-surface` | A tappable widget's own surface (`WidgetShell`) | The iOS tap wash (the ink at 8 %) for presses on the card itself; a pressed descendant with its own action (link, button, tab, field) is excluded via `:has()`. Mirrors `OWN_ACTION_SELECTORS` in `components/ui/widget-surface.ts` |
| `system-chrome` | Navigation, command bar, dock, palette, edit controls, a window's frame, every surface (`SHELL`) | OS chrome: no text selection, no long-press callout, no grey tap flash. Text fields inside keep their caret |
| `system-surface` | The home screen, the 404 | The whole OS composition is non-selectable, descendants included. iOS otherwise skips `select-none` labels and expands a long-press into a full-page Copy / Find Selection. Paired with `useLockTextSelection` |
| `system-voice` | Poetic titles, the widget grid, app labels (System text inside a page that is otherwise a document) | Selection off, everything else untouched, so a link keeps its preview and its tap flash. Text fields inside keep their caret |
| `press-hold` | Widgets and app icons (via `usePressHold`) | The visual half of a long-press: the held object grows slowly for the sensor's whole activation delay, then pops to its lifted size (`widget-lift`). Letting go or scrolling eases it back |

### Four voices: chrome, surface, voice, document

A piece of UI picks one. The three classes live in `globals.css` rather than
as Tailwind utilities at the call sites, so the policies can be read side by
side, and so all three carry the text-field exception: `user-select: none`
inherited into an `<input>` costs Safari the caret, and a `select-none` in a
class string has no way to say otherwise.

- **Chrome** (`.system-chrome`): not selectable, no callout, no tap flash.
  Navigation, the command bar, the dock, edit controls, a window's own
  frame, and every secondary surface (see
  [Surface System](./system-surface.md#a-surface-is-chrome)).
- **Surface** (`.system-surface`): a whole composition that is not a document,
  such as the home screen or the 404. A long-press must not grow into a
  viewport-wide selection, which iOS will do even over `select-none` labels;
  `useLockTextSelection` is the JS half. Text fields inside still take a caret.
- **Voice** (`.system-voice`): selection off, nothing else. Poetic index
  titles (`TITLE_POETIC`), the widget grid, app labels: the OS speaking inside
  a page that is otherwise a document. Dragging across them must not paint a
  highlight, but a link inside still previews and still flashes. Pair it with
  `cursor-default` where the arrow should say so too. Never put it on an
  element inside a link or button, where a cursor set on the text beats the
  pointer the control would have lent it.
- **Document** (no class): prose, article titles via `TITLE_READER`, the
  `/writing` list, `/works` rows. Browser defaults: text stays selectable, and
  a long-press on a link still opens the system preview. Only the press wash
  is added.

A drag is the one case that cuts across all four. While something is being
dragged (a window by its frame, a widget in edit mode), `html.dragging`
suspends selection on the whole page, so the document under the dragged object
is never highlighted by a gesture that was not about its text. It is a
temporary state on top of the four voices: when the drag ends, the page is a
document again.

The cost, taken knowingly: what cannot be selected also cannot be handed to
iOS Translate or Speak Selection. It applies to System text only (greetings,
index titles, widget cards, labels), never to an article's body or its own
title, and the one article title that speaks in the System voice (the
greeting's "last reading" line) is a link to the page where it is selectable
again.

### Long-press

- **App icons / widgets**: a long-press picks the object up (400ms hold,
  10px tolerance, `TOUCH_ACTIVATION` in `components/ui/sortable-order.ts`).
  No system callout, no selection. Strictly: a press only *starts* a pickup
  on the widget's own surface, the part whose tap is the whole-widget
  action. A press on a descendant with its own tap (a row link, a button, a
  tab, an input) belongs to that control: it scrolls, previews, or presses,
  and never lifts the card. In edit mode the whole card is a handle again,
  like an iOS jiggle.
- **Content** (prose, the `/writing` list, `/works` rows): browser defaults.
  A long-press on a link still opens the system preview; text stays
  selectable.
- **System chrome**: not selectable, no callout.

While the home grid is in edit mode the **Done** / **Reset** controls float
above the command bar on desktop; on phones the bar fades out
(`components/ui/home-edit-store.ts`) and the controls take the bottom of the
screen, where the thumb is. They use the same pill as the rest of the
chrome, with no inverted fills.

## Motion

Functional, not expressive: motion indicates focus, a transition or a change
of state, using opacity, transform, blur and a subtle scale. If motion
doesn't explain something, remove it. Patterns and the curves:
[Motion](./motion.md).

## Components

### Chips and segmented controls

`components/ui/controls.tsx` holds the site's settings widgets; what differs
between uses is the voice of the surface, so that is the one parameter.

- **`HeaderAction`**: the chip for "something you can do to this page" (the
  `/writing` language filter, an article header's language and `Aa`
  actions). `pressable` mono `text-xs`, `rounded px-2 py-1`. Chosen:
  `bg-muted text-foreground`. A `segment` at rest is
  `text-tertiary-foreground hover:text-foreground`; an `action` keeps its
  row's ink and paints `hover:bg-muted/60`.
- **`Segmented`** / **`Switch`**, in three tones: `system` (the devtool:
  mono uppercase 10px, a hairline box, green for on), `reader` (sans,
  an inset `bg-muted` track with a raised `bg-background` thumb, greyscale)
  and `bare` (no track, the chosen glyph on `bg-muted`; pickers only).

### Keyboard hints

`TYPE.kbd`: `rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs
text-muted-foreground`, as in the palette's results.

### Links

- **In prose**: persistent underline in `decoration-ink-line` (see
  [Prose](#prose)). `.prose-link` gives a magic link outside an article the
  same treatment.
- **Back links**: `SystemNav`, below.

### SystemNav

Every back link (to home, to the writing list, to docs) is
`components/ui/system-nav.tsx`:

- `TYPE.nav` (mono `text-xs tracking-wide`, secondary, `text-foreground` on
  hover), plus `system-chrome pressable`, a 44px minimum touch target that
  does not move the text, and `active:bg-foreground/5 active:scale-[0.98]`.
- **Path first**: shows the destination (`λhux` for home, `/writing`,
  `/docs`), and on hover scrambles to `cd ..` (or `hoverText`). The click
  navigates at once; it never waits for the animation.

```tsx
import { SystemNav } from "@/components/ui/system-nav";

<SystemNav href="/" path="λhux" />
<SystemNav href="/writing" path="/writing" />
<SystemNav href="/docs" path="/docs" hoverText="cd ~/docs" />
```

`PageLayout` places it; a page rarely mounts one itself.

### Widgets

The home screen's cards are `WidgetShell` (`components/ui/widget.tsx`):

```
group/widget relative rounded-2xl overflow-hidden
border border-border/50 transition-all duration-300
bg-glass backdrop-blur-xl hover:border-border hover:bg-glass-hover
```

When the wallpaper is painted into the widgets (`widgetEnabled`), the card
drops its glass for `bg-transparent backdrop-blur-sm hover:bg-ink/5` over its
own copy of the wallpaper. A card with `href` or `onOpen` is tappable and
takes `widget-surface` (see [Touch](#touch)).

`WidgetHeader` is `px-5 pt-5 pb-4`, `WidgetTitle` is `TYPE.label`,
`WidgetBody` is `px-5 pb-5`. The header arrow and a strip's pager dots are
revealed with the card (`WIDGET_REVEAL`): hover or focus inside the card
shows them, a finger never sees them. The card is the tap target and the
peek of the next cover says a strip scrolls, so at rest they only repeated
it.

## Checklist for a visible change

1. Prose or System? A System surface paints with a glass token and picks
   `.system-chrome`, `.system-surface` or `.system-voice`; Prose gets
   neither.
2. Text: a `TYPE` role, or a rung (`text-foreground`,
   `-reading-foreground`, `-muted-foreground`, `-tertiary-foreground`,
   `-quaternary-foreground`). No `text-*/NN`, no fixed greys.
3. Underline: `decoration-ink-line`.
4. Family: serif only for emphasis and poetic titles; mono for the machine
   layer, `text-xs`, lowercase as written.
5. Anything with a `hover:` wash also has `pressable` and an `active:`
   state. Look at it in phone emulation.
6. No new colour; tint never on text.
7. `pnpm lint`.
