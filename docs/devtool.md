# DevTool

The DevTool provides a floating debug panel for development and testing.

## Overview

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

## Features

### Wallpaper

Kind (weather / image), built-in pair, Auto / Light / Dark, and an ephemeral override for previewing without writing `localStorage`. See [system-wallpaper.md](./system-wallpaper.md).

### Weather Override

Test the ambient weather gradient with any weather condition:

| Category | Conditions |
|----------|------------|
| Clear | Clear, Sunny |
| Cloudy | Partly Cloudy, Cloudy, Overcast, Fog |
| Rain | Drizzle, Rain, Heavy Rain, Freezing Rain |
| Storm | Thunderstorm |
| Snow | Snow, Heavy Snow, Sleet |

Combined with Day/Night toggle to preview all gradient variations.

### Debug State

The panel shows:
- Current location mode (IP/Accurate)
- Whether override is enabled
- Current weather condition (real or override)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Toggle DevTool panel (when FAB is enabled) |

The `D` shortcut only works when:
- Not in an input field
- Command palette is closed
- No modifier keys pressed

## Visibility

### Default Behavior

| Environment | FAB Visible |
|-------------|-------------|
| Development | ✅ Yes (auto-enabled) |
| Production | ❌ No (hidden by default) |

### Manual Control

Enable/disable via:
- Command palette: Search "Debug" → Toggle
- DevTool panel footer: "Disable Devtool" button
- Programmatically: `useDevtool().setEnabled()`

Setting is persisted to `hux_devtool` in localStorage.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DEVTOOL COMPONENTS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   systems/devtool/                                                  │
│   ├── provider.tsx          DevtoolProvider + useDevtool hook       │
│   ├── panel.tsx             DevtoolFAB + panel UI                   │
│   └── index.ts              Barrel exports                          │
│                                                                     │
│   State lives in:                                                   │
│   ├── DevtoolContext        Enabled state, panel open               │
│   └── WeatherContext        Override condition, isDay               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
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

## Key Files

| File | Purpose |
|------|---------|
| `systems/devtool/provider.tsx` | DevtoolProvider + useDevtool |
| `systems/devtool/panel.tsx` | FAB and panel UI |
| `systems/devtool/index.ts` | Barrel exports |
