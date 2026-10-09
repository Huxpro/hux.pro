# Lab

The site studied from the inside, and the libraries it publishes.

```
systems/lab/
├── catalog.ts            # every lab: id, name, kind (study | library), words
├── i18n.ts               # LabTable, useLabStrings, the frame's own words
├── components/
│   ├── shell.tsx         # LabShell, LabBar, LabPanel, LabSection, buttons
│   ├── nav.tsx           # LabNav: the name in the bar, and the switcher
│   ├── controls.tsx      # the panel's knobs: Field, Segmented, Slider, …
│   └── library.tsx       # the library template: LibraryShell, ApiReference, …
└── surfaces/             # each lab at a glance: the /lab cards, the home widget

app/lab/                  # the routes: the index, and one folder per lab
app/lab/vitre/            # the first library: guide, api/, site/
components/home/lab-widget.tsx  # the home widget (off by default)
```

## Two kinds of lab

A **study** lays one of this site's systems open: the real components, the
real policy, the real state, with the knobs that tune them (Works, Prompts,
Attachments, Icon, Legibility, Glow). It is for this site; it never pretends to be anything
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

## Content labs

Two studies lay open a content file rather than a system. The Works Lab
edits `content/log.json` in place. The Prompts Lab (`/lab/prompts`) reads
`content/prompts.json` as a structure: a map of the refs between entries and
influences with each entry measured, everyone quoted grouped across entries,
every sentence in one bilingual search, and the file's own rules. The model
and the rules are `lib/prompts-lab.ts`, which `pnpm prompts:check` runs too,
failing on an error, so the page and the script agree. It is read-only: the
file is edited by hand, and this is where you look before and after.

## Adding one

1. An entry in `catalog.ts`: `kind: "study"`, or `kind: "library"` with its
   `library` read from the package.
2. A route under `app/lab/<id>`, in `LabShell` (a study) or `LibraryShell`
   (a library, with `api/` and `site/` beside it).
3. A surface in `systems/lab/surfaces`, for the index and the home widget.
4. Its words in both languages: a `strings.ts` beside it, read with
   `useLabStrings`. Code names stay as written.

## The index

`/lab` has two sections, libraries first: a library is a lab that shipped, a
different promise to a different reader, so it leads as a wide card with the
package's facts (`LibraryFacts`) and its blurb, where a study is a card in the
grid with its one line. The switcher on every bar groups the same way.

## Quiet by design

Labs is public but not what most visitors came for: the palette finds it by
name and never offers it (`searchOnly`; `/` `E` still opens the index), and
the home widget is off until a visitor adds it, from the grid's edit mode
or the switch on `/lab` (`components/home/widgets.ts`).
