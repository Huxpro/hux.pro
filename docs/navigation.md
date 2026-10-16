# Navigation

How a visitor moves between pages. There is no nav bar. The floating
button and ⌘K reach every section from anywhere. The back link at the top
of a content page goes up one level. Content links go everywhere else. Every
move between pages is a View Transition: the page crossfades and the `λhux`
mark slides to its new place. The palette and the floating button are
[Command System](./system-command.md); this page is everything around them.

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/navigation/home-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home page on a desk: the small λhux mark centred above the greeting, the widget grid, the search bar at the bottom centre with the Ask ball to its right." />
  <img src="/img/docs/navigation/writing-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Writing page on a desk: the λhux mark at the top left of the column above the Writing title, the post list, and the round Ask ball and the ⌘ K pill in the bottom right corner." />
</div>

1280×860, home and `/writing`. The same `λhux` sits centred on the home and
at the top left of the column on a content page. It is the one element that
moves between them; everything else crossfades. On the content page it is
also the way back (`cd ..` on hover). The search bar becomes the ⌘ K pill in
the corner, and the Ask ball slides from its right side to its left.

## How it works

### Routes

| Route | Page | Shell | Back link |
|-------|------|-------|-----------|
| `/` | Home: greeting, widget grid | `HomeView` | none |
| `/about` | The home with the About up ([system-about.md](./system-about.md)) | `HomeView` + `AboutRoute` | none |
| `/writing` | Post list | `PageLayout page="writing"` | `λhux` → `/` |
| `/writing/<slug>/<lang>` | Article | `PostContent` (`PageLayout variant="reader"`) | `/writing` |
| `/works` | The log; `?type=talk` and the others are filters, each with its own Open Graph card | `PageLayout page="works"` | `λhux` |
| `/prompt` | Prompts | `PageLayout page="prompts"` | `λhux` |
| `/docs`, `/docs/<slug>/<lang>` | Docs list, a doc | `PageLayout title=…`, `PostContent` | `λhux`, `/docs` |
| `/lab`, `/lab/<id>` | Labs index, a lab | `PageLayout page="lab"`, `LabShell` ([system-lab.md](./system-lab.md)) | `λhux`, the lab's own |

Addresses that move, all in `next.config.ts` unless noted:

- `/writing/<slug>` and `/docs/<slug>` get a 307 to `/<slug>/<lang>`, the
  language read from the `locale` cookie (default `en`). This is in
  `middleware.ts`.
- `/works/<type>` redirects to `/works?type=<type>`. A rewrite serves the
  query form from that page, so a crawler reads that filter's card.
- `/editor/*` redirects to `/lab/*`, and `/bezel/*` to `/vitre/*`. `/vitre`
  sends a desk to `/lab/vitre`.
- Old Jekyll addresses (`/YYYY/MM/DD/slug`) are handled by
  `lib/jekyll-redirects` and a catch-all to the GitHub Pages archive.

### Ways to move

1. **The palette.** Every section has a row and a slash letter (Docs has
   only the letter). It opens from the floating button on every page, from
   ⌘K, or from `/` outside a field. The rows, letters and button are in
   [Command System](./system-command.md).
2. **The back link** (`SystemNav`, `components/ui/system-nav.tsx`), at the
   top left of every `PageLayout` page. It goes to the parent, not back in
   history: article → its list → home. A glass capsule with a chevron and
   where it goes (`‹ λhux`, `‹ /writing`, `‹ /docs`), the same material as the
   command bar and the Ask ball, so it reads as a button rather than a label;
   the path scrambles to `cd ..` on hover. Drawn 36px, a 48px target
   (`hit-area`). On an article or a doc, once the masthead has scrolled away,
   the same capsule pins at the top left, level with the Dock's pills
   (`FloatingBack`, `components/ui/floating-back.tsx`), so the way up is
   never only the palette.
