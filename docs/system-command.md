# Command System

The command system provides **keyboard-first navigation** through a modal command palette, inspired by tools like Raycast and VS Code.

## Product Design

### Core Experience

The command palette serves as the central navigation hub, replacing traditional navigation bars. It offers two distinct modes:

1. **Search Mode** (⌘K): Fuzzy search across all content and navigation
2. **Slash Commands** (/): Single-key shortcuts for instant actions

### Dual Modes

**Search Mode** - Full-text search across navigation, settings, and content:
- Navigate to pages (Home, Projects, Prose, Productions, Docs)
- Access settings (Appearance, Language, Location, Gradient)
- Search blog posts and talks
- Width: 600px

**Slash Commands** - Single-letter shortcuts for quick actions:
- No search input—just press a letter
- Minimal UI showing only available actions
- Width: 400px

### Keyboard Shortcuts

#### Global Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Toggle command palette (opens in Search Mode) |
| `/` | Open in Slash Commands mode |
| `Esc` | Close palette |

#### Slash Commands

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `E` | Go to Projects |
| `B` | Go to Prose |
| `T` | Go to Productions |
| `I` | Go to Docs (internal) |
| `A` | Toggle appearance (light/dark) |
| `L` | Toggle language (EN/中文) |
| `G` | Toggle geolocation mode |
| `W` | Toggle weather gradient |
| `D` | Toggle devtool FAB |
| `Backspace` | Back to Search Mode |

### Morphing Transition

Instead of opening/closing between modes, the palette **morphs**:
- Width animates (600px ↔ 400px)
- Content crossfades with opacity
- Height animates using CSS Grid (`grid-template-rows: 0fr/1fr`)

## Technical Architecture

### File Structure

```
systems/command/
├── provider.tsx       # CommandProvider with keyboard shortcuts
├── palette.tsx        # Command palette UI (cmdk-based)
├── fab.tsx            # Floating action button trigger
└── index.ts           # Barrel exports
```

### Searchable Content

The palette searches across:

1. **Navigation**: Home, Projects, Prose, Productions, Docs
2. **Settings**: Appearance, Language, Location, Gradient, Devtool
3. **Blog Posts**: Title, description, tags (both languages)
4. **Talks**: Title, event, description

### iOS Compatibility

Special handling for iOS Safari:
- Scroll position preservation on open
- Delayed autofocus to prevent keyboard jump
- Touch-friendly backdrop dismissal

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

## API Reference

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
