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

1. **Route Gradient**: Toggle gradient per route pattern
2. **Weather**: Override weather condition (day/night × 6 conditions)
3. **Time of Day**: Override ambient phase
4. **Refetch**: Force re-fetch location/weather

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

### Route Gradient Override

Override gradient enabled state per route:

```typescript
const { setRouteGradientPreference } = useWeather();

// Enable gradient on /writing
setRouteGradientPreference("/writing", true);
```

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
