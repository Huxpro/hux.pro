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
| Sidecar | a column docked at the right edge of a wide desk | `components/sidecar.tsx` |
| Native window | a real always-on-top window (Chromium desks) | `components/native-window.tsx` |
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

## The sidecar (wide desks)

A floating tile is always over something on a desk, and always has to be
moved off the next thing. The sidecar is the player as a place beside the
page instead: a column at the right edge (`sidecarBox`), the video at its top
(`sidecarRect`), what is playing and its transport under it, and the album's
queue taking the rest. It sits between the theater, which takes the screen,
and the tile, which takes a corner: for watching an album through while the
page stays usable.

- **Getting there.** The tile's dock button (`PanelRight`), shown where the
  viewport can spare the room: `sidecarAvailable`, 1100 × 600 and up. The
  column's header floats it back into a tile, minimizes it into the dock, or
  closes it.
- **The page moves over.** While the column shows, the provider sets
  `--sidecar-room` on `<html>` (the column's 320px and its insets, 344px).
  `globals.css` pads the body's right edge by it and takes it out of the page
  column's bleed (`--page-bleed`), so the column re-centres in what is left;
  the command bar's FAB reads it for its right edge. Minimized, the column is
  gone and so is the room.
- **It is a place, not a modal.** It stays across route changes (the theater
  collapses to PiP on one), takes no scroll lock and no Escape. Narrow the
  window past its room and it floats as a tile by itself.
- The dock's pills stay centred on the viewport rather than the page; hover
  peeks that hang into the page's right margin can run under the column.

## The native window (Chromium desks)

Every shape above stays inside the tab. Where the browser has the Document
Picture-in-Picture API (`documentPictureInPicture`, Chrome and Edge on a
desk), the tile and the sidecar also have a pop-out button
(`SquareArrowOutUpRight`), and the player moves into a real, always-on-top
window of its own: it stays over the editor or the call the user switched
to. Elsewhere the button is not there.

- **A new player, started where the old one was.** An iframe moved to another
  document reloads, and a player made from this tab's `YT` could not hear its
  iframe there (the IFrame API talks over `postMessage` to the iframe's
  parent). So the window loads the API itself (`loadYouTubeAPIIn`) and makes
  its own player, started at the page player's time; the page's is paused.
  While the window is open its player is the live one (`livePlayer` in the
  provider): play, pause, seek and the clock all reach it.
- **On the page**, the theater stands in the dock as its Live Activity,
  reading `in a window`, with a transport that drives the window's player.
  Choosing PiP, Theater or the sidecar there closes the window.
- **Coming back.** However the window closes (its own close, the browser's
  "back to tab", or a move back from the page), its `pagehide` hands playback
  back (`bringBack`): the page's player loads the track the window got to,
  seeks to where it got to, and plays if it was playing. Closing the player
  from the page ends the session instead.
- **The look** is the page's: its stylesheets are copied in, and the root's
  attributes (the theme is a class on `<html>`) are mirrored for as long as
  the window is open (`adoptPageLook`).
- A deck or a Bilibili / Vimeo embed is a plain frame in the window and
  starts from the top: it has no API to say where it was.
