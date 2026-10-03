# Lab

The site studied from the inside, the libraries it publishes, and the short pieces it keeps.

```
systems/lab/
├── catalog.ts            # every lab: id, name, kind (study | library | experience), words
├── i18n.ts               # LabTable, useLabStrings, the frame's own words
├── components/
│   ├── shell.tsx         # LabShell, LabBar, LabPanel, LabSection, buttons
│   ├── nav.tsx           # LabNav: the name in the bar, and the switcher
│   ├── controls.tsx      # the panel's knobs: Field, Segmented, Slider, …
│   ├── library.tsx       # the library template: LibraryShell, ApiReference, …
│   └── experience.tsx    # ExperienceStage: the piece, phone-shaped
└── surfaces/             # each lab at a glance: the /lab cards, the home widget

app/lab/                  # the routes: the index, and one folder per lab
app/lab/vitre/            # the first library: guide, api/, site/
public/experiences/       # an experience's own page, chromeless, iframed
components/home/lab-widget.tsx  # the home widget (off by default)
```

## Three kinds of lab

A **study** lays one of this site's systems open: the real components, the
real policy, the real state, with the knobs that tune them (Works, Attachments,
Icon, Legibility, Glow). It is for this site; it never pretends to be anything
else.

An **experience** is a short piece: one or two gestures, a few seconds, a
feeling. The piece is a page in `public/experiences/<id>`. The lab frames
that page (`ExperienceStage`). The home screen lists it as a web app
(`content/apps.json`), and the window iframes the same page with no site
chrome around it. The home Lab widget does not rotate experiences; they are
not specimens of the site.

A **library** is a system that left as a package. Its lab is the package's
home; there is no other docs site. Every library's home has the same shape,
so a new library brings its words and its demo, not a design:

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

## Content stays with the package

A library's words live in the package, not in `app/lab`: Vitre's are
`packages/vitre/site/src/docs` (`sections.tsx` for the guide, `api.ts` for
the reference). `api.ts` is type-checked against `vitre.d.ts`, so an export
or a public field that is not documented fails `pnpm vitre:typecheck` and,
because the lab imports it, `next build`. The lab adapts that data to the
template's `LibraryApi` (`app/lab/vitre/api.ts`) and renders it in the site's
type.

That is what keeps the library portable. If it ever needs a home of its own
(its own repository, a community, versioned docs), a small shell can render
the same content; nothing has to be rewritten.

A library's demo is its own document (`/vitre`, a Vite build in
`public/vitre`): the package takes over the page it runs on, so the simulator
frames it and drives it over `postMessage`. A phone gets the demo full screen
at `/vitre`; anything else is sent to the lab.

## One frame

Every lab opens on its work under one sticky bar: the way
home, the lab's name (which is also the switcher, `LabNav`), an info button
with the catalog's blurb, then the lab's tools, a live readout and its
actions. Three bodies under it: `document` (one column), `workbench` (a stage
beside a panel of knobs, the panel folded behind the bar's sliders button
below `lg`), `canvas` (the whole width). A library's guide is a canvas; its
API and On hux.pro pages are documents.

`scrollTools` is for tools longer than the bar (a guide's section tabs): they
scroll between the name and the actions instead of wrapping the actions onto
a row of their own, and on a phone they take the second row.

## Adding one

1. An entry in `catalog.ts`: `kind: "study"`, `kind: "library"` with its
   `library` read from the package, or `kind: "experience"` with `play`
   pointing at the page in `public/experiences/<id>`. An experience is also
   an app in `content/apps.json` (portrait, a manual icon) so it sits on
   the home screen.
2. A route under `app/lab/<id>`, in `LabShell` (a study), `LibraryShell`
   (a library, with `api/` and `site/` beside it), or `ExperienceStage`
   inside `LabShell` (an experience).
3. A surface in `systems/lab/surfaces`, for the index and, except
   experiences, the home widget.
4. Its words in both languages: a `strings.ts` beside it, read with
   `useLabStrings`. Code names stay as written.

## The index

`/lab` leads with libraries: a library is a lab that shipped, a different
promise to a different reader, so it leads as a wide card with the package's
facts (`LibraryFacts`) and its blurb, where a study is a card in the grid
with its one line. Experiences follow the studies, the same card, a piece
rather than a system. The switcher on every bar groups the same way.

## Quiet by design

Labs is public but not what most visitors came for: the palette finds it by
name and never offers it (`searchOnly`; `/` `E` still opens the index), and
the home widget is off until a visitor adds it, from the grid's edit mode
or the switch on `/lab` (`components/home/widgets.ts`).
