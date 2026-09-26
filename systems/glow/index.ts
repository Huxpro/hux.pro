// =============================================================================
// Glow System — the site's one light.
//
// Siri's ring, as a shader on the edge of a rounded box: the About's screen,
// a field listening to a voice, a badge under the pointer. One palette
// (lib/palette.ts), one shader (lib/shader.ts), one WebGL context shared by
// every instance (lib/renderer.ts), so every glow on the site is the same
// light at a different scale.
//
//   <Glow active shape="ring" />                      the whole edge
//   <Glow active shape="line" level={voice.level} />  the bottom, following a voice
//   <Glow active processing />                        a beam travelling: working
//   <EdgeGlow active content={ref} depth={0.5} />     a screen's ring, ending
//                                                     halfway to its content
//
// See docs/system-glow.md.
// =============================================================================

export { Glow } from "./components/glow";
export type { GlowMotion, GlowProps, GlowShape } from "./components/glow";
export { EdgeGlow } from "./components/edge-glow";
export type { EdgeGlowProps } from "./components/edge-glow";
export { GLOW_EXTENT_PER_REACH } from "./lib/shader";
export { GLOW_STOPS, GLOW_CSS_STOPS } from "./lib/palette";
export { glowSupported } from "./lib/renderer";
export {
  GLOW_TUNING_DEFAULTS,
  glowTuning,
  setGlowTuning,
  useGlowTuning,
} from "./lib/tuning";
export type { GlowTuning } from "./lib/tuning";
