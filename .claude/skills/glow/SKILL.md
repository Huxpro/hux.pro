---
name: glow
description: Put the site's one light somewhere, or change it - <Glow>, <EdgeGlow>, glow colours, the shader or renderer - and the voice that drives it (useVoiceInput, the meter, the microphone button, the waveform). Use when adding a glow to any element, writing a colour that should glow, touching systems/glow/**, systems/voice/**, systems/command/voice.tsx or app/api/voice, or about to add a canvas, WebGL context or gradient "light" of your own.
---

# Glow & voice

1. **Earn it.** A glow says something is alive: listening, working
   (`processing`), running (`motion="rotate"`), now (`motion="pulse"`).
   Never decoration. `flow` is the default motion.
2. **Use `<Glow>` / `<EdgeGlow>`** from `@/systems/glow`. No canvas, WebGL
   context or CSS gradient of your own: one context serves the page, and a
   browser drops the oldest when there are too many.
3. **Colours** live only in `systems/glow/lib/palette.ts` (Siri's stops) and
   `lib/harmony.ts` (from the wallpaper). Read `GLOW_STOPS` /
   `GLOW_CSS_STOPS` if you need them in CSS. A glow colour written anywhere
   else is a bug.
4. **Host**: a `relative` parent whose own corners the light follows; if
   the parent has none, pass `radius`. A `bleed` (halo) needs room: no
   `overflow: hidden` ancestor hugging the host. Small elements: `reach`
   3–4, `bleed` 8–14.
5. **Cost**: only scrolling off screen is detected. Hidden any other way
   (behind a panel, opacity 0)? Set `active={false}`.
6. **Voice**: `useVoiceInput` from a press only (`start()` inside the
   gesture: mic permission, Safari audio). Pass `voice.level` /
   `voice.bands` as getters; never call them in render. `active` takes
   `voice.listening` (true in `listening` and `processing`), `processing`
   takes `voice.state === "processing"`. The idle breath (`IDLE`, 0.17 ±
   0.06) is already in the getters.
7. **Shader constants**: change a beam's thickness or falloff and
   `GLOW_EXTENT_PER_REACH` must follow; change `lib/tuning.ts` defaults and
   bump its key (`hux_glow_v2`).
8. **Judge it** in `/lab/glow` (both themes, a wallpaper, devtool Glow ·
   Colours), then add it to the table under "What it looks like" in the doc.

WebGL in headless Chromium is software-rendered at ~3 fps: wait 8–10 s
before a screenshot, since state easing steps at most 50 ms a frame.

More: `docs/system-glow.md`.