3. **Content.** Post rows, widget surfaces and links in the page. A widget
   with an `href` pushes it with the transition router; ⌘/Ctrl-click or a
   middle click on its blank surface opens a new tab instead
   (`components/ui/widget.tsx`). On the home, the `λhux` mark itself opens
   `/about` once its name has been revealed: by hovering on a desk, by
   holding on touch (`components/home/scramble-identifier.tsx`).
4. **Browser back and forward.** Plain history. `ViewTransitions` listens
   for `popstate`, so they animate too.

### The content page: `PageLayout`

`components/ui/page-layout.tsx`, used by every list page and, through
`PostContent`, by every article and doc. A centred column
(`max-w-[var(--page-col)]`, 680px, `px-[var(--page-gutter)]`) with
`pt-16 sm:pt-24 pb-32 sm:pb-40`. Two variants:

- **`poetic`** (lists): a `HeaderZone` of fixed height (`h-44 sm:h-48`) so
  the content always starts at the same place. It holds the back link, then
  the title, scrambled on hover when `page` is given (`TextScramble`, i18n
  keys `${page}Title` / `${page}TitleHover`). It leaves as the page scrolls
  by the hero exit (`components/ui/hero-exit.ts`): `fade` by default, sticky
  and fading under the content; `scroll` rides up in flow. The DevTool can
  pin either for the session. `headerActions` hang under the title (the
  language filter). `pinnedActions` is a toolbar that pins at the top
  instead of fading with the hero (`/works`, `/prompt`).
- **`reader`** (articles, docs): no hero zone. A `reader-masthead` holds the
  back link, the title and `headerActions`, and its sizes follow the reading
  size (below).

### Page transitions

`app/layout.tsx` wraps the app in `next-view-transitions`'
`<ViewTransitions>`. Its `Link` and `useTransitionRouter().push` start the
navigation inside `document.startViewTransition()`. Where the browser has no
`startViewTransition`, the library navigates without a transition. The
styles are in `app/globals.css` under "View Transition API Styles":

| Name | Set by | Animation |
|------|--------|-----------|
| `root` | the browser | Old page fades out, new page fades in, 200ms ease-out |
| `site-identifier` | `data-view-transition="site-identifier"` on the home's `ScrambleIdentifier` and on `SystemNav` | The group morphs position and size, 300ms `cubic-bezier(0.4, 0, 0.2, 1)`; the snapshots crossfade in 200ms |
| `ask-ball` | `[data-ask-ball]` (`systems/command/fab.tsx`), only under `:root:active-view-transition` | Slides 300ms with the same curve; no crossfade (the old snapshot is hidden); the group blurs what is under it (`backdrop-filter: blur(24px)`) |

Under `prefers-reduced-motion: reduce` every `::view-transition-*` animation
is off and the navigation is instant.

### Reading settings ("Aa")

An article page (anything `PostContent` renders with `toc`, today the
writing articles) ends its meta row with an `Aa` chip, after the language
switch. It opens the settings that until then only the devtool could reach
(`components/post/reading-settings.ts` and `ruler-settings.ts`): typeface,
size, column, wide media, focus mode, ruler. The chip and its surface are
`ReadingSettings` in `components/post/reading-sheet.tsx`.

It is the equivalent of Books' "Aa" menu and takes the surface system's
anchored presentation: a content-height sheet on a phone, a popover hanging
from the chip's leading edge from `sm` up (`ANCHORED_PRESENTATION`,
[Secondary Surfaces](./system-surface.md)). Neither is modal: the article
stays live behind it, so a change lands where you can watch it.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/navigation/reading-phone.png" style={{ width: "calc(40% - 0.5rem)", margin: 0 }} alt="An article on a phone with the reading sheet up: Typeface, Size, Focus mode and Ruler; the article visible above it." />
  <img src="/img/docs/navigation/reading-desk.png" style={{ width: "calc(60% - 0.5rem)", margin: 0 }} alt="The same article on a desk with the popover hanging under the Aa chip: Typeface, Size, Column, Wide media, Focus mode and Ruler." />
</div>

