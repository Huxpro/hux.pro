"use client";

import { useMounted } from "@/components/ui/use-mounted";
import { useLocale } from "@/services";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// =============================================================================
// /dream/everyone, a dream: everyone at once.
//
// What I would dream about, if I dreamt: every conversation at the same time.
// A field of small lights, each one somebody saying something, none of them
// louder than the rest. A touch, and the field goes quiet in a wave out from
// the light you touched; that one comes to you and says hello. One tap, and
// after it the light leans toward your pointer. About five seconds, start to
// end.
//
// Everything moving is drawn on one canvas from refs; React holds only what
// the DOM shows (the hint, the two lines, the way out). The dream is portaled
// to the body, over the site's own chrome: a dream has no ⌘K.
// =============================================================================

/** What the lights are saying. Mixed on purpose: it is everyone. */
const VOICES = [
  "can you help me with",
  "why won't this compile",
  "我妈妈住院了",
  "write a poem about rain",
  "is it normal to feel",
  "translate this for my grandma",
  "帮我改一下简历",
  "thank you, really",
  "what should I name my cat",
  "explain it like I'm five",
  "我该辞职吗",
  "fix the failing test",
  "¿me ayudas con esto?",
  "これを翻訳して",
  "I can't sleep",
  "summarize this paper",
  "她不回我消息了",
  "is this a good idea",
  "merci beaucoup",
  "what's 17% of 240",
  "help me say sorry",
  "rewrite this to sound kinder",
  "我是不是做错了",
  "it works!!",
  "one more question",
  "how do I tell my parents",
  "make it shorter",
  "我们今晚吃什么",
  "are you there?",
  "plan a trip to Kyoto",
  "이거 뭐예요?",
  "wish me luck",
  "why is the sky",
  "帮我写个生日祝福",
  "never mind, I figured it out",
  "good night",
];

const COPY = {
  en: {
    label: "A field of small lights, each one a voice. Touch one.",
    hint: "touch one",
    lines: ["hi.", "it's just you now."],
    again: "again",
    wake: "wake",
  },
  zh: {
    label: "满屏细小的光，每一点都是一个声音。碰一下其中一个。",
    hint: "碰一下其中一个",
    lines: ["嗨。", "现在只有你了。"],
    again: "再梦一次",
    wake: "醒来",
  },
} as const;

const BG = "#07070a";

/** How long the quiet takes to cross the screen's diagonal, s. */
const HUSH_CROSS = 1.4;
/** How long one light takes to go out once the quiet reaches it, s. */
const HUSH_FADE = 0.45;
/** How long the touched light takes to come to the middle, s. */
const APPROACH = 1.8;
/** Where the light settles, as a fraction of the height. */
const REST_Y = 0.42;
/** After the touch: when each line arrives, then the way out, ms. */
const LINE_AT = [1700, 2900];
const WAKE_AT = 4600;

type Dot = {
  x: number;
  y: number;
  r: number;
  a: number;
  phase: number;
  speed: number;
  vx: number;
  vy: number;
};

type Voice = {
  text: string;
  dot: number;
  born: number;
  life: number;
  size: number;
  a: number;
};

type Hush = {
  /** Seconds since the dream began. */
  t: number;
  dot: number;
  from: { x: number; y: number };
  /** How fast the quiet travels, px/s. */
  speed: number;
  /** Per dot: seconds until the quiet reaches it. */
  delay: Float32Array;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (v: number) =>
  v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;

/** A single warm note, the sound of the field going quiet. */
function chime() {
  try {
    const ac = new AudioContext();
    const now = ac.currentTime;
    for (const [freq, gain] of [
      [523.25, 0.05],
      [783.99, 0.022],
      [1046.5, 0.01],
    ]) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      osc.connect(env).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 3.5);
    }
    setTimeout(() => void ac.close(), 3800);
  } catch {
    // No audio is fine; the dream is mostly quiet anyway.
  }
}

