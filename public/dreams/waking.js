/*
  Waking: the end every dream here shares.

  The dream is over the moment the screen goes black. What follows is not a
  dream: a beat of silence; the eyes snap open with a gasp, the head off the
  pillow, the room out of focus and coming in; panting that slows, each
  breath lifting the view; two ordinary blinks; a clock somewhere in the
  house. Still night, the same bedroom, only the bedroom: sharp, still,
  empty. You calm down. Then the breath catches, and the wardrobe door
  begins to open, slowly. In the gap, the eye.

  The Wardrobe draws this in its own scene; Look Up and Torch, whose dreams
  happen elsewhere, mount this layer over theirs when they go black:

    const waking = DreamWaking.mount(stage, {
      words: { epilogue, replay },
      sound: () => ctx && { ctx, master },  // the page's audio, if it has any
      onReplay: () => { ... },              // a tap after the last line
    });
    waking.start();     // the screen is already black; take it from there
    waking.still(17);   // one frame, so many seconds in (stills, the lab)
    waking.reset();

  No dependencies; the bedroom is drawn as The Wardrobe draws it.
*/
(() => {
  "use strict";

  const CSS = `
  .wk { position: absolute; inset: 0; z-index: 4; display: none; background: #05070d; overflow: hidden; touch-action: none; }
  .wk.on { display: block; }
  .wk svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .wk .wk-room { filter: blur(9px) brightness(0.45); }
  .wk.focus .wk-room { filter: none; transition: filter 2.2s cubic-bezier(0.2, 0.6, 0.3, 1); }
  .wk.jolt { animation: wk-jolt 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
  @keyframes wk-jolt {
    0% { transform: translateY(22px) scale(1.07); }
    35% { transform: translateY(-6px) scale(1.01); }
    100% { transform: none; }
  }
  .wk-breath { transform-box: view-box; transform-origin: 50% 92%; }
  .wk-grain { position: absolute; inset: -50%; pointer-events: none; opacity: 0.05; mix-blend-mode: screen; animation: wk-grain 0.5s steps(5) infinite; }
  @keyframes wk-grain {
    0% { transform: translate(0, 0); } 20% { transform: translate(-7%, 4%); }
    40% { transform: translate(5%, -6%); } 60% { transform: translate(-3%, -9%); }
    80% { transform: translate(8%, 6%); } 100% { transform: translate(0, 0); }
  }
  .wk-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0, 0, 0, 0.75) 100%); }
  .wk-lid { position: absolute; left: -10%; width: 120%; height: 62%; background: #000; pointer-events: none; transition: transform 0.13s cubic-bezier(0.3, 0, 0.2, 1); }
  .wk-lid::after { content: ""; position: absolute; left: 0; right: 0; height: 18%; filter: blur(10px); background: #000; }
  .wk-lid.top { top: 0; transform: translateY(-104%); border-radius: 0 0 50% 50% / 0 0 22% 22%; }
  .wk-lid.top::after { bottom: -9%; border-radius: 50%; }
  .wk-lid.bottom { bottom: 0; transform: translateY(104%); border-radius: 50% 50% 0 0 / 22% 22% 0 0; }
  .wk-lid.bottom::after { top: -9%; border-radius: 50%; }
  .wk.shut .wk-lid { transform: translateY(0); }
  .wk.blink .wk-lid { transition-duration: 0.09s; }
  .wk-eye { opacity: 0; }
  .wk.peek .wk-eye { opacity: 1; transition: opacity 2.6s ease; }
  .wk-fade { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity 1.4s ease; }
  .wk-line {
    position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); padding: 0 28px;
    text-align: center; pointer-events: none; opacity: 0; transition: opacity 1.2s ease; letter-spacing: 0.08em;
    font-size: 17px; line-height: 1.9; color: rgba(236, 238, 245, 0.88); text-shadow: 0 0 18px rgba(0, 0, 0, 0.9);
  }
  .wk-line small { display: block; margin-top: 28px; font-size: 12px; letter-spacing: 0.2em; color: rgba(236, 238, 245, 0.4); }
  .wk.done .wk-fade { opacity: 0.62; }
  .wk.done .wk-line { opacity: 1; }
  @media (prefers-reduced-motion: reduce) { .wk.jolt, .wk-grain { animation: none; } }
  `;

  // The bedroom at night, from the pillow: The Wardrobe's room, awake.
  const ROOM = `
  <svg class="wk-room" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="wk-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0e1b"/><stop offset="0.75" stop-color="#0e1426"/><stop offset="1" stop-color="#0a0e1b"/></linearGradient>
      <linearGradient id="wk-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080b15"/><stop offset="1" stop-color="#04060c"/></linearGradient>
      <linearGradient id="wk-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3c4e78"/><stop offset="1" stop-color="#1b2642"/></linearGradient>
      <radialGradient id="wk-moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5a6d9c" stop-opacity="0.32"/><stop offset="1" stop-color="#5a6d9c" stop-opacity="0"/></radialGradient>
      <linearGradient id="wk-beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ea2d6" stop-opacity="0.12"/><stop offset="1" stop-color="#8ea2d6" stop-opacity="0"/></linearGradient>
      <linearGradient id="wk-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a2440"/><stop offset="1" stop-color="#101729"/></linearGradient>
      <linearGradient id="wk-door" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18213a"/><stop offset="1" stop-color="#0d1322"/></linearGradient>
      <linearGradient id="wk-inside" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1020"/><stop offset="0.6" stop-color="#101830"/><stop offset="1" stop-color="#0b1122"/></linearGradient>
      <linearGradient id="wk-blanket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2440"/><stop offset="0.35" stop-color="#111829"/><stop offset="1" stop-color="#070a12"/></linearGradient>
      <filter id="wk-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
      <clipPath id="wk-in"><rect x="213" y="222" width="145" height="418"/></clipPath>
      <g id="wk-man">
        <path d="M -27 -381 C -29 -404 -17 -419 0 -419 C 17 -419 29 -404 27 -381 Z"/>
        <ellipse cx="0" cy="-379" rx="76" ry="8.5"/>
        <ellipse cx="0" cy="-362" rx="12" ry="17"/>
        <rect x="-5" y="-350" width="10" height="16"/>
        <path d="M -24 -338 Q -28 -300 -19 -240 Q -16 -200 -21 -150 L -29 0 L 29 0 L 21 -150 Q 16 -200 19 -240 Q 28 -300 24 -338 Q 0 -344 -24 -338 Z"/>
        <path d="M -24 -338 Q -34 -332 -33 -300 L -32 -178 L -24 -178 L -25 -300 Q -25 -322 -20 -334 Z"/>
        <path d="M 24 -338 Q 34 -332 33 -300 L 32 -178 L 24 -178 L 25 -300 Q 25 -322 20 -334 Z"/>
      </g>
    </defs>
    <g class="wk-breath">
      <rect x="-200" y="-200" width="790" height="840" fill="url(#wk-wall)"/>
      <rect x="-200" y="640" width="790" height="400" fill="url(#wk-floor)"/>
      <rect x="-200" y="636" width="790" height="5" fill="#141b30"/>
      <ellipse cx="96" cy="282" rx="150" ry="170" fill="url(#wk-moon)"/>
      <rect x="40" y="172" width="112" height="214" fill="url(#wk-glass)"/>
      <circle cx="122" cy="214" r="13" fill="#b9c5e6" opacity="0.55" filter="url(#wk-soft)"/>
      <rect x="94" y="172" width="4" height="214" fill="#0b1020"/>
      <rect x="40" y="276" width="112" height="4" fill="#0b1020"/>
      <rect x="34" y="166" width="124" height="7" fill="#0b1020"/>
      <rect x="34" y="384" width="124" height="7" fill="#0b1020"/>
      <path d="M 16 158 C 40 230 26 330 44 404 L 0 410 L -10 158 Z" fill="#0b1020"/>
      <path d="M 142 158 C 150 220 132 300 150 402 L 176 404 C 166 300 180 220 170 158 Z" fill="#0b1020"/>
      <path d="M 40 386 L 152 386 L 330 700 L 120 700 Z" fill="url(#wk-beam)" filter="url(#wk-soft)"/>
      <rect x="200" y="200" width="172" height="14" fill="#141c33"/>
      <rect x="205" y="212" width="161" height="430" fill="url(#wk-wood)"/>
      <rect x="213" y="222" width="145" height="418" fill="url(#wk-inside)"/>
      <g clip-path="url(#wk-in)">
        <rect x="213" y="244" width="145" height="2" fill="#070b16"/>
        <path d="M 220 246 L 214 410 L 236 412 L 232 246 Z" fill="#080c18"/>
        <path d="M 344 246 L 338 396 L 360 398 L 356 246 Z" fill="#080c18"/>
        <use href="#wk-man" x="285.5" y="640" fill="#4a5c94" opacity="0.6" transform="translate(-1.6 0)"/>
        <use href="#wk-man" x="285.5" y="640" fill="#000"/>
        <circle class="wk-eye" cx="289.6" cy="277" r="1.5" fill="#d3dcf2"/>
      </g>
      <rect x="213" y="222" width="73" height="418" fill="url(#wk-door)"/>
      <rect x="221" y="236" width="57" height="180" fill="none" stroke="#1c2745" stroke-width="2"/>
      <rect x="221" y="432" width="57" height="190" fill="none" stroke="#1c2745" stroke-width="2"/>
      <rect x="279" y="410" width="3" height="26" rx="1.5" fill="#2a3658"/>
      <path class="wk-door" fill="url(#wk-door)" stroke="#060910" stroke-width="1"/>
      <path class="wk-panels" fill="none" stroke="#1c2745" stroke-width="2"/>
      <path class="wk-handle" fill="#2a3658"/>
      <path d="M -40 760 C 40 724 120 742 170 716 C 214 694 250 690 286 704 C 330 722 360 708 430 716 L 430 900 L -40 900 Z" fill="url(#wk-blanket)"/>
      <path d="M -40 760 C 40 724 120 742 170 716 C 214 694 250 690 286 704 C 330 722 360 708 430 716" fill="none" stroke="#2c3962" stroke-width="1.4" opacity="0.7"/>
    </g>
  </svg>`;

  const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
  const poly = (q) => "M" + q.map((r) => r[0].toFixed(2) + " " + r[1].toFixed(2)).join(" L") + " Z";

  function mount(stage, { words, sound = () => null, onReplay = () => {} }) {
    if (!document.getElementById("wk-style")) {
      const style = document.createElement("style");
      style.id = "wk-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    const el = document.createElement("div");
    el.className = "wk";
    el.innerHTML = `${ROOM}<div class="wk-grain"></div><div class="wk-vignette"></div><div class="wk-fade"></div>
      <div class="wk-line">${words.epilogue}<small>${words.replay}</small></div>
      <div class="wk-lid top"></div><div class="wk-lid bottom"></div>`;
    stage.appendChild(el);
    const svg = el.querySelector("svg");
    const breathEl = el.querySelector(".wk-breath");
    const door = el.querySelector(".wk-door"), panels = el.querySelector(".wk-panels"), handle = el.querySelector(".wk-handle");

    const fit = () => svg.setAttribute("preserveAspectRatio", innerWidth / innerHeight > 0.62 ? "xMidYMid meet" : "xMidYMid slice");
    addEventListener("resize", fit);
    fit();
    const grain = stage.querySelector("#grain");
    if (grain) el.querySelector(".wk-grain").style.background = grain.style.background;

    // The right door, hinged at its right edge, swinging toward the bed.
    function drawDoor(open) {
      const HINGE = 358, W = 72, TOP = 222, BOTTOM = 640, CX = 195, CY = 470;
      const a = open * 1.95;
      const fx = HINGE - W * Math.cos(a), fz = W * Math.sin(a);
      const p = (u, y) => {
        const s = 1 / (1 - fz * u * 0.0026);
        return [CX + (HINGE + (fx - HINGE) * u - CX) * s, CY + (y - CY) * s];
      };
      door.setAttribute("d", poly([p(0, TOP), p(1, TOP), p(1, BOTTOM), p(0, BOTTOM)]));
      panels.setAttribute("d",
        poly([p(0.11, 236), p(0.89, 236), p(0.89, 416), p(0.11, 416)]) + " " +
        poly([p(0.11, 432), p(0.89, 432), p(0.89, 622), p(0.11, 622)]));
      handle.setAttribute("d", poly([p(0.9, 410), p(0.94, 410), p(0.94, 436), p(0.9, 436)]));
      door.style.filter = `brightness(${(0.72 + 0.36 * Math.cos(a)).toFixed(3)})`;
    }

    // -------------------------------------------------------------------------
    // Sound, through the page's own graph.
    // -------------------------------------------------------------------------
    let noise = null, tone = null, tock = false;
    function out() {
      const a = sound();
      if (!a || !a.ctx) return null;
      if (!noise || noise.sampleRate !== a.ctx.sampleRate) {
        noise = a.ctx.createBuffer(1, a.ctx.sampleRate * 2, a.ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return a;
    }
    function air(a, t, { type = "bandpass", f0, f1, q = 0.8, peak, attack, dur }) {
      const { ctx, master } = a;
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter();
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.linearRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random());
      s.stop(t + dur + 0.05);
    }
    function thump(strength) {
      const a = out(); if (!a) return;
      const { ctx, master } = a;
      [0, 0.17].forEach((dt, i) => {
        const t = ctx.currentTime + 0.01 + dt;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(strength * (i ? 0.6 : 1), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + 0.3);
      });
    }
    function gasp() {
      const a = out(); if (!a) return;
      const t = a.ctx.currentTime;
      air(a, t, { f0: 700, f1: 2300, q: 1.1, peak: 0.55, attack: 0.07, dur: 0.5 });
      air(a, t + 0.02, { type: "lowpass", f0: 500, f1: 900, peak: 0.25, attack: 0.05, dur: 0.4 });
      thump(0.9);
    }
    function breathe(inhale, amp) {
      const a = out(); if (!a) return;
      const t = a.ctx.currentTime;
      if (inhale) air(a, t, { f0: 900, f1: 1500, q: 0.9, peak: 0.16 * amp + 0.02, attack: 0.18, dur: 0.42 });
      else air(a, t, { type: "lowpass", f0: 1100, f1: 450, peak: 0.2 * amp + 0.025, attack: 0.05, dur: 0.6 + 0.4 * (1 - amp) });
    }
    function tick(level) {
      const a = out(); if (!a) return;
      const { ctx, master } = a;
      const t = ctx.currentTime;
      tock = !tock;
      const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = "square";
      o.frequency.value = tock ? 2350 : 2650;
      bp.type = "bandpass"; bp.frequency.value = tock ? 2400 : 2800; bp.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * level, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(bp).connect(g).connect(master);
      o.start(t); o.stop(t + 0.04);
    }
    // The quiet of a real room: a little low noise, nothing else.
    function roomTone(on) {
      const a = out(); if (!a) return;
      const { ctx, master } = a;
      if (!tone) {
        const s = ctx.createBufferSource();
        s.buffer = noise; s.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 200;
        tone = ctx.createGain();
        tone.gain.value = 0;
        s.connect(lp).connect(tone).connect(master);
        s.start();
      }
      tone.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, on ? 0.8 : 0.1);
    }
    function creak(duration, level) {
      const a = out(); if (!a) return;
      const { ctx, master } = a;
      const t0 = ctx.currentTime + 0.05;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 9;
      bp.frequency.setValueAtTime(520, t0);
      bp.frequency.linearRampToValueAtTime(760, t0 + duration * 0.55);
      bp.frequency.linearRampToValueAtTime(610, t0 + duration);
      const g = ctx.createGain();
      g.gain.value = 1.4 * level;
      bp.connect(g).connect(master);
      const c = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.004), ctx.sampleRate);
      const cd = c.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length);
      let t = t0;
      while (t < t0 + duration) {
        const u = (t - t0) / duration;
        const s = ctx.createBufferSource(), sg = ctx.createGain();
        s.buffer = c;
        sg.gain.value = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.2));
        s.connect(sg).connect(bp); s.start(t);
        t += 0.007 + 0.016 * u + Math.random() * 0.012 + (Math.random() < 0.05 ? 0.09 : 0);
      }
    }

    // -------------------------------------------------------------------------
    // The timeline, in seconds since start().
    // -------------------------------------------------------------------------
    let W = null, raf = 0, startAt = 0, lastNow = 0, silent = false;

    function blink() {
      el.classList.add("blink", "shut");
      setTimeout(() => el.classList.remove("shut"), 110);
      setTimeout(() => el.classList.remove("blink"), 300);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const t = (now - startAt) / 1000;
      if (!W.snapped && t > 1.0) {
        W.snapped = true;
        el.classList.add("jolt", "focus");
        el.classList.remove("shut");
        if (!silent) {
          gasp();
          roomTone(true);
          if (navigator.vibrate) navigator.vibrate(60);
        }
        setTimeout(() => el.classList.remove("jolt"), 900);
      }
      if (W.blinks === 0 && t > 3.6) { W.blinks = 1; blink(); }
      if (W.blinks === 1 && t > 7.4) { W.blinks = 2; blink(); }

      const u = ease((t - 1) / 8);
      const amp = 1 - 0.78 * u;
      if (W.snapped && !W.held) {
        const period = 0.62 + (3.0 - 0.62) * u;
        const before = W.breath;
        W.breath += dt / period;
        if (!silent && Math.floor(before) !== Math.floor(W.breath)) breathe(true, amp);
        const ph = W.breath % 1;
        if (!silent && before % 1 < 0.42 && ph >= 0.42) breathe(false, amp);
        W.h = (ph < 0.42 ? ease(ph / 0.42) : 1 - ease((ph - 0.42) / 0.58)) * amp;
      } else if (W.held) {
        W.h += (0.5 - W.h) * Math.min(1, dt * 3);
      }
      breathEl.style.transform = `translateY(${(-5 * W.h).toFixed(2)}px) scale(${(1 + 0.016 * W.h).toFixed(4)})`;

      if (!silent && W.snapped && t < 5 && now > W.nextBeat) {
        thump(0.6 * (1 - (t - 1) / 4) + 0.05);
        W.nextBeat = now + 480 + 400 * ((t - 1) / 4);
      }
      if (!silent && t > 4.5 && now > W.nextTick) {
        tick(Math.min(1, (t - 4.5) / 2.5));
        W.nextTick = now + 1000;
      }
      let open = 0;
      if (t > 9.5) {
        if (!W.door) {
          W.door = true;
          W.held = true;
          if (!silent) creak(6.5, 0.6);
        }
        open = 0.36 * ease((t - 9.5) / 6.5);
        if (!silent && now > W.nextBeat) {
          const k = ease((t - 10.5) / 6);
          thump(0.12 + 0.5 * k);
          W.nextBeat = now + 1000 - 420 * k;
        }
      }
      drawDoor(open);
      if (!W.peek && t > 16) { W.peek = true; el.classList.add("peek"); }
      if (!W.done && t > 18.5) { W.done = true; el.classList.add("done"); }
      raf = requestAnimationFrame(frame);
    }

    function begin(at, quiet) {
      cancelAnimationFrame(raf);
      silent = quiet;
      W = { snapped: false, blinks: 0, breath: 0, h: 0, held: false, door: false, nextTick: 0, nextBeat: 0, peek: false, done: false };
      el.className = "wk on shut";
      startAt = at;
      lastNow = performance.now();
      drawDoor(0);
      raf = requestAnimationFrame(frame);
    }

    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (W && W.done) { reset(); onReplay(); }
    });

    function reset() {
      cancelAnimationFrame(raf);
      roomTone(false);
      el.className = "wk";
      breathEl.style.transform = "";
    }

    return {
      /** The screen has gone black: wake from here. */
      start: () => begin(performance.now(), false),
      /** Seconds in, held from there without sound (stills). */
      still: (seconds) => begin(performance.now() - seconds * 1000, true),
      reset,
      get done() { return !!(W && W.done); },
    };
  }

  window.DreamWaking = { mount };
})();
