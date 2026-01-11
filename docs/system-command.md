# Command System

The command system provides **keyboard-first navigation** through a modal command palette, inspired by tools like Raycast and VS Code.

## Overview

```
systems/command/
├── provider.tsx       # CommandProvider with keyboard shortcuts
├── palette.tsx        # Command palette UI (cmdk-based)
├── fab.tsx            # Floating action button trigger
└── index.ts           # Barrel exports
```

## Key Features

### Dual Modes

1. **Search Mode**: Fuzzy search across navigation, settings, and content
2. **Slash Commands**: Single-key shortcuts for quick actions

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Toggle command palette |
| `/` | Open in slash commands mode |
| `Esc` | Close palette |
| `Backspace` | Exit slash commands mode |

### Slash Commands Shortcuts

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `E` | Go to Projects |
| `B` | Go to Prose |
| `T` | Go to Productions |
| `I` | Go to Docs (internal) |
| `A` | Toggle appearance |
| `L` | Toggle language |
| `G` | Toggle geolocation |
| `W` | Toggle weather gradient |
| `D` | Toggle devtool FAB |

## Components

### CommandPalette

The main palette component using [cmdk](https://cmdk.paco.me/):

```tsx
<CommandPalette />
```

Features:
- Search across all navigation targets
- Settings quick actions
- Blog posts and talks search
- Bilingual search (EN/中文 keywords)

### FloatingActionButton

Context-aware FAB that morphs based on route:

```tsx
<FloatingActionButton />
```

- **Homepage**: Search bar with placeholder
- **Other pages**: Compact command button

## Hooks

### useCommand

```typescript
const {
  isOpen,
  isSlashCommandsMode,
  open,
  close,
  toggle,
  setSlashCommandsMode,
} = useCommand();

// Legacy alias also available
const { ... } = useCommandPalette();
```

## Searchable Content

The palette searches across:

1. **Navigation**: Home, Projects, Prose, Productions, Docs
2. **Settings**: Appearance, Language, Location, Gradient, Devtool
3. **Blog Posts**: Title, description, tags (both languages)
4. **Talks**: Title, event, description

## iOS Compatibility

Special handling for iOS Safari:
- Scroll position preservation on open
- Delayed autofocus to prevent keyboard jump
- Touch-friendly backdrop dismissal
