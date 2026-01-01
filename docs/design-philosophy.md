# Design Philosophy

## Overview

Hux.Pro is a personal website that embodies a **"System UI" aesthetic**—drawing inspiration from developer tools, command palettes, and native OS interfaces rather than typical marketing-focused web design.

## Dual Aesthetic System

| Context | Vibe | Where Applied |
|---------|------|---------------|
| **Content UI** | Minimal, breathable, editorial | Blog posts, talks, career content |
| **System UI** | Liquid Glass, dimensional, tactile | Command palette, nav, modals, buttons |

### Content-Oriented UI
> "A well-printed essay on a modern screen"

- Borderless design — no cards, no boxes
- Typography-first hierarchy
- Generous whitespace; let content breathe
- Invisible grids, not visible containers

### System/App UI
> "Linear-like productivity surface inside a calm editorial space"

- Frosted glass: `backdrop-filter: blur()`, 0.7–0.9 opacity
- Layered shadows: ambient + directional
- Subtle gradients suggesting light source
- Micro-animations that feel physical
- Hover states: responsive, weighty

## Homepage Vision

```
┌─────────────────────────────────────────────┐
│                                             │
│                    Hux                      │
│                                             │
│           evening. december.                │  ← ambient awareness
│                                             │
│   ╭─────────────────────────────────╮       │
│   │  On Design Systems              │       │  ← living surface
│   ╰─────────────────────────────────╯       │
│                                             │
│         what brings you here?               │  ← conversational
│         ┌───────────────────┐               │     prompt
│         │ _                 │               │
│         └───────────────────┘               │
│                                             │
│                    ⌘K                       │  ← hint
│                                             │
└─────────────────────────────────────────────┘
```

## Core Principles

### 1. Quiet Confidence

The design prioritizes content over chrome. Rather than flashy animations or attention-grabbing elements, the interface recedes to let writing and work speak for itself.

- **Muted color palette**: Grayscale with subtle contrast differences
- **Minimal ornamentation**: No decorative elements that don't serve a function
- **Understated interactions**: Hover effects are subtle reveals, not dramatic transformations

### 2. Keyboard-First Navigation

The site treats keyboard navigation as a first-class citizen, inspired by tools like Raycast, Alfred, and VS Code's command palette.

- **Command palette** (`⌘K`): Central navigation hub
- **Action mode** (`/`): Quick single-letter shortcuts for power users
- **Global shortcuts**: Work anywhere on the site

### 3. Bilingual by Design

English and Chinese are treated as equal citizens, not as primary/translated content:

- **Auto-detection**: First visit detects browser language
- **Persistent preference**: Stored in localStorage for subsequent visits
- **Per-content language**: Posts can be in EN, ZH, or both

### 4. Progressive Disclosure

Information is revealed on demand rather than overwhelming upfront:

- **Blog list**: Shows only title and date; hover reveals excerpt
- **Command palette**: Search mode for browsing, action mode for quick access
- **Settings**: Integrated into command palette, not cluttering the main UI

## Inspirations

- **Raycast**: Command palette UX, action mode concept
- **Linear**: Clean, monospace-accented typography
- **Vercel**: Understated dark mode, attention to spacing
- **iA Writer**: Prose-focused reading experience
- **macOS System Preferences**: Native UI patterns

## Anti-Patterns

What this design explicitly avoids:

- ❌ Hero images/illustrations
- ❌ Gradient backgrounds
- ❌ Animated blob shapes
- ❌ Social proof/testimonials
- ❌ Cookie banners and popups
- ❌ Fixed navigation bars taking up vertical space
- ❌ "AI slop" aesthetics (purple gradients, Inter font, generic layouts)
