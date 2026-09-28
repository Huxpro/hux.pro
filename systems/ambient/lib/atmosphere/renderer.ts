import type { LightningFrame } from "./lightning";
import type { SkyScene } from "./scene";
import { fragmentShader, vertexShader } from "./shaders";

/** Everything a frame needs besides the scene: the clock and the live events. */
export interface CloudFrame {
  time: number;
  /** World-space drift of the deck: x across, y unused, z into the scene. */
  drift: [number, number, number];
  /** Sideways slide of the camera — the tilt's parallax — in deck units. */
  camera: number;
  lightning: LightningFrame;
  /** How brightly the lightning lights the volume (the flash times the storm). */
  flash: number;
  /** Meteor head (x, y) and tail (z, w), uv with y down, and its brightness. */
  meteor: [number, number, number, number];
  meteorGlow: number;
  /** The fog wipe's mask canvas, when there is anything on it. */
  wipe: HTMLCanvasElement | null;
  /** The mask changed since the last upload. */
  wipeDirty: boolean;
}

const NOISE_SIZE = 256;
/** The z-slice offset `noise()` in shaders.ts steps by — keep the two together. */
const SLICE: [number, number] = [37, 17];

/**
 * The value noise, two slices to a texel: red is the noise at (x, y) and green
 * the same noise at (x + 37, y + 17), which is where `noise()` would otherwise
 * make a second fetch for the next z-slice. Linear filtering interpolates both
 * channels identically, so one fetch returns exactly what two did.
 */
export function packedNoise(size = NOISE_SIZE): Uint8Array {
  const values = new Uint8Array(size * size);
  let seed = 728391;
  for (let i = 0; i < values.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    values[i] = seed >>> 24;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    data[i] = values[y * size + x];
    data[i + 1] = values[((y + SLICE[1]) % size) * size + (x + SLICE[0]) % size];
    data[i + 3] = 255;
  }
  return data;
}

const UNIFORMS = [
  "u_resolution", "u_noise", "u_wipe", "u_time", "u_zenith", "u_horizon", "u_cloudLight", "u_cloudShade",
  "u_sun", "u_moon", "u_drift", "u_lightDir", "u_camera", "u_daylight", "u_twilight", "u_cloud", "u_fog",
  "u_storm", "u_moonPhase", "u_moonVisible", "u_moonSize", "u_stars", "u_density", "u_darkness",
  "u_coverage", "u_extinction", "u_lightning", "u_lightningPosition", "u_meteor", "u_meteorGlow", "u_wipeOn",
] as const;
type Uniform = (typeof UNIFORMS)[number];

/** One full-screen triangle, one bounded cloud integration pass. No runtime
 * assets or rendering framework; caller owns animation and context lifecycle. */
export function createSkyRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let noise: WebGLTexture | null = null;
  let wipe: WebGLTexture | null = null;
  const dispose = () => {
    shaders.forEach(s => gl.deleteShader(s));
    gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(noise); gl.deleteTexture(wipe);
  };
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to allocate sky shader");
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Sky shader compilation failed");
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate sky program");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Sky shader link failed");
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = (unit: number, wrap: number) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      return t;
    };
    noise = texture(0, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, packedNoise());
    wipe = texture(1, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 1, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, new Uint8Array(1));
    const loc = {} as Record<Uniform, WebGLUniformLocation | null>;
    for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(loc.u_noise, 0);
    gl.uniform1i(loc.u_wipe, 1);
    let wipeLive = false;
    return {
      /** Size the backing store; `scale` is backing pixels per CSS pixel. */
      resize(width: number, height: number, scale: number) {
        canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      draw(scene: SkyScene, frame: CloudFrame) {
        gl.useProgram(program);
        gl.uniform2f(loc.u_resolution, canvas.width, canvas.height);
        gl.uniform1f(loc.u_time, frame.time);
        gl.uniform3fv(loc.u_zenith, scene.zenith);
        gl.uniform3fv(loc.u_horizon, scene.horizon);
        gl.uniform3fv(loc.u_cloudLight, scene.cloudLight);
        gl.uniform3fv(loc.u_cloudShade, scene.cloudShade);
        gl.uniform2fv(loc.u_sun, scene.sun);
        gl.uniform2fv(loc.u_moon, scene.moon);
        gl.uniform3fv(loc.u_drift, frame.drift);
        // Toward the sun from inside the deck — the shadow taps' direction.
        const lx = (scene.sun[0] - 0.5) * 2, ly = 0.5 + (1 - scene.sun[1]), lz = 0.8;
        const ll = Math.hypot(lx, ly, lz);
        gl.uniform3f(loc.u_lightDir, lx / ll, ly / ll, lz / ll);
        gl.uniform1f(loc.u_camera, frame.camera);
        gl.uniform1f(loc.u_daylight, scene.daylight);
        gl.uniform1f(loc.u_twilight, scene.twilight);
        gl.uniform1f(loc.u_cloud, scene.cloud);
        gl.uniform1f(loc.u_fog, scene.fog);
        gl.uniform1f(loc.u_storm, scene.storm);
        gl.uniform1f(loc.u_moonPhase, scene.moonPhase);
        gl.uniform1f(loc.u_moonVisible, scene.moonVisible);
        gl.uniform1f(loc.u_moonSize, scene.moonSize);
        gl.uniform1f(loc.u_stars, scene.stars);
        gl.uniform1f(loc.u_density, scene.density);
        gl.uniform1f(loc.u_darkness, scene.darkness);
        gl.uniform1f(loc.u_coverage, 0.74 + (0.23 - 0.74) * scene.cloud);
        gl.uniform1f(loc.u_extinction, (3.6 + 2.4 * scene.storm) * (0.75 + 0.45 * scene.density));
        gl.uniform1f(loc.u_lightning, frame.flash);
        gl.uniform2f(loc.u_lightningPosition, frame.lightning.x, frame.lightning.y);
        gl.uniform4fv(loc.u_meteor, frame.meteor);
        gl.uniform1f(loc.u_meteorGlow, frame.meteorGlow);
        if (frame.wipe && frame.wipeDirty) {
          gl.activeTexture(gl.TEXTURE1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, gl.ALPHA, gl.UNSIGNED_BYTE, frame.wipe);
          gl.activeTexture(gl.TEXTURE0);
        }
        if (!!frame.wipe !== wipeLive) { wipeLive = !!frame.wipe; gl.uniform1f(loc.u_wipeOn, wipeLive ? 1 : 0); }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    console.warn("[ambient] Atmosphere renderer unavailable; using its CSS gradient.", error);
    return null;
  }
}

export type SkyRenderer = NonNullable<ReturnType<typeof createSkyRenderer>>;
