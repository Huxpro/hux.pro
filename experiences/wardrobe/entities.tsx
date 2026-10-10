// =============================================================================
// The things in the dream, each declared where it is drawn.
//
// The declaration is what everything else reads: the inspector's panel, the
// language index ("他", "柜门"), the verifier. The drawing is the hand-written
// page's own SVG, moved in as it was: a boundary around it, not a rewrite.
// =============================================================================

import { Atmosphere, Draw, Part, choice, num, semantic, type DrawFn } from "scene";

// -----------------------------------------------------------------------------
// Him. Very tall, very thin, all in black; arms hanging nearly to his knees;
// and the hat, round, with a brim far wider than his shoulders. Feet at the
// origin; his height is 419.
// -----------------------------------------------------------------------------

const CROWN = "M -27 -381 C -29 -404 -17 -419 0 -419 C 17 -419 29 -404 27 -381 Z";
const BODY = [
  "M -24 -338 Q -28 -300 -19 -240 Q -16 -200 -21 -150 L -29 0 L 29 0 L 21 -150 Q 16 -200 19 -240 Q 28 -300 24 -338 Q 0 -344 -24 -338 Z",
  "M -24 -338 Q -34 -332 -33 -300 L -32 -178 L -24 -178 L -25 -300 Q -25 -322 -20 -334 Z",
  "M 24 -338 Q 34 -332 33 -300 L 32 -178 L 24 -178 L 25 -300 Q 25 -322 20 -334 Z",
  "M -32 -179 L -34 -146 L -32.6 -146 L -30.6 -176 L -29.6 -144 L -28.2 -144 L -28 -176 L -26.4 -148 L -25 -148 L -24.4 -179 Z",
  "M 32 -179 L 34 -146 L 32.6 -146 L 30.6 -176 L 29.6 -144 L 28.2 -144 L 28 -176 L 26.4 -148 L 25 -148 L 24.4 -179 Z",
];

function ManShapes({ hatScale, brim }: { hatScale: number; brim: number }) {
  return (
    <>
      <Part name="body">{BODY.map((d) => <path key={d} d={d} />)}</Part>
      <Part name="head">
        <ellipse cx="0" cy="-362" rx="12" ry="17" />
        <rect x="-5" y="-350" width="10" height="16" />
      </Part>
      <Part name="hat" transform={`translate(0 -379) scale(${hatScale}) translate(0 379)`}>
        <path d={CROWN} />
        <ellipse cx="0" cy="-379" rx={brim} ry="8.5" />
      </Part>
    </>
  );
}

export const Man = semantic(
  {
    id: "man",
    kind: "character",
    aka: ["他", "黑衣男人", "黑衣人", "鬼", "那个男人", "the man", "him", "the man in black"],
    depicts: "很高很瘦，一身黑，手臂垂到膝盖；圆顶帽，帽檐远宽于肩。Very tall, very thin, all in black; a round hat with a brim far wider than his shoulders.",
    parts: ["hat", "head", "eyes", "body"],
    params: {
      hatScale: num(1, { min: 0.6, max: 2, step: 0.05, aka: ["帽子大小", "帽子", "hat size"], affects: ["hat"] }),
      eyes: num(0, { min: 0, max: 1, step: 0.05, aka: ["眼睛", "反光", "glint"], affects: ["eyes"], effect: "appearance" }),
    },
    instances: { wardrobe: "衣柜里 · in the wardrobe", bedside: "床头 · at the bed" },
  },
  ({ hatScale, eyes }) => (
    <>
      {/* Moonlight on his left edge: a copy of him, a little to the left. */}
      <Atmosphere name="rim" fill="#4a5c94" opacity="0.55" transform="translate(-1.5 0)">
        <ManShapes hatScale={hatScale} brim={72} />
      </Atmosphere>
      <g fill="#000">
        <ManShapes hatScale={hatScale} brim={72} />
      </g>
      <Part name="eyes" opacity={eyes} fill="#d3dcf2">
        <circle cx="-4.6" cy="-361.5" r="1.25" />
        <circle cx="4.4" cy="-362" r="1.25" />
      </Part>
    </>
  ),
);

// -----------------------------------------------------------------------------
// The wardrobe. Two doors, each hinged at its outer edge, swinging toward the
// bed in a plain perspective. Its inside is a hole; he lives there.
// -----------------------------------------------------------------------------

