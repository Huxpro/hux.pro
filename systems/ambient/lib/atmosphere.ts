import type { AtmosphereParams, Vec2, Vec3 } from "./wallpaper";

// =============================================================================
// WebGL atmosphere renderer
//
// A single fullscreen triangle with a photographic sky shader:
//   • horizon-to-zenith grade + haze band
//   • sun / moon discs with bloom
//   • domain-warped FBM clouds (two layers, lit from the sun)
//   • crepuscular rays, stars, fog, lightning flash, grain
// =============================================================================

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHaze;
uniform vec3 uGround;
uniform vec2 uSunPos;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uSunGlow;
uniform vec2 uMoonPos;
uniform vec3 uMoonColor;
uniform float uMoonSize;
uniform float uMoonGlow;
uniform float uCloudCover;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform vec3 uCloudLight;
uniform vec3 uCloudShade;
uniform float uFog;
uniform float uStars;
uniform float uWind;
uniform float uLightning;
uniform float uRays;
uniform float uVignette;
uniform float uGrain;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  v += a * noise(p); p = p * 2.03 + 13.5; a *= 0.5;
  v += a * noise(p); p = p * 2.01 - 7.2; a *= 0.5;
  v += a * noise(p); p = p * 2.07 + 3.1; a *= 0.5;
  v += a * noise(p); p = p * 2.04 + 1.7; a *= 0.5;
  v += a * noise(p);
  return v;
}

float aspect() {
  return uResolution.x / max(uResolution.y, 1.0);
}

float disc(vec2 uv, vec2 pos, float size) {
  vec2 d = (uv - pos) * vec2(aspect(), 1.0);
  return length(d);
}

vec3 sunMoon(vec2 uv, vec3 sky) {
  float sd = disc(uv, uSunPos, uSunSize);
  float core = smoothstep(uSunSize, uSunSize * 0.35, sd);
  float glow = exp(-sd * 7.5) * uSunGlow;
  float bloom = exp(-sd * 1.65) * uSunGlow * 0.42;
  sky += uSunColor * (core * 1.15 + glow + bloom);

  if (uMoonGlow > 0.01) {
    float md = disc(uv, uMoonPos, uMoonSize);
    float mCore = smoothstep(uMoonSize, uMoonSize * 0.4, md);
    float crater = 0.88 + 0.12 * noise(uv * 80.0 + 3.0);
    float mGlow = exp(-md * 8.0) * uMoonGlow * 0.55;
    float mHalo = exp(-md * 2.2) * uMoonGlow * 0.28;
    sky += uMoonColor * (mCore * crater * uMoonGlow + mGlow + mHalo);
  }
  return sky;
}

float cloudField(vec2 uv, float speed, float scale, float seed) {
  float h = uv.y;
  float persp = 0.28 + 0.72 * smoothstep(0.02, 0.72, h);
  vec2 p = vec2(uv.x * scale * 1.7 + uTime * speed + seed, (1.0 - h) * scale * persp * 1.15);
  p += uWind * 0.35 * vec2(uTime * 0.07, 0.0);
  vec2 q = p + 0.38 * vec2(fbm(p + seed), fbm(p + 17.2 + seed));
  return fbm(q);
}

vec3 applyClouds(vec2 uv, vec3 sky) {
  float cover = clamp(uCloudCover, 0.0, 1.0);
  if (cover < 0.02) return sky;

  float n1 = cloudField(uv, uCloudSpeed, uCloudScale, 0.0);
  float n2 = cloudField(uv, uCloudSpeed * 1.35, uCloudScale * 1.8, 9.4);

  float lo = mix(0.62, 0.18, cover);
  float hi = mix(0.92, 0.46, cover);
  float c1 = smoothstep(lo, hi, n1);
  float c2 = smoothstep(lo + 0.08, hi + 0.1, n2) * 0.55;

  float horizonFade = smoothstep(0.02, 0.22, uv.y);
  c1 *= horizonFade;
  c2 *= horizonFade;

  vec2 sunDir = normalize(uSunPos - uv);
  float nLit = cloudField(uv + sunDir * 0.03, uCloudSpeed, uCloudScale, 0.0);
  float wrap = clamp(0.42 + 0.7 * (n1 - nLit) + uSunGlow * 0.08, 0.0, 1.0);
  vec3 col = mix(uCloudShade, uCloudLight, wrap);
  col += uSunColor * wrap * uSunGlow * 0.08;

  sky = mix(sky, col, c1 * mix(0.55, 0.92, cover));
  sky = mix(sky, mix(uCloudShade, uCloudLight, 0.7), c2 * 0.5);
  return sky;
}

