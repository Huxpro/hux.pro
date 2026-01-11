# Navigation System

## Command Trigger

The **Command Trigger** is a unified floating component that provides consistent access to the command palette across all pages. It morphs between three states based on context and screen size:

```
Mobile (non-home)     Desktop (non-home)      Homepage (any)
+---------+           +-------------+         +---------------------------+
|   ⌘     |  <--->    |  ⌘K         |  <--->  | 🔍  Search...     [⌘K]   |
+---------+           +-------------+         +---------------------------+
   FAB                   Pill                   Conversational Prompt
```

### State Determination

| Screen | Page | Variant | Position |
|--------|------|---------|----------|
| Mobile | Homepage | Prompt (compact) | Bottom center |
| Mobile | Other | FAB (circle) | Bottom right |
| Desktop | Homepage | Prompt (full) | Bottom center |
| Desktop | Other | Pill | Bottom right |

### Design Decisions

#### Unified Component
Previously, the FAB and Conversational Prompt were separate components with different styles and positions. The new unified approach:
- Uses a single `FloatingActionButton` component
- Shares the same glass styling across all states
- Animates smoothly between states during navigation

#### Glass Styling
All variants share the "frosted glass" aesthetic:

```tsx
"bg-card/50 backdrop-blur-xl",
"border border-border/50",
"shadow-lg shadow-black/5"
```

#### Animation Strategy
The morph uses Framer Motion's `layout` prop with staggered content transitions:

1. **Exit Phase**: Text content fades out first (opacity + x-translation)
2. **Reshape Phase**: Container morphs size/position (layout animation)
3. **Enter Phase**: New content fades in after reshape completes

This "stagger and reshape" approach ensures:
- Smooth contour continuity (no border-radius clipping)
- Content doesn't overflow during transition
- Stable animation origin point

#### Consistent Height
All states maintain `h-12` (48px) height to eliminate vertical jitter during transitions.

#### Responsive Text

| State | Mobile | Desktop |
|-------|--------|---------|
| Homepage | "Search" | "Search or / for commands" |
| Other | ⌘ icon only | ⌘K |

### Interaction States

- **Homepage (Prompt)**: Focus ring effect (`focus:ring-2`) — feels like an input field
- **Other pages (FAB/Pill)**: Scale effect (`active:scale-95`) — feels like a button

## Command Palette

The command palette is the central navigation hub, inspired by Raycast, Spotlight, and VS Code.

### Opening Methods

| Method | Where | Action |
|--------|-------|--------|
| `⌘K` / `Ctrl+K` | Anywhere | Open in **Search Mode** |
| `/` (anywhere) | Anywhere | Open in **Slash Commands** |
| Conversational prompt | Homepage | Open in Search Mode |
| FAB button | Non-homepage pages | Open in Search Mode |

### Homepage Entry Point

On the homepage, the Command Trigger expands into a **conversational prompt**—a wide button styled as a search input with the placeholder "Search" (mobile) or "Search or / for commands" (desktop). This creates a more inviting, dialogue-like entry point that fits the AI-native OS aesthetic.

When navigating away from the homepage, the prompt smoothly morphs into a compact FAB (mobile) or pill (desktop) positioned in the bottom-right corner.

### Two Modes

The command palette has two distinct modes that morph smoothly between each other:

#### Search Mode (Default)
- Full-text search across pages, posts, and talks
- Arrow keys to navigate, Enter to select
- Shows all content with descriptions
- Width: 600px

#### Slash Commands
- Single-letter shortcuts for immediate actions
- No search input—just press a letter
- Minimal UI showing only available actions
- Width: 400px

### Keyboard Shortcuts

#### In Search Mode

When the search input is empty or unfocused:

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `E` | Go to Career (Experience) |
| `B` | Go to Blog |
| `T` | Go to Talks |
| `D` | Toggle Dark/Light mode |
| `L` | Toggle Language |
| `/` | Switch to Slash Commands |
| `Esc` | Close palette |

#### In Slash Commands

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `E` | Go to Career |
| `B` | Go to Blog |
| `T` | Go to Talks |
| `D` | Toggle Dark/Light mode |
| `L` | Toggle Language |
| `⌫` (Backspace) | Back to Search Mode |
| `Esc` | Close palette |

### Design Decisions

#### Why Two Modes?

1. **Avoid browser conflicts**: `⌘D`, `⌘L`, `⌘H` conflict with browser shortcuts
2. **Separation of concerns**: Search is for discovery; actions are for execution
3. **Progressive disclosure**: Beginners use search; power users use actions

#### Why `/` for Slash Commands?

- Familiar from Vim, Slack, Discord
- Single non-modifier key for quick access
- Doesn't conflict with search (handled as first character)

#### Morphing Transition

Instead of opening/closing between modes, the palette **morphs**:
- Width animates (600px ↔ 400px)
- Content crossfades with opacity
- Height animates using CSS Grid (`grid-template-rows: 0fr/1fr`)

### Footer Hints

**Search Mode:**
```
↑↓ navigate   ↵ select   / commands         ⌘K
```

**Slash Commands:**
```
⌫ back                                       /
```

## Page Structure

Each page follows a consistent pattern:

1. **Back link** (top-left): Returns to parent page
2. **Header**: Title + subtitle (centered for blog list)
3. **Content area**: Main page content
4. **No fixed navigation**: Command palette replaces traditional nav

## Mobile Considerations

- **Unified Command Trigger**: Same component morphs between prompt (homepage) and FAB (other pages)
- **Compact prompt on mobile**: Shows only "Search" text instead of the full desktop message
- **FAB position**: Bottom-right corner with consistent `bottom-6 right-6` positioning
- Command palette is responsive (full width on small screens)
- Touch-friendly tap targets (`h-12` minimum)
- Widget grid stacks vertically on mobile
