# Lab

The site studied from the inside, the libraries it publishes, and a few
feelings, a few seconds long.

```
systems/lab/
├── catalog.ts            # every lab: id, name, kind (study | library | experience), words
├── i18n.ts               # LabTable, useLabStrings, the frame's own words
├── components/
│   ├── shell.tsx         # LabShell, LabBar, LabPanel, LabSection, buttons
│   ├── nav.tsx           # LabNav: the name in the bar, and the switcher
│   ├── controls.tsx      # the panel's knobs: Field, Segmented, Slider, …
│   ├── library.tsx       # the library template: LibraryShell, ApiReference, …
│   └── experience.tsx    # the experience template: ExperienceShell
└── surfaces/             # each lab at a glance: the /lab cards, the home widget

app/lab/                  # the routes: the index, and one folder per lab
app/lab/vitre/            # the first library: guide, api/, site/
app/lab/wardrobe/         # the first experience; its document is public/dreams/wardrobe
components/home/lab-widget.tsx  # the home widget (off by default)
```

## Three kinds of lab

A **study** lays one of this site's systems open: the real components, the
real policy, the real state, with the knobs that tune them (Works, Attachments,
Icon, Legibility, Glow). It is for this site; it never pretends to be anything
else.

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

An **experience** is a feeling, a few seconds and a few touches long (The
Wardrobe, a childhood nightmare in three blinks). It is one page with two
hosts that both want a whole page. The Wardrobe is built on `packages/scene`
(docs/system-scene.md) from `experiences/wardrobe`, by Vite, into
`public/dreams/wardrobe/` (gitignored; `pnpm build` builds it, `pnpm dev`
builds it when stale); an experience can also be a single hand-written
document in `public/dreams/`. Its two hosts:

| host | how |
|---|---|
| the home screen | an app in `content/apps.json`, a tile in the folder, opened in a window (an iframe) |
| its lab, `/lab/<id>` | `ExperienceShell` (`components/experience.tsx`): the document in a phone-shaped frame, beside the story it came from, with Replay and a full-screen link |

The catalog's `experience` names both: `src` (the document) and `app` (its
apps.json id). The document reads the site's `locale` from the same origin
(`?lang=` overrides it) and takes a `?stage=` to hold one frame still, which
is what its surface on the index shows.

An experience built on the scene layer, given its language layer (the words
it came from and what they meant, `experiences/<name>/semantics.ts`), can be
inspected in its lab: the bar's Inspect switch lays the running scene open
beside the frame, with boxes over it, its params as sliders, and the verifier.

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

Every lab, of either kind, opens on its work under one sticky bar: the way
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

1. An entry in `catalog.ts`: `kind: "study"`, or `kind: "library"` with its
   `library` read from the package.
2. A route under `app/lab/<id>`, in `LabShell` (a study) or `LibraryShell`
   (a library, with `api/` and `site/` beside it).
3. A surface in `systems/lab/surfaces`, for the index and the home widget.
4. Its words in both languages: a `strings.ts` beside it, read with
   `useLabStrings`. Code names stay as written.

## The index

`/lab` has three sections. Experiences lead: they are made for whoever
wandered in, and each card wears the experience itself, small. Then the
libraries: a library is a lab that shipped, a different promise to a
different reader, so it is a wide card with the package's facts (`LibraryFacts`) and its blurb, where a study is a card in the
grid with its one line. The switcher on every bar groups the same way.

## Quiet by design

Labs is public but not what most visitors came for: the palette finds it by
name and never offers it (`searchOnly`; `/` `E` still opens the index), and
the home widget is off until a visitor adds it, from the grid's edit mode
or the switch on `/lab` (`components/home/widgets.ts`).
