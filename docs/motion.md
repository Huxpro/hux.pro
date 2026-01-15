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
- **Buttons**: Slight scale down (`active:scale-[0.98]`) on press to mimic physical resistance.
- **Links**: Opacity changes or subtle underlines.

### Page Transitions
We use standard Next.js routing, but individual components (like the Command Palette or Modals) use `animate-in` and `fade-in` utility classes (powered by `tw-animate-css` and Tailwind) to enter the stage smoothly.

```css
/* Example utility usage */
animate-in fade-in zoom-in-95 duration-200
```

## See Also

- [Navigation](./navigation.md) — Detailed UX design for command palette and floating action button
- [Design Philosophy](./design-philosophy.md) — Overall design principles and aesthetic
