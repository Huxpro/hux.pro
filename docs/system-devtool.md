# Devtool System

The devtool system provides **developer tools** for debugging and testing the ambient subsystem without affecting production users.

## Overview

```
systems/devtool/
├── provider.tsx       # DevtoolProvider with FAB state
├── panel.tsx          # Debug FAB and expandable panel
└── index.ts           # Barrel exports
```

## Key Features

### Dragging

Only the collapsed pill and the panel's title bar are drag handles
(`withDraggable(..., { dragHandle: "[data-drag-handle]" })`); the module
bodies keep their own gestures so range inputs, text fields and scrolling
inside the panel work.

### FAB Toggle

The devtool FAB can be enabled/disabled via:
- Command palette (`D` in slash commands mode)
- Settings in the command palette
- Direct toggle in the devtool panel

### Keyboard Shortcut

| Key | Action |
|-----|--------|
| `D` | Toggle devtool panel (when FAB is enabled) |

## Components

### DevtoolFAB

Floating action button that expands into the debug panel:

```tsx
<DevtoolFAB />
```

- Positioned top-right
- Hidden when FAB is disabled
- Expands to reveal `DevtoolPanel`

### DevtoolPanel

Debug modules for the ambient system:

1. **Gradient**: Override the resolved placement flags (full / widget / soft edge)
2. **Wallpaper**: Background source, light/dark appearance, built-in hot-swap
3. **Weather**: Override weather condition (day/night × 6 conditions)
4. **Time of Day**: Override ambient phase
5. **Refetch**: Force re-fetch location/weather

## Hooks

### useDevtool

```typescript
const {
  isEnabled,        // Whether devtool is enabled
  isOpen,           // Whether panel is expanded
  toggle,           // Toggle panel
  open,
  close,
  toggleEnabled,    // Toggle devtool enabled state
  setEnabled,       // Set devtool enabled directly
} = useDevtool();

// Legacy alias
const { ... } = useDebug();
```

## Debug Overrides

### Weather Override

Override the effective weather condition and day/night state:

```typescript
const { setDebugOverride, setOverrideEnabled } = useWeather();

// Set to rainy night
setDebugOverride({ condition: "rain", isDay: false });
setOverrideEnabled(true);
```

### Time Override

Override the ambient phase:

```typescript
const { setOverridePhase, setOverrideEnabled } = useAmbientTime();

// Set to sunset
setOverridePhase("sunset");
setOverrideEnabled(true);
```

### Wallpaper Debugging

The Wallpaper module drives the real (persisted) settings rather than an
ephemeral override, so the panel and the picker sheet can never disagree:

```typescript
const { setSource, selectWallpaper, setAppearance } = useWallpaper();

setSource("picture");        // Swap the background source, crossfaded
selectWallpaper("monterey"); // Hot-swap the built-in, no reload
setAppearance("dark");       // Pin a half of the light/dark pair
```

It also reads out what is actually painting (`Sequoia · dark`) and the resolved
placement, which is the fastest way to see why a background looks wrong.

## Persistence

- **FAB enabled state**: Persisted to localStorage
- **Override states**: Ephemeral (reset on page refresh)
- **Route preferences**: Persisted to localStorage

## Integration with Ambient

The devtool system **depends on** the ambient system:
- Reads weather/location/time state
- Writes debug overrides
- Uses `isEnabled` to gate debug features

```
DevtoolProvider
    ↓ reads/writes
AmbientProvider (useWeather, useAmbientTime)
```
