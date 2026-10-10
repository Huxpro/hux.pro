# scene

A thin semantic layer over React for short interactive scenes. Every thing a
person could name is declared next to where it is drawn, measured on screen
(on SVG and canvas alike, through a pick buffer), overridable from outside,
and verifiable; what it draws stays free.

- `semantic(decl, Render)`, `<Part>`, `<Atmosphere>`: the boundary
- `<Stage>`, `useTime()`, `useFrame()`, `<Draw>`: one clock, SVG and canvas
- `window.__scene`: manifest, snapshot, hit test, stills, overrides, `verify()`

The design, the five rules for writing a scene, and how the lab inspects one:
[docs/system-scene.md](../../docs/system-scene.md). Not on npm; it lives here.
