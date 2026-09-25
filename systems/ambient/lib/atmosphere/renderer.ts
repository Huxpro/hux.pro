import type { LightningFrame } from "./lightning";
import type { SkyScene } from "./scene";
import { fragmentShader, vertexShader } from "./shaders";

/** One full-screen triangle, one bounded cloud integration pass. No runtime
 * assets or rendering framework; caller owns animation and context lifecycle. */
export function createSkyRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  const dispose = () => {
    shaders.forEach(s => gl.deleteShader(s));
    gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteTexture(texture);
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
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    const data = new Uint8Array(256 * 256 * 4);
    let seed = 728391;
    for (let i=0;i<data.length;i+=4) {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
      data[i] = data[i+1] = data[i+2] = seed >>> 24; data[i+3] = 255;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!uniforms.has(name)) uniforms.set(name,gl.getUniformLocation(program!,name));
      return uniforms.get(name)!;
    };
    gl.uniform1i(uniform("u_noise"),0);
    return {
      resize(width: number, height: number, pixelBudget: number) {
        const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(pixelBudget / Math.max(1,width*height)));
        canvas.width = Math.max(1,Math.round(width*scale)); canvas.height = Math.max(1,Math.round(height*scale));
        gl.viewport(0,0,canvas.width,canvas.height);
      },
      draw(scene: SkyScene, time: number, drift: [number, number], lightning: LightningFrame) {
        gl.useProgram(program);
        gl.uniform2f(uniform("u_resolution"),canvas.width,canvas.height);
        gl.uniform1f(uniform("u_time"),time);
        gl.uniform2fv(uniform("u_drift"),drift);
        gl.uniform1f(uniform("u_lightning"),lightning.strength);
        gl.uniform2f(uniform("u_lightningPosition"),lightning.x,lightning.y);
        for (const [key,value] of Object.entries(scene)) {
          const location = uniform(`u_${key}`);
          if (typeof value === "number") gl.uniform1f(location,value);
          else if (value.length === 2) gl.uniform2fv(location,value);
          else gl.uniform3fv(location,value);
        }
        gl.drawArrays(gl.TRIANGLES,0,3);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    console.warn("[ambient] Sky renderer unavailable; using atmospheric fallback.", error);
    return null;
  }
}
