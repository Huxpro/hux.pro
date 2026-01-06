# Navigation System

## Command Palette

The command palette is the central navigation hub, inspired by Raycast, Spotlight, and VS Code.

### Opening Methods

| Method | Where | Action |
|--------|-------|--------|
| `⌘K` / `Ctrl+K` | Anywhere | Open in **Search Mode** |
| `/` (anywhere) | Anywhere | Open in **Action Mode** |
| Conversational prompt | Homepage | Open in Search Mode |
| FAB button | Non-homepage pages | Open in Search Mode |

### Homepage Entry Point

On the homepage, the FAB is replaced by a **conversational prompt**—an inline button styled as a search input with the placeholder "what brings you here?". This creates a more inviting, dialogue-like entry point that fits the AI-native OS aesthetic.

The FAB remains visible on all other pages (`/blog`, `/career`, `/talks`, etc.) for consistent command palette access.

### Two Modes

The command palette has two distinct modes that morph smoothly between each other:

#### Search Mode (Default)
- Full-text search across pages, posts, and talks
- Arrow keys to navigate, Enter to select
- Shows all content with descriptions
- Width: 600px

#### Action Mode
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
| `/` | Switch to Action Mode |
| `Esc` | Close palette |

#### In Action Mode

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

#### Why `/` for Action Mode?

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
↑↓ navigate   ↵ select   / actions          ⌘K
```

**Action Mode:**
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

- FAB (Floating Action Button) in bottom-right for command palette access (hidden on homepage)
- Conversational prompt on homepage serves as primary entry point
- Command palette is responsive (full width on small screens)
- Touch-friendly tap targets
- Widget grid stacks vertically on mobile
