# Command System

The command system provides **keyboard-first navigation** through a modal
command palette, inspired by macOS Spotlight, Raycast, and VS Code. It is
dual-purpose: a universal search **and** an **app launcher**.

## Overview

```
systems/command/
├── provider.tsx       # CommandProvider with keyboard shortcuts
├── palette.tsx        # Command palette UI (cmdk-based)
├── apps-launcher.tsx  # Spotlight-style horizontal Apps strip
├── load-bundle-panel.tsx  # System UI OTA Lynx bundle form
├── fab.tsx            # Floating action button trigger
└── index.ts           # Barrel exports
```

## Key Features

### Dual Modes

1. **Search Mode**: Fuzzy search across navigation, settings, content, and apps
2. **Slash Commands**: Single-key shortcuts for quick actions

### App launcher (Spotlight-style)

When the Window system is mounted, ⌘K also launches apps from
`content/apps.json` via a headerless **horizontal icon strip**
(`systems/command/apps-launcher.tsx`):

- Same presentation for browse and search — cmdk filters icons in place
- Strip scrolls horizontally when the catalog overflows
- Group hides entirely when no app matches the query
- Real snapshot tiles via shared `AppTile`

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
| `U` | Go to Writing |
| `X` | Go to Works |
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
- Blog posts search
- Apps launcher with real app icons (grid + list)
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
```

## Searchable Content

The palette searches across:

1. **Apps**: Horizontal icon strip (filtered in place; hidden when no match)
2. **Navigation**: Home, Writing, Works, Docs
3. **Settings**: Appearance, Language, Location, Gradient, Music, Devtool
4. **Blog Posts**: Title, description, tags (both languages)

## iOS Compatibility

Special handling for iOS Safari:
- Scroll position preservation on open
- Delayed autofocus to prevent keyboard jump
- Touch-friendly backdrop dismissal