const TOP = 222, BOTTOM = 640, CX = 195, CY = 470;

function doorPoints(hinge: number, dir: 1 | -1, width: number, open: number) {
  const a = open * 1.95;
  const fx = hinge + dir * width * Math.cos(a);
  const fz = width * Math.sin(a);
  const p = (u: number, y: number): [number, number] => {
    const s = 1 / (1 - fz * u * 0.0026);
    return [CX + (hinge + (fx - hinge) * u - CX) * s, CY + (y - CY) * s];
  };
  const poly = (q: [number, number][]) => q.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return {
    face: poly([p(0, TOP), p(1, TOP), p(1, BOTTOM), p(0, BOTTOM)]),
    panels: [poly([p(0.11, 236), p(0.89, 236), p(0.89, 416), p(0.11, 416)]), poly([p(0.11, 432), p(0.89, 432), p(0.89, 622), p(0.11, 622)])],
    handle: poly([p(0.9, 410), p(0.94, 410), p(0.94, 436), p(0.9, 436)]),
    // Seen edge-on and past it, the door's face turns from the moon: darker.
    shade: 0.72 + 0.36 * Math.cos(a),
  };
}

function Door({ name, hinge, dir, width, open }: { name: string; hinge: number; dir: 1 | -1; width: number; open: number }) {
  const d = doorPoints(hinge, dir, width, open);
  return (
    <Part name={name} style={{ filter: `brightness(${d.shade.toFixed(3)})` }}>
      <polygon points={d.face} fill="url(#doorFace)" stroke="#060910" strokeWidth="1" />
      {d.panels.map((p) => <polygon key={p.slice(0, 12)} points={p} fill="none" stroke="#1c2745" strokeWidth="2" />)}
      <polygon points={d.handle} fill="#2a3658" />
    </Part>
  );
}

export const Wardrobe = semantic(
  {
    id: "wardrobe",
    kind: "prop",
    aka: ["衣柜", "柜子", "the wardrobe", "the closet"],
    depicts: "一个两开门的高衣柜，深蓝木色，门板有两格。A tall two-door wardrobe in dark blue wood.",
    parts: ["inside", "door.left", "door.right"],
    params: {
      openLeft: num(0, { min: 0, max: 1, step: 0.01, aka: ["左门", "left door"], affects: ["door.left"] }),
      openRight: num(0, { min: 0, max: 1, step: 0.01, aka: ["柜门", "右门", "门", "the door"], affects: ["door.right"] }),
    },
  },
  ({ openLeft, openRight, children }) => (
    <>
      <rect x="200" y="200" width="172" height="14" fill="#141c33" />
      <rect x="205" y="212" width="161" height="430" fill="url(#wood)" />
      <Part name="inside">
        <rect x="213" y="222" width="145" height="418" fill="url(#inside)" />
        <rect x="213" y="244" width="145" height="2" fill="#070b16" />
        <path d="M 220 246 L 214 410 L 236 412 L 232 246 Z" fill="#080c18" />
        <path d="M 344 246 L 338 396 L 360 398 L 356 246 Z" fill="#080c18" />
      </Part>
      {/* Whoever stands inside, clipped to it. */}
      <g clipPath="url(#wardrobeInside)">{children}</g>
      <Door name="door.left" hinge={213} dir={1} width={73} open={openLeft} />
      <Door name="door.right" hinge={358} dir={-1} width={72} open={openRight} />
    </>
  ),
);

// -----------------------------------------------------------------------------
// The room, the window and the moon, the bed.
// -----------------------------------------------------------------------------

export const Room = semantic(
  { id: "room", kind: "setting", aka: ["卧室", "房间", "墙", "the room", "bedroom"], parts: ["wall", "floor"] },
  () => (
    <>
      <Part name="wall"><rect x="-200" y="-200" width="790" height="840" fill="url(#wall)" /></Part>
      <Part name="floor">
        <rect x="-200" y="640" width="790" height="400" fill="url(#floor)" />
        <rect x="-200" y="636" width="790" height="5" fill="#141b30" />
      </Part>
    </>
  ),
);

