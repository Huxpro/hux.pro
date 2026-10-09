// WebGL: whatever the scene graph (three.js, a hand-written renderer, a
// shader), a node's place on screen is its world-space extent carried through
// the camera. These take a view-projection matrix as WebGL and three.js keep
// it: 4×4, column-major (three: `camera.projectionMatrix × camera.matrixWorldInverse`,
// `.elements`). Results are in CSS px of the canvas; give the node the canvas
// as its `space` and the layer moves them into the viewport.

import type { Shape } from "./types";

export type Vec3 = [x: number, y: number, z: number];

/** A world point on the canvas, in CSS px, with its depth (0 near .. 1 far); null behind the camera. */
export function projectPoint(m: ArrayLike<number>, p: Vec3, width: number, height: number): Vec3 | null {
  const [x, y, z] = p;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 1e-6) return null;
  return [((cx / cw + 1) / 2) * width, ((1 - cy / cw) / 2) * height, (cz / cw + 1) / 2];
}

/** A world-space box on the canvas: the bounds of its eight corners. Null when wholly behind the camera. */
export function projectBox(m: ArrayLike<number>, min: Vec3, max: Vec3, width: number, height: number): Shape | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = projectPoint(m, [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]], width, height);
    if (!p) continue;
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return x0 === Infinity ? null : { rect: [x0, y0, x1 - x0, y1 - y0] };
}

/** A world-space sphere on the canvas, taken at its bounding box: never smaller than it looks. */
export function projectSphere(m: ArrayLike<number>, center: Vec3, radius: number, width: number, height: number): Shape | null {
  const [x, y, z] = center;
  return projectBox(m, [x - radius, y - radius, z - radius], [x + radius, y + radius, z + radius], width, height);
}
