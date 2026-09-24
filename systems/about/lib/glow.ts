// =============================================================================
// Edge glow — a fullscreen fragment pass for the About surface.
//
// The light lives on the screen edge, the way Siri's glow does: a band of
// colour hugging the bezel, with beams that travel around it. The middle of
// the frame stays clear so the prose can sit there. One triangle, no buffers.
// =============================================================================

const VERT = `#version 300 es
void main() {
  vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMotion;

out vec4 fragColor;

vec3 palette(float t) {
  vec3 stops[5] = vec3[5](
    vec3(1.00, 0.38, 0.55),
    vec3(0.62, 0.32, 1.00),
    vec3(0.22, 0.55, 1.00),
    vec3(0.15, 0.92, 0.86),
    vec3(1.00, 0.58, 0.22)
  );
  float x = fract(t) * 5.0;
  int i = int(floor(x));
  int j = i + 1;
  if (j > 4) j = 0;
  float f = smoothstep(0.0, 1.0, fract(x));
  return mix(stops[i], stops[j], f);
}

float ring(float angle, float centre, float sharpness) {
  float d = abs(mod(angle - centre + 3.14159265, 6.2831853) - 3.14159265);
  return exp(-d * d * sharpness);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 res = uResolution;
  float minDim = min(res.x, res.y);
  vec2 p = (frag - 0.5 * res) / minDim;
  vec2 halfSize = 0.5 * res / minDim;

  float radius = 18.0 / minDim;
  vec2 box = halfSize - vec2(1.5 / minDim);
  vec2 q = abs(p) - (box - radius);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float inward = max(-sd, 0.0);

  float band = 0.055 + 0.012 * sin(uTime * 0.7);
  float core = exp(-pow(inward / band, 2.0));
  float halo = exp(-pow(inward / (band * 2.6), 2.0));

  float ang = atan(p.y, p.x);
  float travel = uTime * uMotion;

  float flow = 0.42
    + 0.58 * pow(0.5 + 0.5 * sin(ang * 3.0 + travel * 1.15), 1.7);
  flow *= 0.72 + 0.28 * sin(ang * 7.0 - travel * 1.8);

  float beams = 0.0;
  beams += ring(ang, travel * 0.55, 6.0);
  beams += 0.65 * ring(ang, -travel * 0.38 + 2.1, 10.0);
  beams += 0.45 * ring(ang, travel * 0.22 + 4.2, 14.0);

  float hue = ang / 6.2831853 + travel * 0.045;
  vec3 colour = palette(hue);
  colour += palette(hue + 0.18) * beams * 0.85;

  float alpha = core * (0.55 + 0.45 * flow) + halo * 0.22;
  alpha += core * beams * 0.9;
  alpha *= smoothstep(0.0, 0.004, inward);
  alpha = clamp(alpha, 0.0, 1.0);

  fragColor = vec4(colour * alpha, alpha);
}
`;

export interface EdgeGlowHandle {
  stop: () => void;
}

/** Paint the edge glow into `canvas`. Returns a handle that releases the context. */
export function mountEdgeGlow(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
): EdgeGlowHandle {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) {
    return { stop: () => {} };
  }

  const program = link(gl, VERT, FRAG);
  if (!program) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { stop: () => {} };
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.useProgram(program);
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uMotion = gl.getUniformLocation(program, "uMotion");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let frame = 0;
  let stopped = false;
  const started = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (now: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden) return;
    resize();
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - started) / 1000);
    gl.uniform1f(uMotion, reducedMotion ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  frame = requestAnimationFrame(draw);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  const vs = shader(gl, gl.VERTEX_SHADER, vert);
  const fs = shader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
