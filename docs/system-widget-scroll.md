# Widget Scroll

A widget's list body scrolls under a pointer and holds still under a finger.
Under a finger the page owns every vertical swipe that lands on a widget; a
list may scroll itself only where a wheel drives it. This page is the
reasoning, because the rule looks arbitrary and isn't.

## What it looks like done well

On a phone, a swipe that starts on the writing card's rows scrolls the page.
The rows go up with the card; nothing inside the card moves.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-widget-scroll/phone-swipe-before.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home screen on a phone, the writing card mid-screen with five rows." />
  <img src="/img/docs/system-widget-scroll/phone-swipe-after.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same screen after a 250px upward drag that started on the writing card's rows: the whole page has moved up and the card still shows the same five rows in the same place inside it." />
</div>

Before and after a 250px upward drag that starts on the fourth row
(headless Chromium, iPhone 15 Pro viewport). The page moved 235px; the list
moved 0px, and its first row is still the first thing under the title.

![The writing card on a 1280px desk: the title and five rows, the last ending 20px above the card's bottom edge, no fade and no scrollbar.](/img/docs/system-widget-scroll/desk-writing.png)

The same card on a desk. It prints the same five rows at the same 238px,
with no port: the list is too short to need one (see the table below), so a
wheel over it scrolls the page here too. When the list outgrows six rows,
this is where the port appears and the wheel goes to it.

## How it works

![The decision for a gesture on a widget's list body: if the widget passed no port, the body is a plain stack and the page owns the gesture on every device; if it did, a pointer-fine device gets a snapping, fading port that owns the wheel, and a finger gets a stack capped at TOUCH_ROWS and the page owns the swipe. Below: a finger held still lifts the card at 400ms on its own surface, belongs to the row on a row, and is cancelled by more than 10px of drift.](/img/docs/system-widget-scroll/decision.svg)

**One component, one media query.** Every widget list body is
`WidgetScrollBody` (`components/ui/widget.tsx`). Its classes:

```
always       relative -mx-2 px-2 pb-3 overflow-hidden no-scrollbar
with port    pointer-fine:pb-7 pointer-fine:overflow-y-auto
             pointer-fine:snap-y pointer-fine:snap-mandatory pointer-fine:scroll-smooth
             pointer-fine:[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]
             + the port string itself (writing: pointer-fine:max-h-64)
```

A body is a plain stack by default, and `port` opts one list back into
scrolling, under a pointer only. It is one prop because the height, the
scroll, the fade and the room the fade needs are one decision: a body with no
port must not wear a mask over its last row or reserve 28px under it.
`no-scrollbar` hides the bar, so the fade is the port's only tell, and hover
is what makes it discoverable.

**What each list prints** is then a curation question, not a truncation one:

| | touch | pointer | today |
|---|---|---|---|
| **projects** (`ProcessingWidget`) | the `featured-projects` group, no port | the same | 5 rows, 238px |
| **writing** (`WritingWidget`) | `TOUCH_ROWS` (5); rows past the cut wear `pointer-coarse:hidden` | all of them; the port (`pointer-fine:max-h-64`) only when `rows.length > PORT_ROWS` (6) | 5 rows (3 latest + 2 featured), no port, 238px |

The projects card reads its group the way the talks card reads its
`featured-*-talks` ones (`components/home/processing-widget.tsx`): a preview
is a choice about what to show, and a truncated list is not one. Writing has
no such group, so it caps by count (`components/home/writing-widget.tsx`).

**The long-press is the other gesture a finger can make on a card.** The
grid's `SortableMasonryItem` (`components/ui/sortable-masonry.tsx`) only
lifts a card on a hold: dnd-kit's `TouchSensor` with `TOUCH_ACTIVATION`
(`{ delay: 400, tolerance: 10 }`, `components/ui/sortable-order.ts`), so a
plain swipe is always the page's. `usePressHold` grows the card through the
hold and ends it on more than 10px of drift or any scroll. A press on a row
is the row's (`landsOnOwnAction` in `components/ui/widget-surface.ts`: an
`a` is its own action), so holding a row never lifts the card. The home
screen's text-selection lock (`useLockTextSelection`) keeps that hold from
growing into a page-wide iOS selection. The classes involved, `press-hold`,
`system-surface` and `system-voice`, are in
[Design System: Touch](./design-system.md#touch).

## Constraints

**No widget body scrolls under a finger.** A port is a vertical scroller
nested inside the page's own vertical scroll. With a wheel it is free: the
wheel goes to whatever is under the cursor. Under a finger the widget always
wins:

- On a phone the card is most of the screen, so a swipe meant for the page has
  nowhere else to land.
- `snap-mandatory` holds the list wherever the gesture leaves it.
- Nothing chains back to the page *inside* one gesture. iOS chains only at the
  **start** of the next one, and only if the inner scroller was already at its
  end, so the first swipe is spent.
- On a phone the page itself scrolls in vitre's container (`#vitre-scroll`,
  see `packages/vitre`), so it is a container inside a container.

Measured with the same 250px drag from the middle of the writing list
(headless Chromium, iPhone 15 Pro viewport, `Input.dispatchTouchEvent`):

| | page moved | list moved |
|---|---|---|
| port forced on under touch (a 120px port, for the test) | **0px** | 88px (its whole range; the rest of the drag was lost) |
| the stack, as shipped | **235px** | 0px |

The first measurement, when the projects card still had a 256px port, was the
same shape on an iPhone 13 viewport: 0px for the page, 204px for the list.

**Asked in CSS, not detected in JS.** Tuning cannot fix it.
`overscroll-behavior` cannot hand a live gesture back, and no `touch-action`
makes a scroller not scroll. The gesture has to be removed rather than
arbitrated. The axis is already taken, and anywhere else it could move would
be an invention. `pointer: fine` is the honest question ("is the primary
instrument a cursor?"), and asking it in CSS means the same markup serves
both: no hook, no hydration branch, nothing measured, correct on the server.
Nothing in the widget code reads `pointerType` for this.

**A row count, not a fixed height.** Both stop the fight; only one of them
has a size you can predict. A fixed height clips whatever is under it, so how
much the card says depends on how long the titles happen to be. A Chinese
title and an English one can differ by a whole row. A row count inverts it:
the rows are fixed and the height follows, which is why both cards measure
238px in both languages, on a desk and on a phone. That costs the titles
their second line: the writing rows truncate, as a project's name always has.
The title in full is one tap away.

**No port without overflow.** `PORT_ROWS` is the most rows that fit
`max-h-64` (256px) once the fade's 28px is taken out: six at 36px. At or
below it the writing card passes no port, because a list that cannot
overflow must not reserve room under its last row for a fade that will never
run.

**The stack ends on `pb-3`, not the card's `pb-5`,** because a row carries
its own `py-2`: 12 + 8 puts the last line 20px off the bottom edge, which is
what the header's `pt-5` puts the title from the top.

## What is free to choose

- **Curated or capped.** A widget with a natural group (projects, talks)
  prints the group; one without (writing) caps by count with
  `pointer-coarse:hidden`. Either is fine; a list cut at whatever height is
  not.
- **The numbers.** `TOUCH_ROWS`, `PORT_ROWS` and `LATEST_COUNT` are the
  writing card's taste. `PORT_ROWS` follows from the port height; the others
  do not follow from anything.
- **Fixed or growing port.** `port="pointer-fine:h-64"` holds the height;
  `pointer-fine:max-h-64` (what writing uses) only shows the port once the
  list outgrows it.
- **Where the tap goes.** The card's surface opens the full list (`/writing`,
  `/works?type=project`); a projects row opens its commit's permalink
  (`/works#<hash>`, see `components/log/use-commit-anchor.ts`). The hand-off
  carries the card's own filter, because a card about projects that lands
  you in a column of twenty-five commits has made you redo the narrowing it
  was already doing.

## Adding a list to a widget

1. Render it in `WidgetScrollBody`, never a `div` with `overflow-y-auto`:
   an unconditional scroller traps the page's swipe on a phone.
2. Give rows `snap-start` and the hover bleed `-mx-2 px-2`, and make each row
   its own action (a link or button), so a hold on it stays the row's.
3. Decide what a finger sees: a curated group, or a count with
   `pointer-coarse:hidden` on the rows past it. Keep rows one line.
4. Pass `port` only when the list can outgrow it, and compute that from the
   row count, as writing does.
5. Check it: on a phone viewport, drag from the middle of the list and read
   the page scroller and the list's `scrollTop`. Only the page should move.
   In headless Chromium, drive the drag with CDP `Input.dispatchTouchEvent`;
   `Input.synthesizeScrollGesture` did not move the page here.

## Background: what the platforms do

- **iOS**: a WidgetKit widget does not scroll, in either axis. The word
  "scroll" does not appear on the [Widgets][hig-widgets] page; interaction is
  tap plus buttons and toggles, and *"when people interact with your widget in
  areas that aren't buttons or toggles, the interaction launches your app."*
  More than fits is answered by a bigger widget size, or the app.
- **Android**: the opposite. Collection widgets *can* scroll vertically, and
  *"the only gestures available for widgets are touch and vertical swipe"*,
  because the home screen pages **horizontally** and leaves the vertical axis
  free. HarmonyOS is the same shape (`List` and `Swiper` both work in ArkTS
  cards, home screen pages horizontally).
- So all three can afford what they allow because **their host surface never
  scrolls vertically**. A web page is the one host that does. There is no
  platform precedent for a vertical list in a vertically scrolling page, which
  is why the HIG says, on [Scroll views][hig-scroll]: *"**Avoid putting a
  scroll view inside another scroll view with the same orientation.** … It's
  alright to place a horizontal scroll view inside a vertical scroll view (or
  vice versa), however."*

Touch therefore lands where Apple already is: the card is a preview of a
fixed few rows, and the tap opens the real list.

## Tried and rejected

All of these worked. All of them passed the swipe through to the page. They
were dropped because each bought that with a cost the row count doesn't
have, and because six switchable behaviours is not a design.

| Rejected | Why |
|---|---|
| **expand**: a `more` control unfolding the card in place | The card changing its own height is a *Live Activity* behaviour, not a widget one; and in a CSS multicolumn grid it rebalances the columns beside it. |
| **page**: horizontal swipe / dots paging the column | Cross-axis paging is HIG-blessed nesting and has real precedent (Android `StackView`, HarmonyOS `Swiper`), but a sideways gesture that moves a column down is exactly the *"unique gesture to perform a standard action"* the [Gestures][hig-gestures] page warns against, and the dots were its only tell. |
| **drift**: the column advancing with the page's own scroll | Delightful, uncontrollable: you can't stop on a row, and two things move when you scroll one. |
| **rail**: a scroll rail down the trailing edge | The strongest runner-up: a standard action (iOS scrubs from the indicator; visionOS turns a drag on it into a jog bar), full list, fixed footprint. Cost 32px off every row's title, and put a second thing on the card that takes a press. |

The thing they all have in common is that they spend interaction budget to
keep a list the card was never the right home for. The card is a preview; the
page is the list.

[hig-widgets]: https://developer.apple.com/design/human-interface-guidelines/widgets
[hig-scroll]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[hig-gestures]: https://developer.apple.com/design/human-interface-guidelines/gestures
