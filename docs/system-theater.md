# Theater System

The video player: one persistent player (`systems/theater/provider.tsx`) that
survives mode and route changes, the way the Music system's does, surfaced in
whichever shape suits the moment. A talk recording and a slide deck are both
tracks on the same stage (`lib/types.ts`); albums are the home widget's
curated playlists (`lib/albums.ts`).

| Shape | Where | File |
|-------|-------|------|
| Theater | the immersive modal, tablet and up | `components/theater-overlay.tsx` |
| PiP | a floating tile (tablet and up), a card under the dock (phone) | `components/pip-overlay.tsx` |
| Audio | a Live Activity in the dock | `components/theater-activity.tsx` |
| Playlist | albums and tracks, a sheet / panel / window | `components/playlist-sheet.tsx` |

The video itself is always the one `<Stage />` (`components/stage.tsx`), a
fixed box the provider moves between shapes and never remounts. Every piece
of chrome reads the same `rect` from the provider (`lib/geometry.ts`), so it
lines up with the video while both are moving.

## PiP: the tile (tablet and desk)

The PiP tile is all picture. Nothing sits under or beside the video: the
controls are drawn over it when asked for, and the gestures are the ones the
system PiP on iOS and Android already taught.

| Gesture | Does |
|---------|------|
| tap (finger) | controls in; they leave 2.5s after the last touch while the video plays, and stay while it is paused |
| hover (mouse) | controls in; out 300ms after the pointer leaves |
| click (mouse) | play / pause, as on the video everywhere else |
| double-tap / double-click | the other size: small ⇄ large |
| drag | the tile follows the pointer |
| release | thrown to the nearest corner, judged by where the throw was headed (200ms of the release velocity), not by where the pointer stopped |
| throw past a side edge | stashed there, 28px left on screen as a handle; the sound keeps playing, and a tap on the handle (or a drag) brings it back |

Where it is resting is a **placement**, not a position: a corner, a size and
a stash (`PipPlacement`). Coordinates are derived from it and the viewport on
every render (`pipRect`), so a rotation or a resize keeps the tile in its
corner. Only a drag in progress carries coordinates (`pipDrag`), and a
release turns them back into a placement (`pipSettle`). The corner and size
outlive a session; a stash does not (the next video opens on screen).

The two sizes are a share of the viewport's width with a ceiling: small is
`min(56vw, 280px)`, large `min(92vw, 400px)`. Both keep the video over the
≈200px the YouTube IFrame API wants for its ready handshake on any phone over
~360px wide. The corners clear the dock's pill row at the top (`PIP_TOP_STOP`)
and the command bar at the bottom.

### What the overlay can drive

That depends on what is playing.

- **A YouTube video** is ours to drive through the IFrame API. A transparent
  gesture layer takes the whole picture, and the overlay carries close, the
  playlist, Audio, Theater (where it fits), previous / play / next, the title
  (when the tile is wide enough) and a scrubber.
- **Anything else** (a Bilibili or Vimeo embed, a reveal.js deck) can only be
  driven from inside its own frame. The frame keeps the picture, so its own
  controls and a deck's taps still work, and the tile is held by a strip
  along its top edge instead: close, a grip to drag by, the playlist, Audio
  and Theater. The strip is always there. A pointer over a cross-origin frame
  tells this document nothing, so there is no hover or tap to reveal it with.

### Escape

Escape closes the theater, which is a modal. It does nothing to PiP. The tile
is not modal, and an Escape pressed while it was up was almost always meant
for something else (a menu, a sheet); it used to end the video and lose its
place.

## PiP on a phone: one object with the dock

A phone is too narrow for a tile to be anywhere but in the way, and the top
of its screen is where the playlist needs the video to be. So on a phone
(under the `sm` breakpoint, `pipCard` in the provider) PiP is not a tile. It
is a card hanging under the dock's pill row, the Live Activity panel's width,
and the player becomes one object in three sizes, anchored at the top like
Notification Center:

| Size | What it is | Get there by |
|------|------------|--------------|
| pill | the theater's Live Activity in the dock: sound only | push the card up, or its minimize button |
| card | the video, with a row under it (title, play, next, minimize, close) | tap or pull down on the pill |
| card + list | the card, with the playlist sheet taking the screen under it | pull the card down, or tap its row or grabber |

Pull down and it grows; push up and it shrinks. A pull past 48px, or a flick
faster than 0.4px/ms, changes size; less springs back. Downward travel is
damped (it is a pull on something anchored); upward follows the finger.

The pill does not open its panel on a phone. `LiveActivity` takes an
`onActivate`, which a press on the pill (or Enter, or a pull down from it)
calls instead; the theater passes `toPip`, because the card is the panel
there, and it has the picture.

The card sits at the top already, so it and the playlist split the screen
with nothing to move: the sheet's top detent is the card's resting bottom
edge (`pipCardBox`, `playlistDetents`), held still while the card is being
pulled. On a drivable video a tap on the picture brings the same overlay the
tile has (transport, scrubber, the playlist toggle), and close and minimize
are in the row, where a thumb finds them without opening anything.
