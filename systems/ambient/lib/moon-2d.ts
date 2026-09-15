import type { AtmosphereParams, Vec3 } from "./wallpaper";

function rgba(c: Vec3, a = 1): string {
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;
}

/**
 * Cool moonlight disc. Same visual language as the sun (wide bloom +
 * opaque core) so evening/night read as a body, not a faint halo.
 */
export function drawMoonOnCanvas(
  ctx: CanvasRenderingContext2D,
  p: AtmosphereParams,
  cssW: number,
  cssH: number
) {
  if (p.moonGlow < 0.04) return;
  const px = p.moonPos[0] * cssW;
  const py = (1 - p.moonPos[1]) * cssH;
  const span = Math.max(cssW, cssH);
  const glow = p.moonGlow;
  const discR = span * (0.028 + p.moonSize * 0.72);

  const bloom = ctx.createRadialGradient(
    px,
    py,
    0,
    px,
    py,
    span * (0.16 + glow * 0.22)
  );
  bloom.addColorStop(0, rgba(p.moonColor, Math.min(0.5, 0.16 + glow * 0.26)));
  bloom.addColorStop(0.32, rgba(p.moonColor, 0.09 * glow));
  bloom.addColorStop(1, rgba(p.moonColor, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, cssW, cssH);

  const core = ctx.createRadialGradient(px, py, 0, px, py, discR);
  core.addColorStop(0, "rgba(248, 250, 255, 0.98)");
  core.addColorStop(0.42, "rgba(226, 234, 255, 0.9)");
  core.addColorStop(1, "rgba(210, 224, 255, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(px, py, discR, 0, Math.PI * 2);
  ctx.fill();

  const bodyR = discR * 0.7;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, bodyR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(236, 242, 255, 0.97)";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "rgba(16, 24, 48, 0.42)";
  ctx.beginPath();
  ctx.arc(px + bodyR * 0.46, py - bodyR * 0.06, bodyR * 0.98, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150, 166, 198, 0.22)";
  ctx.beginPath();
  ctx.arc(px - bodyR * 0.22, py + bodyR * 0.12, bodyR * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + bodyR * 0.1, py - bodyR * 0.28, bodyR * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