export const Window = semantic(
  {
    id: "window",
    kind: "prop",
    aka: ["窗", "窗户", "月光", "月亮", "the window", "moonlight"],
    parts: ["moon", "beam", "curtains"],
    params: { dust: num(1, { min: 0, max: 2, step: 0.1, aka: ["灰尘", "浮尘", "dust"], affects: ["beam"], effect: "appearance" }) },
  },
  ({ dust: amount }) => (
    <>
      <Atmosphere name="glow"><ellipse cx="96" cy="282" rx="150" ry="170" fill="url(#moonGlow)" /></Atmosphere>
      <rect x="40" y="172" width="112" height="214" fill="url(#glass)" />
      <Part name="moon"><circle cx="122" cy="214" r="13" fill="#b9c5e6" opacity="0.55" filter="url(#soft)" /></Part>
      <rect x="94" y="172" width="4" height="214" fill="#0b1020" />
      <rect x="40" y="276" width="112" height="4" fill="#0b1020" />
      <rect x="34" y="166" width="124" height="7" fill="#0b1020" />
      <rect x="34" y="384" width="124" height="7" fill="#0b1020" />
      <Part name="curtains" fill="#0b1020">
        <path d="M 16 158 C 40 230 26 330 44 404 L 0 410 L -10 158 Z" />
        <path d="M 142 158 C 150 220 132 300 150 402 L 176 404 C 166 300 180 220 170 158 Z" />
      </Part>
      <Part name="beam"><path d="M 40 386 L 152 386 L 330 700 L 120 700 Z" fill="url(#beam)" filter="url(#soft)" /></Part>
      {/* Dust in the beam, drawn on the canvas (defined below). */}
      <Draw part="beam" fn={dust(amount)} />
    </>
  ),
);

export const Bed = semantic(
  { id: "bed", kind: "prop", aka: ["床", "被子", "床头", "the bed", "blanket"], parts: ["blanket"] },
  () => (
    <Part name="blanket">
      <path d="M -40 760 C 40 724 120 742 170 716 C 214 694 250 690 286 704 C 330 722 360 708 430 716 L 430 900 L -40 900 Z" fill="url(#blanket)" />
      <path d="M -40 760 C 40 724 120 742 170 716 C 214 694 250 690 286 704 C 330 722 360 708 430 716" fill="none" stroke="#2c3962" strokeWidth="1.4" opacity="0.7" />
      <path d="M 60 790 C 120 770 180 790 230 770" fill="none" stroke="#0a0f1b" strokeWidth="3" opacity="0.8" />
    </Part>
  ),
);

/** Me: not in the picture, but the dream is mine. State without a box. */
export const Viewer = semantic(
  {
    id: "viewer",
    kind: "camera",
    aka: ["我", "我醒了", "眼睛闭上", "me", "my eyes"],
    visual: false,
    params: {
      world: choice("dream", ["dream", "awake"], { aka: ["梦", "醒"] }),
      eyes: choice("open", ["open", "closed"], { aka: ["闭眼", "睁眼"] }),
    },
  },
  () => null,
);

// -----------------------------------------------------------------------------
// Dust in the moonbeam, drawn in immediate mode on the stage's canvas. It is
// the window's beam all the same: the pick buffer runs this function again,
// in the beam's colour. A function of t alone, so any moment is the same dust.
// -----------------------------------------------------------------------------

const MOTES = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { s: r(1), w: r(2), speed: 0.4 + r(3), size: 0.6 + r(4) * 0.9, phase: r(5) * 6.28 };
});

function dust(amount: number): DrawFn {
  return (ctx, t) => {
    if (amount <= 0) return;
    const n = Math.round(MOTES.length * Math.min(1, amount));
    for (let i = 0; i < n; i++) {
      const m = MOTES[i];
      const s = (m.s + t * 0.006 * m.speed) % 1;
      const y = 386 + s * 314;
      const xl = 40 + 80 * s;
      const xr = 152 + 178 * s;
      const w = Math.min(0.95, Math.max(0.05, m.w + 0.05 * Math.sin(t * 0.3 + m.phase)));
      const a = (0.18 + 0.2 * Math.sin(t * 1.3 + m.phase)) * Math.min(1, amount) * (1 - s * 0.6);
      if (a <= 0.02) continue;
      ctx.fillStyle = `rgba(200, 212, 240, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(xl + w * (xr - xl), y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}
