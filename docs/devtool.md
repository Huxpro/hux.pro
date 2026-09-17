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

### Sky (weather + time)

One module for everything the sky depends on. Test the weather wallpaper with
any weather condition:

| Category | Conditions |
|----------|------------|
| Clear | Clear |
| Cloudy | Cloudy, Fog |
| Rain | Rain |
| Storm | Thunder |
| Snow | Snow |

Click a condition to force it; click it again to go back to the live weather
(the live one wears a green dot). Day/night is not a choice: it follows the
clock above, so a "night rain" preview is a jump to Night plus Rain, and the
chips themselves swap to their night faces when the clock does.

The clock is a day timeline painted with the sky's own colours for the current
condition, sunrise and sunset ticked on it; drag the playhead, click a phase
name to jump there, or press ▶ **Day** (or ▶ **2×**) to play from wherever the
playhead is, looping through midnight — a minute for the day, or half of one.
Pressing the lit one pauses; pressing the other changes speed without starting
over. The date slider moves the
calendar day (the moon's phase). A folded **Tune** row holds sliders over the
derived scene — cloud cover, precipitation intensity, wind speed and the theme
veil — with the raw API numbers underneath. **Now** in the corner puts all of
it back.

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
  condition: WeatherCondition; // day/night follows the clock, never this
}

// In WeatherContext — null means the real weather
debugOverride: WeatherDebugOverride | null;
sceneOverrides: SceneOverrides; // cloud / precip / wind / veil tweaks

// In AmbientTimeContext — time travel
timeScrubMinutes: number | null;
dayOffset: number;
```

The override is **ephemeral** - it resets on page refresh. This is intentional for development/testing use.

## Key Files

| File | Purpose |
|------|---------|
| `systems/devtool/provider.tsx` | DevtoolProvider + useDevtool |
| `systems/devtool/panel.tsx` | FAB and panel UI |
| `systems/devtool/index.ts` | Barrel exports |