Left, iPhone 15 Pro viewport: four rows, because Column and Wide media would
switch nothing at that width. Right, 1280×860: all six. Both leave the
article live behind them.

The settings use the reader's words rather than the devtool's mono, and each
appears only where it does something:

**Size** has the widest effect: `--reading-size` is the number every `em`
inside an article resolves against, so changing it scales the whole
composition. Headings keep their hierarchy, and captions and code keep their
relation to the paragraph they annotate. That is why the article's type scale
is relative rather than absolute; a body that grew while its headings stood
still would collapse the hierarchy at one step.

All but two are offered at every width. **Column** and **Wide media** are
the exceptions, for a technical reason: the rule each switches lives entirely
inside its own breakpoint (`--breakpoint-measure`, 760px, and
`--breakpoint-bleed`, 900px, in `app/globals.css`), so below that width the
control would be wired to nothing. Each row hides itself with the `measure:`
or `bleed:` variant of that same token, so the control and the rule it drives
read one number and cannot drift apart.

Nothing else is hidden narrow, even where it is less useful. These are single,
global, persisted settings: hiding focus mode on a phone would leave a reader
who turned it on at a desk no way to turn it off in a pocket, and the devtool
is not a door a reader opens.

The devtool keeps its Reading module. Both surfaces write the same persisted
store, so the panel and the reader's menu always agree.

## Rules

| Rule | Why | What breaks |
|------|-----|-------------|
| Moves between pages use `Link` or `useTransitionRouter` from `next-view-transitions` | Only those start a view transition | The page swaps with no crossfade and `λhux` jumps |
| Updates to a page's own query (`?type=`, the language filter) use `next/navigation`'s router (`app/works/view.tsx`, `app/prompt/view.tsx`, `app/writing/blog-list.tsx`) | A filter is not a new page | A filter click crossfades the whole page |
| One `site-identifier` per page | A `view-transition-name` must be unique in the document | The browser skips the transition |
| `ask-ball` is named only under `:root:active-view-transition` | A named element is a backdrop root, so the ball's own frost would see only itself | A bare tinted ball at rest |
| The `root` rules stay global | `systems/ambient/components/solar-theme.tsx` also commits the theme through `startViewTransition` | A change to the page crossfade also changes the theme change |
| A reading setting that only works above a width hides with that width's variant | The control and its rule read one token | A control that switches nothing |
| The back link goes to the parent, not `router.back()` | It names where it goes; history may lead off-site | A link labelled `/writing` that goes somewhere else |

## What is free to choose

- A page's `backHref` / `backLabel`, its `variant`, and whether its title
  scrambles (`page`) or is static (`title`).
- The default hero exit: change only `defaultHeroExit` in
  `components/ui/hero-exit.ts`.
- Transition durations and curves, together with the reduced-motion rule.
- Which reading settings exist, as long as each hides only where it does
  nothing.

## Adding a section

1. `app/<route>/page.tsx` and a view that renders `PageLayout` (`page=` with
   `<page>Title` / `<page>TitleHover` keys in `lib/i18n`, or `title=`).
2. A palette command for it (`navigate`, section `navigation`, a free
   letter): [Command System, "Adding a command"](./system-command.md).
3. Links to it use `next-view-transitions`. A home widget gets `href`.
4. Add a row to the routes table above.

## Reference: `PageLayout` props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `page` | `ScramblePage` | - | Scrambling title from `${page}Title` / `${page}TitleHover`. Instead of `title` |
| `title` | `string` | - | Static title. Instead of `page` |
| `backHref` | `string` | `"/"` | Where the back link goes |
| `backLabel` | `string` | `"λhux"` | What it shows |
| `headerActions` | `ReactNode` | - | Under the title: meta row, filter |
| `pinnedActions` | `ReactNode` | - | A toolbar that pins at the top; `poetic` only, instead of `headerActions` |
| `variant` | `"poetic" \| "reader"` | `"poetic"` | Hero zone, or reading masthead |
| `className` | `string` | - | Added to `main` |
| `children` | `ReactNode` | required | The page |
