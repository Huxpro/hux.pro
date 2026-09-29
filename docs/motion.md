# Motion & Animation

## Philosophy

Motion in Hux.Pro follows the **"System UI"** aesthetic—it is functional, physical, and restrained. It is never expressive for expression's sake.

> "If motion doesn't explain something, remove it."

### Core Principles

1.  **Functional**: Motion is used to indicate focus, transition, or state change.
2.  **Subtle**: Prefer `opacity`, `transform`, `blur`, and `scale` over large movements.
3.  **Physical**: Micro-animations should feel tactile and "weighty", like a physical switch or button.
4.  **Quiet**: Animations should be fast and recede, allowing the content to take center stage.

## Command Trigger Morph

The Command Trigger (the floating button that opens the command palette) morphs between three states: FAB, Pill, and Conversational Prompt. The animation follows a **"stagger and reshape"** pattern:

### Animation Sequence

```
[Homepage Prompt]  ─────────────────────>  [FAB/Pill]

1. FADE OUT       Content opacity → 0, x → -10px (150ms)
2. RESHAPE        Width/position morphs via layout animation (400ms)
3. FADE IN        New content opacity → 1, x → 0 (300ms, delayed 100ms)
```

### Implementation

```tsx
<motion.button layout transition={{ layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } }}>
  <AnimatePresence mode="popLayout">
    {isHomepage && (
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0, transition: { delay: 0.1 } }}
        exit={{ opacity: 0, x: -10 }}
      >
        {/* Prompt text */}
      </motion.span>
    )}
  </AnimatePresence>
</motion.button>
```

### Key Techniques

1. **`mode="popLayout"`**: Removes exiting elements from document flow immediately, allowing the container to resize without being held open by old content.

2. **Consistent height (`h-12`)**: Prevents vertical jitter during horizontal morph.

3. **`overflow-hidden`**: Clips content to rounded corners, preventing visual overflow during transition.

4. **Staggered timing**: Content fades out (200ms) before layout animates (400ms), and new content fades in after a 100ms delay.

## Command Palette

The Command Palette (`⌘K`) is the centerpiece of the site's interaction model. It features a distinct "morphing" animation when switching between **Search Mode** and **Slash Commands**.

### The "Grid Rows" Trick

To achieve the smooth height transition between the different modes without using heavy JavaScript libraries, we use the **CSS Grid Rows Animation** technique.

#### The Problem
CSS cannot natively transition `height` from `auto` to a fixed value (or vice-versa).

#### The Solution
We use a CSS Grid container and transition the `grid-template-rows` property from `0fr` (collapsed) to `1fr` (expanded).

```tsx
<div
  className="grid transition-all duration-300 ease-out"
  style={{ gridTemplateRows: isSlashCommandsMode ? "0fr" : "1fr" }}
>
  <div className="overflow-hidden">
    {/* Content goes here */}
  </div>
</div>
```

#### Why we chose this over Framer Motion
While libraries like Framer Motion offer powerful physics-based springs, we opted for this pure CSS approach for specific reasons:

1.  **Performance**: It runs entirely on the browser's compositor thread. Zero layout thrashing.
2.  **Bundle Size**: **0kb** overhead. Framer Motion would add ~30-50kb to the bundle.
3.  **Simplicity**: It solves the specific "height morph" problem without requiring a complex animation orchestration system.

### Morphing Logic

The palette uses a single container that morphs its dimensions and content:

1.  **Width**: Transitions between `max-w-[600px]` (Search) and `max-w-[400px]` (Slash Commands).
2.  **Height**: The content areas (Search Results vs. Slash Commands list) use the Grid Trick to cross-fade and resize simultaneously.
3.  **Opacity**: Content fades in/out (`opacity-0` ↔ `opacity-100`) in sync with the grid transition.

## Standard Patterns

### Hover States
Hover effects are designed to be "weighty" but responsive.
- **Buttons** (chrome — orbs, FAB, window pills): slight scale down on press to mimic physical resistance.
- **Media covers**: a dark wash over the art (`COVER_WASH`), the iOS Photos / Home Screen dim — never a scale of the card.
- **Links**: Opacity changes or subtle underlines.

### Page Transitions

We use the **View Transitions API** via `next-view-transitions` for smooth page-to-page navigation.

#### Setup

```tsx
// app/layout.tsx
import { ViewTransitions } from "next-view-transitions";

<ViewTransitions>
  <html>...</html>
</ViewTransitions>
```

#### Link Navigation

```tsx
// Use library's Link component
import { Link } from "next-view-transitions";

<Link href="/writing">Blog</Link>
```

#### Programmatic Navigation

```tsx
import { useTransitionRouter } from "next-view-transitions";

const router = useTransitionRouter();
router.push("/path"); // Triggers view transition
```

#### Transition Styles

```css
/* Root content crossfades (200ms) */
::view-transition-old(root) {
  animation: fade-out 200ms ease-out both;
}
::view-transition-new(root) {
  animation: fade-in 200ms ease-out both;
}

/* Shared elements morph position */
[data-view-transition="site-identifier"] {
  view-transition-name: site-identifier;
}
::view-transition-group(site-identifier) {
  animation-duration: 300ms;
}
```

#### Shared Elements

Elements with matching `view-transition-name` morph between pages:

