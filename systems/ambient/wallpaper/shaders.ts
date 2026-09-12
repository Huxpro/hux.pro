export const WALLPAPER_VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const WALLPAPER_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uReduced;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHaze;
uniform vec3 uSunColor;
uniform vec3 uMoonColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;

uniform float uSunElevation;
uniform float uSunAzimuth;
uniform float uMoonElevation;
uniform float uMoonAzimuth;
uniform float uSunScale;
uniform float uMoonScale;
uniform float uSunGlow;
uniform float uStarOpacity;
uniform float uCloudCover;
uniform float uCloudSoftness;
uniform float uCloudDarkness;
uniform float uFogDensity;
uniform float uWind;
uniform float uLightning;
uniform float uWarmth;
uniform float uTheme;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.55;
  }
  return v;
}

vec2 bodyPos(float elevation, float azimuth) {
  float x = clamp(0.12 + azimuth * 0.76, -0.08, 1.08);
  float y = 0.34 + max(elevation, 0.0) * 0.52;
  return vec2(x, y);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (1.0 - uReduced * 0.92);

  vec3 col = mix(uHorizon, uZenith, smoothstep(0.08, 0.92, uv.y));
  col = mix(col, uHorizon, pow(1.0 - uv.y, 2.4) * 0.35);

  vec2 sun = bodyPos(uSunElevation, uSunAzimuth);
  vec2 moon = bodyPos(uMoonElevation, uMoonAzimuth);
  vec2 sunV = (uv - sun) * vec2(aspect, 1.0);
  vec2 moonV = (uv - moon) * vec2(aspect, 1.0);
  float sunDist = length(sunV);
  float moonDist = length(moonV);

  float mie = exp(-sunDist * mix(5.2, 2.6, uWarmth)) * uSunGlow;
  mie *= smoothstep(-0.18, 0.05, uSunElevation);
  col += uSunColor * mie * mix(0.7, 1.35, uWarmth);

  float horizonWarm = exp(-abs(uv.y - 0.3) * 5.2) * uWarmth * smoothstep(0.28, 0.0, abs(uSunElevation));
  col = mix(col, uSunColor, horizonWarm * 0.38);

  float sunDisk = smoothstep(0.062 * uSunScale, 0.02 * uSunScale, sunDist);
  sunDisk *= smoothstep(-0.04, 0.08, uSunElevation);
  col += uSunColor * sunDisk * 1.55;

  float moonVis = smoothstep(0.18, -0.02, uSunElevation);
  float moonDisk = smoothstep(0.028 * uMoonScale, 0.014 * uMoonScale, moonDist) * moonVis;
  float moonHalo = exp(-moonDist * 14.0) * moonVis * 0.22;
  col += uMoonColor * (moonDisk * 0.85 + moonHalo);

  if (uStarOpacity > 0.002) {
    vec2 cell = floor(uv * vec2(210.0 * aspect, 170.0));
    float star = step(0.9964, hash21(cell));
    float twinkle = 0.55 + 0.45 * sin(t * 2.4 + hash21(cell + 3.2) * 40.0);
    star *= twinkle * smoothstep(0.12, 0.55, uv.y) * uStarOpacity;
    col += vec3(0.94, 0.96, 1.0) * star * 1.35;
  }

  vec2 drift = vec2(t * 0.014 * (0.35 + uWind), t * 0.0035);
  vec2 cUv = vec2(uv.x * aspect, uv.y);
  float n1 = fbm(cUv * vec2(2.1, 1.25) + drift);
  float n2 = fbm(cUv * vec2(4.6, 2.6) - drift * 1.25 + 17.0);
  float field = n1 * 0.67 + n2 * 0.33;
  float threshold = mix(0.74, 0.18, uCloudCover);
  float softness = mix(0.06, 0.22, uCloudSoftness);
  float clouds = smoothstep(threshold - softness, threshold + softness * 0.7, field);
  clouds *= mix(0.45, 1.0, smoothstep(0.02, 0.38, uv.y));

  float ddx = fbm(cUv * vec2(2.1, 1.25) + drift + vec2(0.05, 0.0)) - n1;
  float lit = clamp(0.28 + ddx * 5.2 + uSunElevation * 0.4, 0.0, 1.0);
  vec3 cloudCol = mix(uCloudShadow, uCloudLit, lit);
  cloudCol = mix(cloudCol, uCloudShadow, uCloudDarkness * 0.82);
  col = mix(col, cloudCol, clouds * mix(0.72, 0.96, uCloudCover));

  float fogN = fbm(cUv * vec2(1.15, 0.55) + vec2(t * 0.018 * uWind, 0.0));
  float fog = uFogDensity * (0.42 + 0.58 * fogN) * (1.0 - uv.y * 0.5);
  col = mix(col, uHaze, fog);

  col += uLightning * vec3(0.82, 0.88, 1.0) * (0.18 + clouds * 0.7);

  float vignette = smoothstep(1.15, 0.28, length((uv - vec2(0.5, 0.45)) * vec2(1.05, 1.15)));
  col *= mix(0.82, 1.0, vignette);
  col = mix(col, col * vec3(1.04, 0.98, 0.94), uWarmth * 0.18 * (1.0 - uTheme));

  fragColor = vec4(col, 1.0);
}
`;
