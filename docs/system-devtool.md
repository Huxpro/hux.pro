# Devtool System

The devtool system provides **developer tools** for debugging and testing the ambient subsystem without affecting production users. It offers a floating debug panel for development and testing.

## Product Design

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEVTOOL FAB                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────┐                                                       │
│   │  🐛     │  ← Floating Action Button (bottom-right)              │
│   └─────────┘                                                       │
│        │                                                            │
│        ▼  (click)                                                   │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │  DevTool Panel                              [✕] [×FAB]  │       │
│   ├─────────────────────────────────────────────────────────┤       │
│   │                                                         │       │
│   │  Weather Override                                       │       │
│   │  ┌─────┬─────┬─────┬─────┬─────┬─────┐                 │       │
│   │  │ ☀️  │ 🌤️ │ ☁️  │ 🌧️  │ ⛈️  │ 🌨️  │  ← Conditions    │       │
│   │  └─────┴─────┴─────┴─────┴─────┴─────┘                 │       │
│   │  ┌──────────────┐ ┌──────────────┐                     │       │
│   │  │    ☀️ Day    │ │    🌙 Night  │  ← Time of day      │       │
│   │  └──────────────┘ └──────────────┘                     │       │
│   │                                                         │       │
│   │  [Enable Override]                                      │       │
│   │                                                         │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

#### Weather Override

Test the ambient weather gradient with any weather condition:

| Category | Conditions |
|----------|------------|
| Clear | Clear, Sunny |
| Cloudy | Partly Cloudy, Cloudy, Overcast, Fog |
| Rain | Drizzle, Rain, Heavy Rain, Freezing Rain |
| Storm | Thunderstorm |
| Snow | Snow, Heavy Snow, Sleet |

Combined with Day/Night toggle to preview all gradient variations.

#### Debug State

The panel shows:
- Current location mode (IP/Accurate)
- Whether override is enabled
- Current weather condition (real or override)

### Visibility

#### Default Behavior

| Environment | FAB Visible |
|-------------|-------------|
| Development | ✅ Yes (auto-enabled) |
| Production | ❌ No (hidden by default) |

#### Manual Control

Enable/disable via:
- Command palette: Search "Debug" → Toggle
- DevTool panel footer: "Disable Devtool" button
- Programmatically: `useDevtool().setEnabled()`

Setting is persisted to `hux_devtool` in localStorage.

## Technical Architecture

### File Structure

### File Structure

```
systems/devtool/
├── provider.tsx       # DevtoolProvider with FAB state
├── panel.tsx          # Debug FAB and expandable panel
└── index.ts           # Barrel exports
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Toggle devtool panel (when FAB is enabled) |

The `D` shortcut only works when:
- Not in an input field
- Command palette is closed
- No modifier keys pressed

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

## API Reference

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

// Enable gradient on /prose
setRouteGradientPreference("/prose", true);
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

### Context Interface

```typescript
interface DevtoolContextType {
  isEnabled: boolean;      // Whether devtool is enabled
  isOpen: boolean;         // Panel open state
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
}
```

### Override State

Weather overrides are stored in `WeatherContext`:

```typescript
interface WeatherDebugOverride {
  condition: WeatherCondition;
  isDay: boolean;
}

// In WeatherContext
debugOverride: WeatherDebugOverride | null;
isOverrideEnabled: boolean;
```

The override is **ephemeral** - it resets on page refresh. This is intentional for development/testing use.
