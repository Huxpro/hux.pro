# Widget Scroll

A widget's list body scrolls under a pointer and holds still under a finger.
One media query, in `WidgetScrollBody` (`components/ui/widget.tsx`):

```
overflow-hidden
pointer-fine:h-64 pointer-fine:overflow-y-auto
pointer-fine:snap-y pointer-fine:snap-mandatory
pointer-fine:[mask-image:…]
```

The height, the scroll and the fade are one thing and all three are
`pointer-fine:`. Under a finger there is no port at all: each list renders a
fixed number of rows and hides the rest (`pointer-coarse:hidden` past the
cut — 5 for writing, 4 for projects), and the body is exactly as tall as they
are. Nothing is cut off, so there is nothing to fade and no height to hold.

This file is the reasoning, because the rule looks arbitrary and isn't.

---

## The problem

The writing widget and the projects widget each render a 256px port with
`overflow-y: auto` and `scroll-snap-type: y mandatory`. That is a **vertical
scroller nested inside the page's own vertical scroll**.

With a wheel it is free: the wheel goes to whatever is under the cursor, the
cursor is a precise instrument, and hover is what makes the port discoverable
at all.

Under a finger the widget always wins:

- On a phone the card is most of the screen, so a swipe meant for the page has
  nowhere else to land.
- `snap-mandatory` holds the list wherever the gesture leaves it.
- Nothing chains back to the page *inside* one gesture. iOS chains only at the
  **start** of the next one, and only if the inner scroller was already at its
  end — so the first swipe is simply spent.
- Inside vitre on an iPhone the page itself scrolls in a container (see
  `packages/vitre`), so it is a container inside a container.

Measured on an iPhone 13 viewport, swiping up from the middle of the projects
widget:

| | page moved | widget list moved |
|---|---|---|
| nested scroll | **0px** | 204px |
| fixed row count | **235px** | 0px |

## Why a row count and not a fixed height

Both stop the fight; only one of them has a size you can predict. A fixed
height clips whatever is under it, so how much the card says depends on how
long the titles happen to be — and a Chinese title against an English one is
a whole row of difference. A row count inverts it: the rows are fixed and the
height follows, which is why the writing card is 246px in both languages and
the projects card is 282px in both.

That costs the titles their second line — the writing rows truncate now, like
a project's name always has. A card is a preview; the title in full is one
tap away, and a row that can't wrap is a row whose height is knowable.

## Why a media query and not a gesture

Tuning cannot fix it. `overscroll-behavior` cannot hand a live gesture back,
and no `touch-action` makes a scroller not scroll. The gesture has to be
removed, not arbitrated — and the axis is already taken, so there is nowhere
to move it to that isn't an invention.

`pointer: fine` is the honest question ("is the primary instrument a cursor?"),
and asking it in CSS means the same markup serves both: no hook, no hydration
branch, nothing measured, correct on the server.

## What the platforms do, and why none of it transfers

- **iOS** — a WidgetKit widget does not scroll, in either axis. The word
  "scroll" does not appear on the [Widgets][hig-widgets] page; interaction is
  tap plus buttons and toggles, and *"when people interact with your widget in
  areas that aren't buttons or toggles, the interaction launches your app."*
  More than fits is answered by a bigger widget size, or the app.
- **Android** — the opposite: collection widgets *can* scroll vertically, and
  *"the only gestures available for widgets are touch and vertical swipe"*,
  because the home screen pages **horizontally** and leaves the vertical axis
  free. HarmonyOS is the same shape (`List` and `Swiper` both work in ArkTS
  cards, home screen pages horizontally).
- So all three can afford what they allow because **their host surface never
  scrolls vertically**. A web page is the one host that does. There is no
  platform precedent for what we were doing, which is why the HIG says, on
  [Scroll views][hig-scroll]: *"**Avoid putting a scroll view inside another
  scroll view with the same orientation.** … It's alright to place a horizontal
  scroll view inside a vertical scroll view (or vice versa), however."*

Touch therefore lands where Apple already is: the card is a preview of a
fixed few rows, and the tap opens the real list — the card's own surface for
`/writing` or `/works`, a projects row for its commit's permalink
(`/works#<hash>`, see `components/log/use-commit-anchor.ts`).

## What was tried and rejected

All of these worked. All of them passed the swipe through to the page. They
were dropped because each bought that with a cost the fixed height doesn't
have, and because six switchable behaviours is not a design.

| Rejected | Why |
|---|---|
| **expand** — a `more` control unfolding the card in place | The card changing its own height is a *Live Activity* behaviour, not a widget one; and in a CSS multicolumn grid it rebalances the columns beside it. |
| **page** — horizontal swipe / dots paging the column | Cross-axis paging is HIG-blessed nesting and has real precedent (Android `StackView`, HarmonyOS `Swiper`), but a sideways gesture that moves a column down is exactly the *"unique gesture to perform a standard action"* the [Gestures][hig-gestures] page warns against, and the dots were its only tell. |
| **drift** — the column advancing with the page's own scroll | Delightful, uncontrollable: you can't stop on a row, and two things move when you scroll one. |
| **rail** — a scroll rail down the trailing edge | The strongest runner-up: a standard action (iOS scrubs from the indicator; visionOS turns a drag on it into a jog bar), full list, fixed footprint. Cost 32px off every row's title, and put a second thing on the card that takes a press. |

The thing they all have in common is that they spend interaction budget to
keep a list the card was never the right home for. The card is a preview; the
page is the list.

[hig-widgets]: https://developer.apple.com/design/human-interface-guidelines/widgets
[hig-scroll]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[hig-gestures]: https://developer.apple.com/design/human-interface-guidelines/gestures
