# iOS 26 Safari — Liquid Glass viewport rules

iOS 26 tints Safari's Liquid Glass chrome (the bottom search / tab bar and the
top status area) by **sampling the page's own pixels** behind it. Get that
sampling wrong and you see the bug: a white, black, or oddly tinted band behind
the bottom bar, colour bleeding under the status bar, fixed headers staining the
chrome, or a modal backdrop that stops short of the toolbar. `viewport-fit=cover`
and `100dvh` alone don't fix any of it — they change layout, not what Safari
samples.

These are the rules this codebase follows. They cost nothing on other browsers,
so they're unconditional — no UA sniffing.

## 1. The root carries an explicit colour

`app/layout.tsx` sets `viewportFit: "cover"`, and `globals.css` paints **both**
`html` and `body` with `--background`, plus a matching `color-scheme`
(`light` / `dark` on `html.dark`).

Safari 26 **ignores `theme-color`** for toolbar tinting, and a transparent root
falls back to white — which is the pale band people report. The declared
`color-scheme` keeps the UA canvas under our paint from disagreeing with the
theme.

The ambient gradient (`systems/ambient`) is a **fixed** layer, so it can't stand
in for this: at `scrollY = 0` Safari samples the root background-*colour*, not
whatever media is painted over it.

## 2. Fixed and sticky elements stay transparent

A fixed or sticky element's **own** `background-color` / `backdrop-filter` gets
sampled into the chrome. The element stays transparent and the visual goes on an
**absolute child**:

```tsx
<div className="fixed inset-0 z-[10000]">
  <div aria-hidden className="overlay-bleed bg-black/80 backdrop-blur-md" />
</div>
```

Fixed surfaces converted to this shape: the dock's expanded Live Activity panel
(it sits directly under the status bar), the theater backdrop and stage, the PiP
control bar, the ruler-ToC scrim, the playlist sheet's overlay, and the slide
modal's backdrop.

## 3. Backdrops bleed past the visual viewport

`.overlay-bleed` (`globals.css`) is the absolute child above: full width, and
`15vh` of bleed above *and* below, so Safari's chrome samples real backdrop
pixels instead of the page behind — or nothing. Controls move back inward with
`env(safe-area-inset-*)` padding rather than by shrinking the backdrop.

## 4. Don't lock the document to hold the page still

`document.body.style.overflow = "hidden"` under a fullscreen overlay is the
classic trigger: with nothing to scroll, Safari has no content to composite its
toolbars against. Keep the document scrollable and **block the gestures inside
the overlay shell** instead — `lib/overlay-scroll.ts`:

```ts
useEffect(() => (open ? holdScrollGestures(/* shell or document */) : undefined), [open]);
```

A wheel or touch drag that no scroller *inside* the overlay can consume is
cancelled, so it never chains out to the page; scrollable content in the overlay
keeps working, direction-aware at its ends. Used by the theater, the command
palette (its iOS branch), and the slide modal — none of them touch `body`
overflow any more.

**The one exception** is `systems/windows`, which locks the root's `overflow-y`
while an app window owns the gesture. That lock exists precisely because the
gesture *can't* be blocked: the window body is a cross-origin iframe whose wheel
and touch events never reach this document (see
[Window System → Scroll ownership](./system-windows.md)). It's on `html` rather
than `body`, it's transient, and the explicit root colour above is what keeps
the chrome tinted correctly while it's held.

## 5. Hidden overlays stop painting

`opacity: 0` + `pointer-events: none` still composites, and still tints. Fixed
layers that stay mounted while hidden — a minimized app window, a parked theater
stage — flip to `visibility: hidden` once their hide animation lands
(framer-motion's `transitionEnd`). `visibility` rather than `display: none`
keeps the box, and the app or player inside it, alive.

## 6. Fullscreen media

For a page that is *only* media, give the document a top scroll runway and
scroll to it on load: the margin and the scroll cancel out visually, but Safari
then has non-zero scroll and can composite real pixels behind the status area.
This site has no such page — its media (theater, slide modal) are overlays on a
normally scrollable document — so the runway isn't wired up. Add it here if a
fullscreen media route ever lands.

## Testing

The structural rules above are verified in Chromium (root colours in both
schemes, no background on any fixed layer, `.overlay-bleed` extending past the
viewport, overlays holding the page without a body lock, hidden layers going
`visibility: hidden`). **The tint itself can only be confirmed on a real iOS 26
device**, in both bottom-toolbar states (expanded and collapsed) — that pass is
still outstanding.
