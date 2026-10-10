// The moments: small flat pictures of a conversation, drawn once offscreen
// and sampled, colour and all, into the dust each becomes. As they were.

/** A picture's box, px, at a full row. */
export const SIZE = 56;

export const C = {
  orange: "#e2703a",
  navy: "#24345c",
  yellow: "#f2b632",
  red: "#d64545",
  blue: "#3b6fb6",
  teal: "#2e8b7d",
};

export type Draw = (ctx: CanvasRenderingContext2D) => void;

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** The moments, each drawn in a 56px box. */
export const MOMENTS: Draw[] = [
  // Your cat.
  (ctx) => {
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.moveTo(11, 24);
    ctx.lineTo(14, 6);
    ctx.lineTo(25, 17);
    ctx.moveTo(45, 24);
    ctx.lineTo(42, 6);
    ctx.lineTo(31, 17);
    ctx.fill();
    circle(ctx, 28, 32, 18, C.orange);
    circle(ctx, 21, 30, 2.6, C.navy);
    circle(ctx, 35, 30, 2.6, C.navy);
  },
  // A late night: the moon and a star.
  (ctx) => {
    circle(ctx, 25, 28, 18, C.navy);
    ctx.globalCompositeOperation = "destination-out";
    circle(ctx, 33, 22, 15, "#000");
    ctx.globalCompositeOperation = "source-over";
    circle(ctx, 42, 38, 3.5, C.yellow);
  },
  // The two of us.
  (ctx) => {
    ctx.globalAlpha = 0.92;
    circle(ctx, 21, 28, 14, C.red);
    ctx.globalCompositeOperation = "multiply";
    circle(ctx, 35, 28, 14, C.blue);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  },
  // A home.
  (ctx) => {
    ctx.fillStyle = C.teal;
    ctx.fillRect(12, 26, 32, 24);
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(8, 27);
    ctx.lineTo(28, 7);
    ctx.lineTo(48, 27);
    ctx.fill();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(24, 34, 9, 9);
  },
  // A little sun: thank you.
  (ctx) => {
    ctx.strokeStyle = C.yellow;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(28 + Math.cos(a) * 17, 28 + Math.sin(a) * 17);
      ctx.lineTo(28 + Math.cos(a) * 24, 28 + Math.sin(a) * 24);
      ctx.stroke();
    }
    circle(ctx, 28, 28, 12, C.yellow);
  },
];

/** What each moment is, for the semantic layer: the pictures carry no words. */
export const MOMENT_NAMES = ["your cat", "a late night", "the two of us", "a home", "a little sun"];

export type Point = { x: number; y: number; color: string };

export type Picture = {
  /** The picture, drawn at the screen's density. */
  sprite: HTMLCanvasElement;
  /** Its lit pixels with their colours, relative to its centre. */
  points: Point[];
};

export function paint(draw: Draw, dpr: number): Picture {
  const sprite = document.createElement("canvas");
  sprite.width = Math.round(SIZE * dpr);
  sprite.height = Math.round(SIZE * dpr);
  const sctx = sprite.getContext("2d");
  if (sctx) {
    sctx.scale(dpr, dpr);
    draw(sctx);
  }
  // Sampled at 1x, every 2px: what the picture becomes when it goes.
  const probe = document.createElement("canvas");
  probe.width = SIZE;
  probe.height = SIZE;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const points: Point[] = [];
  if (pctx) {
    draw(pctx);
    const data = pctx.getImageData(0, 0, SIZE, SIZE).data;
    for (let y = 0; y < SIZE; y += 2) {
      for (let x = 0; x < SIZE; x += 2) {
        const o = (y * SIZE + x) * 4;
        if (data[o + 3] < 140) continue;
        points.push({ x: x - SIZE / 2, y: y - SIZE / 2, color: `${data[o]}, ${data[o + 1]}, ${data[o + 2]}` });
      }
    }
  }
  return { sprite, points };
}
