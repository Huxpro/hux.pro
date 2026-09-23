# Design Philosophy

## Overview

Hux.Pro is a personal website that embodies an **"AI-Native OS" aesthetic**—the homepage feels like encountering a personal operating system that recognizes you, rather than a static web page. Drawing inspiration from developer tools, command palettes, and native OS interfaces rather than typical marketing-focused web design.

## Dual Aesthetic System

| Context | Vibe | Where Applied |
|---------|------|---------------|
| **Content UI** | Minimal, breathable, editorial | Blog posts, talks, career content |
| **System UI** | Liquid Glass, dimensional, tactile | Command palette, widgets, modals, buttons |

### Content-Oriented UI
> "A well-printed essay on a modern screen"

- Borderless design — no cards, no boxes
- Typography-first hierarchy
- Generous whitespace; let content breathe
- Invisible grids, not visible containers

### System/App UI
> "Linear-like productivity surface inside a calm editorial space"

- Frosted glass: `backdrop-blur: blur()`, 0.7–0.9 opacity
- Layered shadows: ambient + directional
- Subtle gradients suggesting light source
- Micro-animations that feel physical
- Hover states: responsive, weighty

## AI-Native Homepage

The homepage is designed as a **personal OS surface**, not a traditional landing page. It embodies five key principles:

### 1. The Surface, Not the Desktop
Instead of a desktop with objects on it, think of a surface that reflects your current state. It's not empty space waiting to be filled—it's a mirror of what's relevant now.

### 2. Ambient Over Explicit
The OS knows things. Time of day. What you were last doing. What's changed. It doesn't wait for you to ask—it surfaces context gently.

### 3. Conversation as Navigation
The command palette isn't a search box—it's a dialogue. "What brings you here?" not "Type a command." The whole homepage is a subtle invitation to converse.

### 4. Fluid Boundaries
Sections don't have hard edges. Blog, Work, Talks—these aren't rooms, they're aspects. The homepage shows a blend via widgets, weighted by recency or relevance.

### 5. Presence, Not Structure
The homepage feels like encountering a person, not reading a directory. There's a sense of who's here before what's available.

## Homepage Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         hux_                                │  ← mono, small, muted
│                                                             │     (system identifier)
│                                                             │
│              good evening.                                  │  ← serif, large, hero
│              last time you were reading                     │     (Hux speaking to you)
│              On Design Systems.                             │  ← italic emphasis
│                                                             │
│                                                             │
│   ┌─────────────────────────────┐  ┌─────────────┐          │
│   │  On Design Systems          │  │  Currently  │          │  ← Widget Grid
│   │  The Future of Cross...     │  │  @ ByteD... │          │
│   │  On Developer Experience    │  ├─────────────┤          │
│   │                      Blog →│  │  Latest     │          │
│   └─────────────────────────────┘  │  Talk       │          │
│                                    └─────────────┘          │
│                                                             │
│              ┌───────────────────────────────┐              │
│              │ what brings you here? _   ⌘K │              │  ← conversational
│              └───────────────────────────────┘              │     prompt (input)
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visual Hierarchy

1. **System identifier** (`hux_`): Mono, small, muted—like a terminal prompt or OS watermark
2. **Message to user**: Serif, large, warm—the voice of Hux addressing the visitor directly
3. **Widget grid**: Glassmorphic cards with content discovery at a glance
4. **Conversational prompt**: The input itself contains the invitation ("what brings you here?")

### Hux as OS Voice

Hux speaks directly to the user, creating presence through address:

| Scenario | Hux Says |
|----------|----------|
| First visit, morning | "good morning." |
| First visit, evening | "good evening." |
| Returning, same day | "welcome back." |
| Returning, read something | "last time you were reading *[title]*." |
| Returning, long gap (>7 days) | "it's been a while." |

The voice is:
- Lowercase (calm, unhurried)
- Brief (not chatty)
- Warm but not effusive
- Acknowledges without demanding

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
- **Command palette**: Search mode for browsing, slash commands for quick access
- **Settings**: Integrated into command palette, not cluttering the main UI

### 5. Less, but Better

Design is how it works, so the test for a mark is what it *does*, not how it
looks. Before adding a label, a badge, an arrow or an icon, ask whether the
surface already says it. If it does, the mark is a second way of saying the
same thing, and it goes, or it waits until someone is paying attention.

- **One voice per layer.** The machine layer is lowercase mono (`jul 2020`,
  `retry`, `cd ~`). Labels are set as written; capitals and letter-spacing
  would be a second machine voice over the first.
- **Signifiers wait for attention.** A widget is its own tap target and a
  peeking cover says its strip scrolls. The header arrow and pager dots show
  when a pointer or focus is on the card, and never under a finger.
- **A preview previews.** A home card says what a thing is, in full, and its
  row opens the full entry. Outbound links and attachments live on the page
  the card leads to, not on the card at the title's expense.
- **Curation acts, it doesn't annotate.** `featured` decides what the home
  card surfaces. The archive is already complete and in date order, so it
  shows no badge.

Nothing here removes an experience: the wallpaper, the scramble, the peeks,
the theater, music, the apps and the palette all stay. What goes is the chrome
that repeated them.

## Inspirations

- **Raycast**: Command palette UX, slash commands concept
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