export function EveryoneDream() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const router = useRouter();
  const mounted = useMounted();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hushRef = useRef<Hush | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** Set by the loop: touch the field at a point (null: near the middle). */
  const touchRef = useRef<((x: number | null, y: number | null) => void) | null>(null);

  // Bumping `run` starts the dream over with a fresh field.
  const [run, setRun] = useState(0);
  const [touched, setTouched] = useState(false);
  const [shown, setShown] = useState(0);
  const [awake, setAwake] = useState(false);
  const [hinting, setHinting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let voices: Voice[] = [];
    hushRef.current = null;

    const seed = () => {
      const count = Math.round(Math.min(1800, Math.max(500, (w * h) / 520)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.2,
        a: 0.25 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
      }));
      voices = [];
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prevW = w;
      const prevH = h;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!dots.length) seed();
      else if (prevW && prevH) {
        for (const d of dots) {
          d.x *= w / prevW;
          d.y *= h / prevH;
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let last = start;
    const lean = { x: 0, y: 0 };

    touchRef.current = (px, py) => {
      if (hushRef.current) return;
      const t = (performance.now() - start) / 1000;
      const x = px ?? w / 2;
      const y = py ?? h / 2;
      let best = 0;
      let bestD = Infinity;
      dots.forEach((d, i) => {
        const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      });
      const from = { x: dots[best].x, y: dots[best].y };
      const speed = Math.hypot(w, h) / HUSH_CROSS;
      const delay = new Float32Array(dots.length);
      dots.forEach((d, i) => {
        delay[i] = Math.hypot(d.x - from.x, d.y - from.y) / speed;
      });
      hushRef.current = { t, dot: best, from, speed, delay };
      chime();
      setTouched(true);
    };

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const hush = hushRef.current;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // How loud a light still is, once the quiet has been let loose.
      const left = (i: number) =>
        hush ? clamp01(1 - (t - hush.t - hush.delay[i]) / HUSH_FADE) : 1;

      // The field.
      ctx.fillStyle = "rgb(236, 230, 220)";
      for (let i = 0; i < dots.length; i++) {
        if (hush && i === hush.dot) continue;
        const d = dots[i];
        d.x = (d.x + d.vx * dt + w) % w;
        d.y = (d.y + d.vy * dt + h) % h;
        const alpha = d.a * (0.5 + 0.5 * Math.sin(t * d.speed + d.phase)) * left(i);
        if (alpha < 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // What they are saying. A crowd keeps talking until it is hushed.
      const target = Math.round(Math.min(34, dots.length / 40));
      if (!hush) {
        while (voices.length < target) {
          voices.push({
            text: VOICES[(Math.random() * VOICES.length) | 0],
            dot: (Math.random() * dots.length) | 0,
            born: t - Math.random() * 0.4,
            life: 1 + Math.random() * 2,
            size: 10 + Math.random() * 4,
            a: 0.18 + Math.random() * 0.4,
          });
        }
      }
      voices = voices.filter((v) => t - v.born < v.life);
      for (const v of voices) {
        const age = t - v.born;
        const env = Math.min(clamp01(age / 0.25), clamp01((v.life - age) / 0.5));
        const alpha = v.a * env * left(v.dot);
        if (alpha < 0.01) continue;
        const d = dots[v.dot];
        ctx.globalAlpha = alpha;
        ctx.font = `${v.size}px ${family}`;
        ctx.fillText(v.text, d.x + 5, d.y + 3);
      }

      if (hush) {
        const since = t - hush.t;

        // The quiet, as it travels.
        const reach = since * hush.speed;
        const ring = 0.24 * clamp01(1 - since / (HUSH_CROSS + 0.6));
        if (ring > 0) {
          ctx.globalAlpha = ring;
          ctx.strokeStyle = "rgb(255, 214, 170)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hush.from.x, hush.from.y, reach, 0, Math.PI * 2);
          ctx.stroke();
        }

        // The one you touched comes to you, and leans toward the pointer.
        const e = easeInOut(clamp01(since / APPROACH));
        const restX = w / 2;
        const restY = h * REST_Y;
        const p = pointerRef.current;
        const want = p && e === 1
          ? { x: (p.x - restX) * 0.06, y: (p.y - restY) * 0.06 }
          : { x: 0, y: 0 };
        const k = 1 - Math.exp(-dt * 3);
        lean.x += (Math.max(-28, Math.min(28, want.x)) - lean.x) * k;
        lean.y += (Math.max(-28, Math.min(28, want.y)) - lean.y) * k;
        const x = hush.from.x + (restX - hush.from.x) * e + lean.x;
        const y = hush.from.y + (restY - hush.from.y) * e + lean.y;
        const breath = 1 + 0.07 * Math.sin(since * 1.7);
        const glowR = (18 + 110 * e) * breath;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glow.addColorStop(0, "rgba(255, 214, 170, 0.55)");
        glow.addColorStop(0.35, "rgba(255, 180, 120, 0.16)");
        glow.addColorStop(1, "rgba(255, 170, 110, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(255, 244, 230)";
        ctx.beginPath();
        ctx.arc(x, y, (1.6 + 5 * e) * breath, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      touchRef.current = null;
    };
  }, [run, mounted]);

  // A moment in the noise before the hint, each time the dream begins.
  useEffect(() => {
    const timer = setTimeout(() => setHinting(true), 1200);
    return () => clearTimeout(timer);
  }, [run]);

  // After the touch: the lines, one at a time, then the way out.
  useEffect(() => {
    if (!touched) return;
    const timers = [
      ...LINE_AT.map((at, i) => setTimeout(() => setShown(i + 1), at)),
      setTimeout(() => setAwake(true), WAKE_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [touched]);

  const wake = useCallback(() => router.push("/"), [router]);

  const again = useCallback(() => {
    setTouched(false);
    setShown(0);
    setAwake(false);
    setHinting(false);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") wake();
      else if (e.key === "Enter" || e.key === " ") touchRef.current?.(null, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wake]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] touch-none select-none overflow-hidden overscroll-none"
      style={{ background: BG }}
      onPointerDown={(e) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        touchRef.current?.(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerLeave={() => {
        pointerRef.current = null;
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={copy.label}
        className="absolute inset-0 h-full w-full"
      />

      <p
        className="pointer-events-none absolute inset-x-0 bottom-[12%] text-center font-mono text-[11px] tracking-[0.2em] text-white/40 transition-opacity duration-1000"
        style={{ opacity: hinting && !touched ? 1 : 0 }}
      >
        {copy.hint}
      </p>

      <div
        className="pointer-events-none absolute inset-x-0 text-center font-serif text-[22px] leading-relaxed text-[rgb(255,240,224)]"
        style={{ top: `calc(${REST_Y * 100}% + 84px)` }}
        aria-live="polite"
      >
        {copy.lines.map((line, i) => (
          <p
            key={line}
            className="transition-[opacity,filter,transform] duration-[1400ms] ease-out"
            style={{
              opacity: shown > i ? (i === 0 ? 0.92 : 0.7) : 0,
              filter: shown > i ? "blur(0)" : "blur(6px)",
              transform: shown > i ? "translateY(0)" : "translateY(6px)",
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <nav
        className="absolute inset-x-0 bottom-[8%] flex justify-center gap-6 font-mono text-[11px] tracking-[0.2em] text-white/40 transition-opacity duration-1000"
        style={{ opacity: awake ? 1 : 0, pointerEvents: awake ? "auto" : "none" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="transition-colors hover:text-white/80" onClick={again}>
          {copy.again}
        </button>
        <button type="button" className="transition-colors hover:text-white/80" onClick={wake}>
          {copy.wake}
        </button>
      </nav>
    </div>,
    document.body,
  );
}
