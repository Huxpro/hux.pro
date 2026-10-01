# Widget forms

A home widget can come in **forms**: the same feature drawn another way. The
visitor picks one the way they pick a widget's size on Apple's platforms, and
the choice is theirs to keep.

## Why forms, not sizes

WidgetKit's sizes (Small / Medium / Large / Extra Large) exist because a home
screen is a grid of cells. This grid is a masonry of one column width
(`SortableMasonry`), so a "bigger" widget has nowhere to go. What varies
usefully is the *reading*: the theater card can be a reel of featured talks,
a channel guide of what is on now, or a map of where they were given. Each is
a whole widget; none is a crop of another.

## Where the choice is made

Each platform's gesture, where it belongs (`components/home/widget-frame.tsx`):

| | gesture | what it shows |
|---|---|---|
| **macOS** | right-click a widget | its forms as a choice, then *Edit Home Screen* and *Remove Widget* — Sonoma's widget menu |
| **iOS / iPadOS** | hold a widget → the grid jiggles | a strip on the lower edge of each widget that has forms; tap one and it changes in place — iOS 18's sizes in edit mode |

The menu is the pointer's. Base UI's `ContextMenu` also opens on a touch
long-press, but here a long-press already lifts the card, so the frame turns
a finger away (`preventBaseUIHandler`) and a finger goes through edit mode.
The strip carries `data-widget-edit`, which the masonry lets through: it is
not a pickup, and its taps are not swallowed the way a jiggling card's are
(`landsOnEditControl` in `components/ui/widget-surface.ts`).

## The change

A new form **morphs**: the frame holds the old height and eases to the new
(420ms, the sheet curve), while the new face resolves out of a slight blur
(`.widget-form-in`). That is iOS's resize — content cross-dissolving inside a
frame springing to size. Only a choice made just now morphs
(`wasJustChosen`); a saved form arriving after hydration simply appears.

## Declaring forms

In `components/home/widgets.ts`, give the widget's spec `forms` — id, title
key, glyph — the default first:

```ts
{
  id: "featured-talks",
  title: "widgetFeaturedTalks",
  defaultEnabled: true,
  forms: [
    { id: "reel", title: "widgetFormReel", icon: GalleryHorizontal },
    { id: "channel", title: "widgetFormChannel", icon: Radio },
    { id: "tour", title: "widgetFormTour", icon: MapIcon },
  ],
},
```

and hand the grid a component per form id instead of a node
(`app/home-view.tsx`: `{ id, node: null, forms: THEATER_FORMS }`). Each form
is a complete widget — its own `WidgetShell`, header and body.

## Storage

Like on/off (`hux_widget_prefs`), a form is an override per id
(`hux_widget_forms`), dropped when it is back at the default — so a widget
that changes its default form moves for everyone who never chose. A saved
form the widget no longer has is ignored. The server and the hydrating render
draw every widget in its default form. The grid's *Reset* puts forms back
too (`WidgetPicker` registers them as a masonry section).
