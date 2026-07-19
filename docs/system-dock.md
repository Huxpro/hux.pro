# Dock System

The dock is the top-of-screen home for **Live Activities** — collapsed pills
that morph into expanded panels (the iOS Dynamic Island / Notification Center
metaphor). It is the shared foundation for the "Global Player" UI: the music
player and the ambient phase notification are both dock activities and therefore
look and behave identically.

## Overview

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── components/
│   ├── dock.tsx                  # <Dock> — pill row layout + shared scrim
│   ├── live-activity.tsx         # <LiveActivity> — the pill ⇄ panel morph
│   └── index.ts
└── index.ts
```

## Why it exists

Before, the pill/panel/scrim/drag/Esc/route-collapse machinery lived inside
`MusicDock`. Adding a second notification (ambient phase changes) would have
meant copy-pasting all of it. The dock extracts that machinery once:

- **`LiveActivity`** owns the *visuals*: the collapsed pill shell, the expanded
  panel (header, body, grabber), the open/close animations, and drag-to-dismiss.
- **`DockProvider` / `useDock`** own the *coordination*: a single `openId`
  (only one panel open at a time), Esc-to-collapse, and route-change collapse.
- **`Dock`** owns the *layout*: a horizontal, centered, scrollable pill row plus
  the shared scrim.

Activities supply only content.

## Usage

```tsx
<Dock>
  <AmbientPhaseActivity />   {/* renders a <LiveActivity id="ambient-phase" /> */}
  <MusicActivity />          {/* renders a <LiveActivity id="music" /> */}
</Dock>
```

```tsx
<LiveActivity
  id="music"
  openLabel="Open music controls"
  collapseLabel="Collapse"
  pill={<>{/* leading pill content: art, EQ, icon… */}</>}
  title={<>{/* panel header left side */}</>}
>
  {/* panel body — bring your own padding */}
</LiveActivity>
```

## Layout & coexistence rules

These match the product spec for multiple simultaneous activities:

- **Collapsed:** pills sit side by side in a centered row. The row is
  horizontally scrollable (`.no-scrollbar`) once it gets crowded, so N pills
  scale gracefully.
- **Expanded:** the open activity's panel takes over the top-center anchor and
  **every pill is hidden**; collapsing restores the row. (Activities aren't
  individually dismissible, so we never strand a pill behind a panel.)
- **One at a time:** opening an activity collapses any other that was open.
- The pill row carries **no CSS transform**, so the `fixed` panels rendered by
  `LiveActivity` stay anchored to the viewport rather than to the row.

## Consumers

| Activity | Source | Pill | Panel body |
|----------|--------|------|------------|
| Music | `systems/music/components/music-activity.tsx` | album art + EQ | `<NowPlaying />` |
| Ambient phase | `systems/ambient/components/phase-activity.tsx` | sun icon + time | `<WeatherNow />` |
| Minimized apps | `systems/lynx-apps/components/minimized-apps-activity.tsx` | app icon + title | tech stack + Restore / Close |

Both reuse the same shared body component that their homepage widget uses
(`NowPlaying`, `WeatherNow`), so the dock panel and the grid widget never drift.
