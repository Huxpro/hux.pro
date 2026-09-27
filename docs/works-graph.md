# The graph on /works

`/works?graph=1` (the branch button at the end of the toolbar) draws the log
as `git log --graph`. The page is already a time axis; the graph adds the
other axis, which project each commit belongs to.

It combines with any form: `?graph=1&view=index` is `git log --graph
--oneline`.

## What goes where

`lib/log-graph.ts` lays out one chapter at a time:

- A commit sits on its first `about` project, if that project is in the
  same chapter. An edition sits wherever its original sits.
- A project that anything sits on gets a lane. The project's own row is at
  the bottom of its lane, and that is where the lane forks: back into the
  main line, or into its parent project's lane when the project is itself
  about another one (Lynx goes open source and lynx-ui fork from Lynx).
- Everything else stays on the main line, column 0, where the rail runs in
  the other views.

Lanes take the first free column to the right of the lane they fork from,
so lanes that don't overlap in time share a column. Every chapter uses the
widest chapter's column count, so the main line is in the same place all
the way down.

In the graph nothing is nested and there are no quiet pointer lines: every
commit is its own row at its own date. Editions keep their quiet line, on
their original's lane.

## Drawing

Each row's gutter is as wide as the lanes, and its mark sits in its column
(`graph` on `TimelineCommit`). `components/log/graph-lanes.tsx` measures
those marks and draws the lines between them in one SVG per chapter, so the
lines can't disagree with the marks. Lines stop short of each mark, like the
tenure rail.

- Hovering any row on a lane brightens that lane and its name.
- From `lg` up the whole gutter hangs in the page margin, so the content
  column doesn't move and the tree has room.
- Below `lg` the gutter is inside the column. A lane is 16px from `@sm` up
  and 10px on a phone, so three columns cost 40px there.

## Branch names

Each lane is named the way git names a branch, and printed the way
`git log --decorate` prints it: `(lynx)` after the title of the lane's
newest row, in the same mono voice as the language badge. It is part of the
row, so it shows at every width and never sits on another lane's line.

- The name is the project's `branch` field (`lynx`, `open-source`, `ui`),
  or its English title as a slug when there is none.
- A project that is about another project gets its parent's name in front,
  the way git namespaces branches: `lynx/open-source`, `lynx/ui`. The name
  says where the lane branched from, even when the fork is a screen below.
- The project's own row, at the bottom of the lane, is not decorated: it
  already says its name, and in git a branch is named at its tip, not where
  it started.

The editor has a **Branch** field on projects.

## Families

A project that other projects are about (Lynx Framework) is a family. In
the default view, work about the family itself is *not* folded into the
family's row (see docs/works-threads.md): that row sits where the family
began, years below the work. So "about Lynx" only shows in the graph, as the
Lynx lane. Work about a release inside the family is still folded into the
release in the default view.