vec3 applyRays(vec2 uv, vec3 sky) {
  if (uRays < 0.01 || uSunGlow < 0.05) return sky;
  vec2 dir = uv - uSunPos;
  dir.x *= aspect();
  float ang = atan(dir.y, dir.x);
  float dist = length(dir);
  float spokes = 0.5 + 0.5 * sin(ang * 10.0 + uTime * 0.12);
  spokes *= 0.5 + 0.5 * sin(ang * 17.0 - uTime * 0.07);
  float falloff = pow(max(0.0, 1.0 - dist * 0.42), 2.2);
  sky += uSunColor * spokes * falloff * uRays * 0.16;
  return sky;
}

vec3 applyStars(vec2 uv, vec3 sky) {
  if (uStars < 0.01) return sky;
  vec2 gp = floor(uv * vec2(260.0, 180.0));
  float h = hash(gp);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.4 + h * 2.2) + h * 40.0);
  float star = step(0.9966, h) * smoothstep(0.9966, 1.0, h) * twinkle;
  float fade = smoothstep(0.15, 0.55, uv.y);
  sky += vec3(0.92, 0.95, 1.0) * star * uStars * fade * 1.8;
  return sky;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float h = uv.y;

  vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.72));
  float hazeBand = exp(-abs(h - 0.16) * 5.4);
  sky = mix(sky, uHaze, hazeBand * 0.58);
  sky = mix(uGround, sky, smoothstep(0.0, 0.24, h));

  sky = sunMoon(uv, sky);
  sky = applyRays(uv, sky);
  sky = applyStars(uv, sky);
  sky = applyClouds(uv, sky);

  if (uFog > 0.01) {
    float fogN = fbm(uv * vec2(1.4, 0.7) + vec2(uTime * 0.015, 0.0));
    float density = uFog * mix(0.75, 1.0, fogN);
    float band = smoothstep(0.0, 0.55, 1.0 - h) * 0.7 + 0.3;
    vec3 fogCol = mix(uHaze, uHorizon, 0.4);
    sky = mix(sky, fogCol, clamp(density * band, 0.0, 0.88));
  }

  sky += uSunColor * uLightning * 0.55;
  sky = mix(sky, vec3(0.92, 0.95, 1.0), uLightning * 0.22);

  float vig = smoothstep(1.15, 0.25, length((uv - 0.5) * vec2(1.15, 1.0)));
  sky *= mix(1.0, vig, uVignette);

  float grain = (hash(gl_FragCoord.xy + fract(uTime * 13.7)) - 0.5) * uGrain;
  sky += grain;

  gl_FragColor = vec4(clamp(sky, 0.0, 1.0), 1.0);
}
`;

type UniformMap = {
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uZenith: WebGLUniformLocation | null;
  uHorizon: WebGLUniformLocation | null;
  uHaze: WebGLUniformLocation | null;
  uGround: WebGLUniformLocation | null;
  uSunPos: WebGLUniformLocation | null;
  uSunColor: WebGLUniformLocation | null;
  uSunSize: WebGLUniformLocation | null;
  uSunGlow: WebGLUniformLocation | null;
  uMoonPos: WebGLUniformLocation | null;
  uMoonColor: WebGLUniformLocation | null;
  uMoonSize: WebGLUniformLocation | null;
  uMoonGlow: WebGLUniformLocation | null;
  uCloudCover: WebGLUniformLocation | null;
  uCloudScale: WebGLUniformLocation | null;
  uCloudSpeed: WebGLUniformLocation | null;
  uCloudLight: WebGLUniformLocation | null;
  uCloudShade: WebGLUniformLocation | null;
  uFog: WebGLUniformLocation | null;
  uStars: WebGLUniformLocation | null;
  uWind: WebGLUniformLocation | null;
  uLightning: WebGLUniformLocation | null;
  uRays: WebGLUniformLocation | null;
  uVignette: WebGLUniformLocation | null;
  uGrain: WebGLUniformLocation | null;
};

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[ambient] shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function set3(gl: WebGLRenderingContext, loc: WebGLUniformLocation | null, v: Vec3) {
  if (loc) gl.uniform3f(loc, v[0], v[1], v[2]);
}

function set2(gl: WebGLRenderingContext, loc: WebGLUniformLocation | null, v: Vec2) {
  if (loc) gl.uniform2f(loc, v[0], v[1]);
}

export interface AtmosphereRenderer {
  setParams: (params: AtmosphereParams) => void;
  setLightning: (value: number) => void;
  setTimeScale: (scale: number) => void;
  resize: (cssWidth: number, cssHeight: number, dpr: number) => void;
  frame: (nowMs: number) => void;
  destroy: () => void;
}

/** Compile the sky shader on a throwaway canvas so we never lock the live one. */
export function isAtmosphereGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl", {
    failIfMajorPerformanceCaveat: false,
    alpha: false,
  });
  if (!gl) return false;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const ok = !!(vs && fs);
  if (vs) gl.deleteShader(vs);
  if (fs) gl.deleteShader(fs);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return ok;
}

export function createAtmosphereRenderer(
  canvas: HTMLCanvasElement
): AtmosphereRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[ambient] shader link failed", gl.getProgramInfoLog(program));
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "aPos");
  const uniforms = {} as UniformMap;
  for (const key of Object.keys({
    uResolution: 0,
    uTime: 0,
    uZenith: 0,
    uHorizon: 0,
    uHaze: 0,
    uGround: 0,
    uSunPos: 0,
    uSunColor: 0,
    uSunSize: 0,
    uSunGlow: 0,
    uMoonPos: 0,
    uMoonColor: 0,
    uMoonSize: 0,
    uMoonGlow: 0,
    uCloudCover: 0,
    uCloudScale: 0,
    uCloudSpeed: 0,
    uCloudLight: 0,
    uCloudShade: 0,
    uFog: 0,
    uStars: 0,
    uWind: 0,
    uLightning: 0,
    uRays: 0,
    uVignette: 0,
    uGrain: 0,
  } satisfies Record<keyof UniformMap, number>)) {
    uniforms[key as keyof UniformMap] = gl.getUniformLocation(program, key);
  }

  let params: AtmosphereParams | null = null;
  let lightning = 0;
  let timeScale = 1;
  let startMs = 0;
  let width = 1;
  let height = 1;

  const applyParams = () => {
    if (!params) return;
    set3(gl, uniforms.uZenith, params.zenith);
    set3(gl, uniforms.uHorizon, params.horizon);
    set3(gl, uniforms.uHaze, params.haze);
    set3(gl, uniforms.uGround, params.ground);
    set2(gl, uniforms.uSunPos, params.sunPos);
    set3(gl, uniforms.uSunColor, params.sunColor);
    if (uniforms.uSunSize) gl.uniform1f(uniforms.uSunSize, params.sunSize);
    if (uniforms.uSunGlow) gl.uniform1f(uniforms.uSunGlow, params.sunGlow);
    set2(gl, uniforms.uMoonPos, params.moonPos);
    set3(gl, uniforms.uMoonColor, params.moonColor);
    if (uniforms.uMoonSize) gl.uniform1f(uniforms.uMoonSize, params.moonSize);
    if (uniforms.uMoonGlow) gl.uniform1f(uniforms.uMoonGlow, params.moonGlow);
    if (uniforms.uCloudCover) gl.uniform1f(uniforms.uCloudCover, params.cloudCover);
    if (uniforms.uCloudScale) gl.uniform1f(uniforms.uCloudScale, params.cloudScale);
    if (uniforms.uCloudSpeed) gl.uniform1f(uniforms.uCloudSpeed, params.cloudSpeed);
    set3(gl, uniforms.uCloudLight, params.cloudLight);
    set3(gl, uniforms.uCloudShade, params.cloudShade);
    if (uniforms.uFog) gl.uniform1f(uniforms.uFog, params.fog);
    if (uniforms.uStars) gl.uniform1f(uniforms.uStars, params.stars);
    if (uniforms.uWind) gl.uniform1f(uniforms.uWind, params.wind);
    if (uniforms.uLightning) gl.uniform1f(uniforms.uLightning, lightning);
    if (uniforms.uRays) gl.uniform1f(uniforms.uRays, params.rays);
    if (uniforms.uVignette) gl.uniform1f(uniforms.uVignette, params.vignette);
    if (uniforms.uGrain) gl.uniform1f(uniforms.uGrain, params.grain);
  };

  return {
    setParams(next) {
      params = next;
    },
    setLightning(value) {
      lightning = value;
    },
    setTimeScale(scale) {
      timeScale = scale;
    },
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.floor(cssWidth * dpr));
      const h = Math.max(1, Math.floor(cssHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      width = w;
      height = h;
      gl.viewport(0, 0, w, h);
    },
    frame(nowMs) {
      if (!params) return;
      if (!startMs) startMs = nowMs;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, width, height);
      if (uniforms.uTime) gl.uniform1f(uniforms.uTime, ((nowMs - startMs) / 1000) * timeScale);
      applyParams();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    },
  };
}