```tsx
// Add data attribute to matching elements
<span data-view-transition="site-identifier">λhux</span>
```

The `λhux` identifier morphs from center (homepage) to left (content pages).

#### Widget Morph

A home widget opens its page the way an iOS widget opens its app: the card
grows into the screen and the page is what it grows into. Every in-site link
inside a card does it too (a post row opens its post out of the writing card).
Leaving the page is a quick fade-out over home, not the flight backwards: a
page folding back into a card read as noise.

The open is one name, `widget-morph`, worn by the tapped card before the
navigation and by the page's `:root` (the viewport) after it, so the browser
draws one group travelling from the card's box to the screen, while home (the
`root` group) leans in behind it.

- `components/ui/widget-morph.ts` holds the phase on
  `html[data-widget-morph]`: `open` while the card grows, `opened` while on
  the page it opened. `WidgetShell` marks itself `data-morph-source` on the
  tap (click capture, before the router starts the transition).
- CSS decides who wears the name: the marked card, or `:root` when no card is
  marked. Snapshots are `object-fit: cover` from the top, clipped to the group
  with the corner radius animating `1rem` → `0`.
- From `opened`, any transition (home, onward, the theme) fades the page's
  snapshot out in 160ms over the new state, which sits still beneath it.
- An open never waits on the network. `next-view-transitions` resolves a
  transition's update only once the route commits, and the browser holds the
  page frozen until then. The open races that against 120ms: a page that
  lands in time is what the card grows into; one that does not gets a launch
  screen — home with its content hidden, i.e. the bare wallpaper — which the
  card grows into at once, and the page renders onto it when it lands. Cards
  also prefetch their `href`, so the launch screen is the exception.
- A back swipe the browser already animated (`hasUAVisualTransition`) skips
  the fade; reduced motion and browsers without View Transitions skip it all.
- **Phones only** — more exactly, only where the card is at least 80% of the
  screen's width, which is the one-column grid (`fillsScreenWidth`). The
  morph depends on that ratio. On a 390px phone the card is 88% of the width:
  the page arrives at 88% scale with its title exactly where the card's was.
  On a 1440px desktop the card is 23% × 26%: the page arrives at a quarter
  scale (4px text), its title 60px off the card's, growing into a
  full-screen window the page does not have — it is a 680px column on the
  wallpaper. A tablet or a phone on its side is the desktop case, milder.
  Wider grids get the plain crossfade.
- **Devtool › Widgets › Open morph**: `off` / `phone` / `everywhere` (a saved
  setting, `WIDGET_MORPH_DEFAULT` in `systems/devtool/provider.tsx`).
  `everywhere` lifts the one-column limit, to compare. Off, `WidgetShell`
  never calls into `widget-morph.ts`: no wrapper, no marks, no prefetch on
  press — every navigation is exactly the plain crossfade.

**Cost.** Measured on a production build with CDP tracing, the same tap with
the morph off and on:

- Main thread: the same style, layout and paint work (≈20ms style, ≈5ms
  layout, ≈2.5ms paint over the whole transition, in the same event counts).
  The morph adds nothing per frame, and the time from tap to the first
  animated frame is the same.
- GPU: ≈12ms of compositing per frame against ≈11ms for the crossfade (on a
  software GPU, so the ratio is what counts). It runs for 450ms instead of
  200ms, so the total is about twice. The dim is opacity over black, not
  `filter: brightness()`, which cost a sixth more per frame for a
  whole-screen render pass.
- Navigation and data: the update never waits longer than the route does,
  or 120ms if that is longer (see the launch screen above); nothing is
  fetched at load — the press prefetches the card's own page, which the tap
  would fetch a moment later anyway.
- Like every view transition in Chrome, the group's size animation is ticked
  on the main thread and input waits for it, which is why it is 450ms: the
  curve is ~95% there by 300ms.

#### Widget Flip (the Motion take)

Devtool › Widgets › Open morph › **Flip** swaps the view-transition morph for
`components/ui/widget-flip.ts`: no view transition runs (the router's is
skipped before it captures anything, in the same wrapper), and one Motion
spring drives a rectangle from the card's box to the page's — the viewport on
a phone, the page's 680px column on a wider screen, a shape the page actually
has. Before the route commits, a frame wears it (the card's copy on panel
glass, over a home that fades back); after, the page's own `main` does,
FLIP'd: scaled by the rectangle's width over its own, moved onto it, clipped
to its height and corners. The glass fades once the spring settles.

What it buys over the morph: nothing is frozen while the route loads, what
grows is live DOM rather than a picture, the spring has give, and a desktop
card opens into a column instead of a quarter-scale screen. What it costs: the
home cannot stay behind (the route replaces it), and there is no gesture.

Measured the same way (390×844, software GPU): ≈7ms compositing a frame
against ≈11 for the plain crossfade — no snapshots, no blur. A 24px backdrop
blur on the growing glass made it ≈19, so the glass is a denser tint instead.
Main thread: ≈8ms more layout over the whole open (the frame's size, before
the route commits), and Motion's per-frame writes.

### Component Animations

Individual components (like the Command Palette or Modals) use `animate-in` and `fade-in` utility classes (powered by `tw-animate-css` and Tailwind) to enter the stage smoothly.

```css
/* Example utility usage */
animate-in fade-in zoom-in-95 duration-200
```
