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

1. **Wallpaper**: the whole background system — a Weather / Image switch and
   one row showing the current picture and its resolution, which opens the
   picker and folds the panel (choosing among the catalog is the picker's
   job, and the picker is about the page behind it), placement switches
   (full / widget / soft edge), the bezel switch and its tint (black / dark /
   theme / custom), band and radius, a window / container scroll switch, the
   reading treatment switches (reading blur / reading dim),
   and the resolved asset. Under Weather two more rows: **Style** (Sky /
   Gradient / Classic — the persisted choice, the same three tiles the picker
   shows) and **No WebGL2** (a session switch that pretends WebGL2 is missing,
   so the Sky's fallback can be seen here; style and engine are otherwise
   one-to-one, so there is no engine picker). The last line reads the live
   engine back: `GL · 1266×791 · 0.88× · 6.4ms` (internal resolution, adaptive
   scale, frame time), or `CSS · Gradient` / `CSS · Classic`, with a note when
   the Sky had to fall back.
   Full and Widget are *independent* switches, not two halves of one control:
   the persisted setting can only be one of them, but the panel exists to see
   combinations the setting cannot express. They drive ephemeral overrides, and
   a `*` next to a label marks one; clicking the note under them clears all
   three back to the setting.
2. **Glass**: Material — Tinted (色调) / Clear (透明); Tint — Neutral /
   Wallpaper; a one-line readout of what the legibility policy resolved for
   the wallpaper that is painting (`flipped · busy · relief · +ink · +glass`),
   and a link to the Legibility Lab (`/editor/legibility`), where every one of
   those numbers is a slider. See `docs/system-legibility.md`.
3. **Sky**: weather and time as one thing, because the wallpaper is a function
   of both. A status line (condition · phase · clock · sun elevation · moon
   phase), a day timeline painted with the sky's colours for the current
   condition with a draggable playhead and ▶ play, phase names that jump the
   clock, the six conditions previewed at the effective hour (click again to
   return to live), the date slider that moves the moon, and a folded Tune
   row of scene sliders. **Now** resets everything.
4. **Command**: **Phone palette** — Sheet (the bottom sheet the palette is on a
   phone) / Popover (the desktop card at phone width, the palette as it was).
   A saved setting, so a blue `*` marks it and resets it. Lets the two be
   compared on the same device; the popover code path is kept whole for it.
5. **Refetch**: Force re-fetch location/weather

## Controls

Rows are `PanelRow` (label left, control right) with a `PanelStar` when a
value is not at its default; switches are `PanelToggle`; choices are
`PanelSegmented`; numbers are the shared `Slider` from `components/ui/slider.tsx` (via
`PanelRange` / `PanelSlider`), the same one the Legibility Lab and the icon
studio use — an ink track with the platform's native thumb on touch. Only the Sky timeline's playhead
is its own range input.

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

Force a condition. Day/night is never part of it — the clock decides, so a
forced condition can't put a moon in a daytime sky:

```typescript
const { setDebugOverride, setSceneOverrides } = useWeather();

setDebugOverride({ condition: "rain" }); // null → back to the real weather
setSceneOverrides({ precipitationIntensity: 1 }); // heavy
```

### Time Travel

There is no phase override; there is one clock, and moving it moves the sun,
the moon, the sky, the phase, the greeting and the sun-event notice together:

```typescript
const { setTimeScrubMinutes, setDayOffset, resetTimeTravel } = useAmbientTime();

setTimeScrubMinutes(22 * 60); // 22:00 today
setDayOffset(11);             // eleven days on — a different moon
resetTimeTravel();            // back to now
```

### Wallpaper Debugging

The Wallpaper module drives the real (persisted) settings rather than an
ephemeral override, so the panel and the picker sheet can never disagree:

```typescript
const { setKind, selectWallpaper, selectWeather } = useWallpaper();

setKind("image");            // Swap the background kind, crossfaded
selectWallpaper("monterey"); // Hot-swap the pair, no reload
selectWeather("classic");    // Back to weather, the original palettes
```

It reads out what is actually painting — `Now: Sonoma · dark · full · desktop
@0.62`, where the last field says whether this route is the desktop or a reading
surface — and prints the resolved asset path underneath, which is the fastest
way to trace a wrong-looking background to a file.

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
