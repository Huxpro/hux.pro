"use client";

import { useEffect, useRef } from "react";

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Signed rounded-rectangle distance keeps the light attached to every edge,
// independent of aspect ratio. Interfering waves carry beams around the rim;
// the sharp filament and broad scattered light share that same moving field.
const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float pixelRatio;
void main() {
  vec2 size = resolution / pixelRatio;
  vec2 p = gl_FragCoord.xy / pixelRatio - size * 0.5;
  float radius = min(30.0, min(size.x, size.y) * 0.08);
  vec2 q = abs(p) - (size * 0.5 - vec2(radius + 3.0));
  float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float d = -sdf;
  float angle = atan(p.y, p.x);
  float wave = sin(angle * 3.0 + time * 0.7)
             + 0.5 * sin(angle * 7.0 - time * 1.1);
  float flow = angle + time * 0.22 + wave * 0.22;
  vec3 color = 0.55 + 0.45 * cos(flow * 2.0 + vec3(0.0, 2.1, 4.2));
  color = mix(color, vec3(1.0, 0.48, 0.25), pow(0.5 + 0.5 * sin(flow - time * 0.3), 8.0) * 0.65);
  float beam = pow(0.5 + 0.5 * sin(angle * 4.0 - time * 0.9 + wave), 3.0);
  float filament = exp(-pow((d - 1.6 - wave * 0.7) / 1.9, 2.0));
  float ribbon = exp(-abs(d - 3.0 - wave * 1.5) / (5.0 + beam * 5.0));
  float halo = exp(-max(d, 0.0) / (18.0 + beam * 24.0));
  float alpha = (filament * 0.85 + ribbon * 0.42 + halo * 0.24) * smoothstep(-2.0, 0.5, d);
  vec3 light = mix(color, vec3(1.0), filament * 0.55);
  gl_FragColor = vec4(light, min(alpha, 0.98));
}
`;

export function EdgeGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
    });
    if (!gl) return; // The CSS rim underneath remains visible.
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) return;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) continue;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const pixelRatio = gl.getUniformLocation(program, "pixelRatio");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let lost = false;

    const draw = () => {
      if (lost) return;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(pixelRatio, ratio);
      gl.uniform1f(time, motion.matches ? 2.0 : elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.ready = "true";
    };
    const tick = (now: number) => {
      if (now - last >= 1000 / 30) {
        elapsed += last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (lost || document.hidden) return;
      draw();
      if (!motion.matches) frame = requestAnimationFrame(tick);
    };
    const onLost = () => {
      lost = true;
      delete canvas.dataset.ready;
      cancelAnimationFrame(frame);
    };
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    motion.addEventListener("change", resume);
    document.addEventListener("visibilitychange", resume);
    canvas.addEventListener("webglcontextlost", onLost);
    resume();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      motion.removeEventListener("change", resume);
      document.removeEventListener("visibilitychange", resume);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="about-edge" aria-hidden="true">
      <div className="about-edge-fallback" />
      <canvas ref={canvasRef} />
    </div>
  );
}
