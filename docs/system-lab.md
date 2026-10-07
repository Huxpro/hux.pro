# Lab

The site studied from the inside, and the libraries it publishes. `/lab` is
the index; every lab is one entry in `systems/lab/catalog.ts`, one frame
(`LabShell`), one folder of routes under `app/lab/<id>`, words in both
languages, and a small live surface for the index and the home widget.

## What it looks like

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-lab/index-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The /lab index on a desk: the title and the Add the Lab widget to Home switch, then Libraries with Vitre as one wide card (its surface beside its blurb and package facts), then Studies as a two-column grid of six cards, each wearing its surface." />
  <img src="/img/docs/system-lab/index-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same index on a phone: the Vitre card stacks its surface over its words and facts; Studies follows as one column, starting with the Works Lab." />
</div>

`/lab` on a desk and on a phone (393pt). Libraries lead, as a wide card with
the package's facts (`vitre v0.1.0 · React >=19 · not on npm yet`); the
studies follow as a grid, each card wearing its surface. The one control
under the title is the home widget's switch.

![The Works Lab's bar: λhux / Works Lab with its dropdown and info button, the form switch and "covers", the live readout "50 commits · 5 tags · 9 identities", and Inspect, Tag, Reset and Save at the right; the timeline below.](/img/docs/system-lab/study-works.png)

A study, the Works Lab (`layout="canvas"`): one bar holding the way home,
the lab's name (which is the switcher), the info button, its tools (the
timeline's form), the live readout, and its actions at the right end.

![Vitre's API page: the same bar with a Filter field as its tool and Docs · API · On hux.pro as its actions, then the package header (vitre v0.1.0, React >=19, not on npm yet, Source, Demo) and the first exports.](/img/docs/system-lab/library-vitre-api.png)

A library, Vitre's API page: the same bar, with the page's tool (the filter)
and the three library pages as its actions, then `LibraryHeader` read from
the package's `package.json`.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-lab/workbench-phone-folded.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Icon Lab on a phone: the bar with SVG and the sliders button, the app tile below it; no panel." />
  <img src="/img/docs/system-lab/workbench-phone-open.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same page after tapping the sliders button: the button is filled and the knobs panel (Typography: wordmark, weight, size, tracking) opens under the bar, above the stage." />
</div>

A workbench below `lg` (the Icon Lab on a phone): the panel is folded
behind the bar's sliders button, and opens under the bar, above the stage.

<img src="/img/docs/system-lab/home-lab-widget.png" style={{ width: "calc(50% - 0.5rem)" }} alt="The home Lab widget: a card titled lab with a refresh button, showing the Legibility Lab's surface (Aa in four ink rungs and the policy line) and its name." />

The home Lab widget, once a visitor turns it on: one lab's surface at a
time, the refresh turning to the next.

## How it fits together

![The catalog (systems/lab/catalog.ts) lists seven labs, six studies and Vitre as a library with its LibraryInfo. Per lab, a surface (LAB_SURFACES) feeds the /lab index and the home widget; each route folder under app/lab holds page.tsx, view.tsx and strings.ts, and the view renders inside LabShell or LibraryShell; a library's words come from its package. LabShell's bar is λhux / LabNav, info, tools, meta, actions over a document, workbench or canvas body.](/img/docs/system-lab/map.svg)

The catalog is the one list. The index, the switcher (`LabNav`), the info
button, the home widget and a library's header all read it; nothing else
lists the labs.

```
systems/lab/
├── catalog.ts        # LabId, LABS, LAB_GROUPS
├── i18n.ts           # LabTable, useLabStrings, the frame's words
├── components/
│   ├── shell.tsx     # LabShell, LabBar, LabPanel, LabSection, …
│   ├── nav.tsx       # LabNav: the name, and the switcher
│   ├── controls.tsx  # the panel's knobs: Field, Slider, …
│   └── library.tsx   # LibraryShell, LibraryHeader, ApiReference
└── surfaces/         # LAB_SURFACES, SurfaceFrame, strings.ts

app/lab/              # the index, and one folder per lab
app/lab/vitre/        # the first library: guide, api/, site/
components/home/lab-widget.tsx   # the home widget
```

## Two kinds of lab

A **study** lays one of this site's systems open: the real components, the
real policy, the real state, with the knobs that tune them. It is for this
site; it never pretends to be anything else.

A **library** is a system that left as a package. Its lab is the package's
home; there is no other docs site.

| id | kind | body | its system's doc |
|---|---|---|---|
| `works` | study | canvas | `content/log.json` (no doc of its own) |
| `attachments` | study | workbench | `docs/system-attachments.md` |
| `icon` | study | workbench | `docs/app-icon.md` |
| `legibility` | study | workbench | `docs/system-legibility.md` |
| `glow` | study | document | `docs/system-glow.md` |
| `band` | study | canvas, its own panel | `docs/system-dock.md` |
| `vitre` | library | canvas (guide), document (API, On hux.pro) | `packages/vitre/README.md` |

Every library's home has the same three pages, so a new library brings its
words and its demo, not a design:

| page | path | what it is |
|---|---|---|
| Docs | `/lab/<id>` | the guide: the library's own body, on the lab's canvas (Vitre's is an article beside a simulated iPhone) |
| API | `/lab/<id>/api` | every export by kind, then every public type's fields, with a filter (`ApiReference`) |
| On hux.pro | `/lab/<id>/site` | how this site uses it: live state, policy, the files it lives in. Read-only; the knobs stay in the devtool |

`LibraryShell` puts the three pages in the bar's actions and opens each page
with `LibraryHeader` (name, version, peer requirements, npm or "not on npm
yet", source, demo), read from the package's own `package.json` through the
catalog's `library`, so it cannot drift from what ships. Publishing to npm is
flipping `private` there; the header follows.

## The index

`/lab` has two sections, libraries first (`LAB_GROUPS`): a library is a lab
that shipped, a different promise to a different reader, so it leads as a
wide card with its blurb and `LibraryFacts`, where a study is a card in the
grid with its one line. The switcher on every bar groups the same way. The
index itself is a `PageLayout` page, not a `LabShell`.

## One frame

Every lab, of either kind, opens on its work under one sticky bar
(`LabBar`): `λhux`, the lab's name (which is also the switcher, `LabNav`),
an info button with the catalog's blurb and the whole readout, then the
lab's tools, the live readout (one truncated line, `xl` and up) and its
actions. A lab with none of these still gets the bar.

| `LabShell` prop | what it is |
|---|---|
| `lab` | the `LabId`: the bar's name and blurb come from the catalog |
| `layout` | `document` (one column, the default), `workbench` (a stage beside `panel`; below `lg` the panel folds behind the bar's sliders button), `canvas` (the whole width; the lab lays out its own body) |
| `tools` | what drives the stage, after the name |
| `meta` | the live readout |
| `actions` | what writes (SVG, Reset, Save, …), right-aligned |
| `panel` | the workbench's knobs (`LabPanel`) |
| `scrollTools` | tools longer than the bar (a guide's section tabs) scroll between the name and the actions instead of pushing the actions to a row of their own; on a phone they take the second row |
| `pin` | `band` (default): the bar pins in a `PinnedSlot` and shares the top band with the Dock; `static`: it scrolls away (the Band Lab, while it tries another bar) |

The bar's first row is the band's height, level with the Dock's pills.
Anything that sticks under it reads `--lab-under-bar`.

## Content stays with the package

A library's words live in the package, not in `app/lab`: Vitre's are
`packages/vitre/site/src/docs` (`sections.tsx` for the guide, `api.ts` for
the reference). `api.ts` is type-checked against `vitre.d.ts`, so an export
or a public field that is not documented fails `pnpm vitre:typecheck` and,
because the lab imports it, `next build` (the rule is also in the skill
`.claude/skills/vitre`). The lab adapts that data to the template's
`LibraryApi` (`app/lab/vitre/api.ts`) and renders it in the site's type.

That is what keeps the library portable. If it ever needs a home of its own
(its own repository, a community, versioned docs), a small shell can render
the same content; nothing has to be rewritten.

A library's demo is its own document (`/vitre/index.html`, a Vite build into
`public/vitre`): the package takes over the page it runs on, so the simulator
frames it and drives it over `postMessage`. A phone gets the demo full screen
at `/vitre`; anything else is redirected to `/lab/vitre` (`next.config.ts`).

## Rules

| Rule | Why | What breaks |
|---|---|---|
| A lab's `href` is `/lab/<id>` and its route folder is `app/lab/<id>` | `labFromPath` finds the current lab by the first path segment | The switcher and the bar name the wrong lab, or the index |
| Every page of a lab renders inside `LabShell` (a library: `LibraryShell`) | The bar is the way home and to the other labs | A lab with no way out, and no blurb |
| Words in a `LabTable` beside the lab (`const zh: typeof en`), read with `useLabStrings`; not in `lib/i18n.ts` | Labs are devtools; the site dictionary holds what visitors read. `typeof en` makes a missing key a type error | Untranslated or drifting copy |
| Code names stay as written (components, props, files, JSON keys, classes, routes) | That is what you would search the repo for | A label nobody can find in the code |
| A library's `LibraryInfo` is read from its `package.json` | The header and the index card state what ships | A version or npm link that lies |
| The Lab widget stays `defaultEnabled: false` (`components/home/widgets.ts`) | Labs are a study of the site's insides, not what visitors came for | Every visitor's home gets a devtool card |

## Free choices

- The body: `document`, `workbench` or `canvas`, whatever the lab's stage
  needs. A lab may lay out its own panel on a canvas (the Band Lab does).
- Tools, readout and actions, or none.
- Whether a study writes back (Works and Icon save in `next dev`); most are
  readouts.
- A study's page metadata sets `robots: { index: false, follow: false }`;
  a library's pages are indexed, since a developer looking for the package
  should find them.

## Adding one

1. An entry in `catalog.ts`, and its id in `LabId`: `kind: "study"`, or
   `kind: "library"` with its `library` read from the package.
2. A route under `app/lab/<id>`, in `LabShell` (a study) or `LibraryShell`
   (a library, with `api/` and `site/` beside it).
3. A surface in `systems/lab/surfaces` (`<id>.tsx`, drawn in
   `SurfaceFrame`, its words in `surfaces/strings.ts`), registered in
   `LAB_SURFACES`. The `Record<LabId, …>` type fails until it is.
4. Its words in both languages: a `strings.ts` beside it, read with
   `useLabStrings`. (The Legibility Lab predates the shared table: its
   `i18n.ts` has its own `useLabText`. Don't copy it.)

## Quiet by design

Labs is public but not what most visitors came for: the palette finds it by
name and never offers it (`searchOnly` in `systems/command/actions.tsx`;
`/` `E` still opens the index), and the home widget is off until a visitor
adds it, from the grid's edit mode or the switch on `/lab`
(`useHomeWidget("lab")`; the choice is stored in `hux_widget_prefs`).

## History

The family used to live under `/editor` and was called the editor family.
`next.config.ts` keeps the old addresses: `/editor` goes to `/lab/works`,
`/editor/theater-variants` (a gallery that is gone) to `/lab`, and
`/editor/:path*` to `/lab/:path*`. `/lab/attachment` (singular) redirects
to `/lab/attachments`.
