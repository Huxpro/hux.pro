#!/usr/bin/env node
// =============================================================================
// wallpaper-scroll-profile — what does scrolling the home page cost, per
// wallpaper and placement?
//
//   pnpm build && pnpm start &          # or: pnpm dev
//   pnpm wallpapers:profile
//
// In `widget` placement every card paints the wallpaper as a viewport-anchored
// background (`components/ui/widget.tsx`, `systems/ambient/components/
// gradient-stack.tsx`). With an image wallpaper that is a 2560×1600 photograph
// resampled per card — and a browser cannot scroll a fixed background on the
// compositor, so each scrolled frame may re-raster it once per visible card.
//
// That is a claim about browsers, not a measurement, which is what this script
// is for. It drives a real scroll gesture over the home page in each
// combination and reports the raster and paint time the browser's own trace
// records, so "the photo is expensive in widget placement" is a number rather
// than an inference.
//
// It is deliberately a comparison, not a benchmark. The absolute figures belong
// to the machine and the browser that produced them — a headless run rasters on
// the CPU and will not match a GPU-composited desktop — but the four cases run
// back to back under identical conditions, so the RATIO between them is the
// finding. Point it at a real browser (`CHROME=...`, `HEADFUL=1`) to check the
// ratio holds there.
//
//   APP_URL   the running site            (default http://127.0.0.1:3000)
//   CHROME    browser binary              (default: the usual install paths)
//   HEADFUL   1 to watch it happen
//   WALLPAPER catalog id to profile       (default earth-moon-horizon, the
//             largest photograph in the set at 2844×1600)
// =============================================================================

import { spawn } from "node:child_process";
import process from "node:process";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const WALLPAPER = process.env.WALLPAPER ?? "earth-moon-horizon";
const HEADFUL = process.env.HEADFUL === "1";
const PORT = 9922;

const CHROME_CANDIDATES = [
  process.env.CHROME,
  process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : null,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((p): p is string => !!p);

/**
 * The four combinations that isolate the cost.
 *
 * `image · widget` is the case under suspicion. The other three are the
 * controls: the same photograph painted once in a single fixed layer, the same
 * per-card treatment with a gradient instead of a photograph, and no wallpaper
 * at all — so a difference can be attributed to the photograph, to the
 * per-card painting, or to neither.
 */
const CASES = [
  { name: "image · widget", kind: "image", placement: "widget" },
  { name: "image · full", kind: "image", placement: "full" },
  { name: "weather · widget", kind: "weather", placement: "widget" },
  { name: "none · off", kind: "image", placement: "off" },
] as const;

/** Trace events that are the browser turning boxes into pixels. */
const PAINT_EVENTS = new Set([
  "Paint",
  "RasterTask",
  "Rasterize",
  "ImageDecodeTask",
  "Decode Image",
  "DecodeImage",
  "CompositeLayers",
  "UpdateLayerTree",
  "PrePaint",
  "Layerize",
]);

/** One scroll down the page and back up, as four gestures. */
const SCROLL_STEPS = [900, 900, -900, -900];
const SCROLL_SPEED = 1200; // px/s, roughly a firm trackpad flick

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// A very small CDP client. Node's global WebSocket, no dependencies: this is a
// dev script, and a browser driver is a heavy thing to add to the lockfile for
// it.
// -----------------------------------------------------------------------------

type Json = unknown;

interface Message {
  id?: number;
  method?: string;
  params?: Record<string, Json>;
  result?: Record<string, Json>;
  error?: Json;
  sessionId?: string;
}

class Cdp {
  private id = 0;
  private pending = new Map<
    number,
    { resolve: (v: Record<string, Json>) => void; reject: (e: Error) => void }
  >();
  private ws: WebSocket;
  listeners: ((m: Message) => void)[] = [];

  // Not a parameter property: `node file.ts` strips types rather than compiling
  // them, and that is one of the forms it cannot strip.
  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (e) => {
      const msg: Message = JSON.parse(String((e as MessageEvent).data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result ?? {});
      } else if (msg.method) {
        for (const l of [...this.listeners]) l(msg);
      }
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new Cdp(ws);
  }

  send(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string
  ): Promise<Record<string, Json>> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(method: string): Promise<Record<string, Json> | undefined> {
    return new Promise((resolve) => {
      const l = (m: Message) => {
        if (m.method !== method) return;
        this.listeners = this.listeners.filter((x) => x !== l);
        resolve(m.params);
      };
      this.listeners.push(l);
    });
  }

  close() {
    this.ws.close();
  }
}

async function launchBrowser() {
  const bin = CHROME_CANDIDATES[0];
  const args = [
    `--remote-debugging-port=${PORT}`,
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=/tmp/wallpaper-scroll-profile-${PORT}`,
    "--window-size=1280,900",
    "--force-device-scale-factor=1",
    ...(HEADFUL ? [] : ["--headless=new"]),
    "about:blank",
  ];
  const proc = spawn(bin, args, { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const version = (await r.json()) as { webSocketDebuggerUrl: string };
      return { proc, wsUrl: version.webSocketDebuggerUrl };
    } catch {
      await sleep(200);
    }
  }
  proc.kill();
  throw new Error(`Could not start a browser (tried ${bin}). Set CHROME=<path>.`);
}

async function profileCase(cdp: Cdp, c: (typeof CASES)[number]) {
  const { targetId } = (await cdp.send("Target.createTarget", {
    url: "about:blank",
  })) as { targetId: string };
  const { sessionId } = (await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  })) as { sessionId: string };
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  // The settings blob the ambient provider hydrates from, so the page comes up
  // in the combination being measured rather than being clicked into it.
  await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `try { localStorage.setItem("hux_ambient_settings", ${JSON.stringify(
        JSON.stringify({
          locationMode: "ip",
          wallpaperPlacement: c.placement,
          wallpaperKind: c.kind,
          wallpaperId: WALLPAPER,
          wallpaperReadingBlur: true,
          wallpaperReadingDim: true,
        })
      )}); localStorage.setItem("hux_music_mock", "1"); } catch {}`,
    },
    sessionId
  );

  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: APP_URL + "/" }, sessionId);
  await loaded;
  // Long enough for hydration, the first crossfade and its prune.
  await sleep(3500);

  const evaluate = async (expression: string) => {
    const r = (await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId
    )) as { exceptionDetails?: Json; result: { value: Json } };
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  // Frame intervals from inside the page, next to the browser's own trace: one
  // says how much work there was, the other whether it arrived in time.
  await evaluate(`(() => {
    globalThis.__frames = [];
    globalThis.__stop = false;
    let last = performance.now();
    const tick = (t) => {
      globalThis.__frames.push(t - last);
      last = t;
      if (!globalThis.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return null;
  })()`);

  /** The subset of a trace event this reads: a name and a duration in µs. */
  interface TraceEvent {
    name: string;
    ph: string;
    dur?: number;
  }

  const events: TraceEvent[] = [];
  const collect = (m: Message) => {
    if (m.method !== "Tracing.dataCollected") return;
    events.push(...((m.params?.value ?? []) as TraceEvent[]));
  };
  cdp.listeners.push(collect);
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,disabled-by-default-devtools.timeline",
    transferMode: "ReportEvents",
  });

  for (const dy of SCROLL_STEPS) {
    await cdp.send(
      "Input.synthesizeScrollGesture",
      { x: 640, y: 450, xDistance: 0, yDistance: -dy, speed: SCROLL_SPEED },
      sessionId
    );
  }
  await sleep(400);

  const complete = cdp.once("Tracing.tracingComplete");
  await cdp.send("Tracing.end");
  await complete;
  cdp.listeners = cdp.listeners.filter((l) => l !== collect);

  await evaluate("globalThis.__stop = true, null");
  // The first few frames are the gesture starting, not scrolling.
  const frames = (await evaluate("globalThis.__frames.slice(5)")) as number[];

  const byName: Record<string, number> = {};
  for (const e of events) {
    if (e.ph !== "X" || !e.dur || !PAINT_EVENTS.has(e.name)) continue;
    byName[e.name] = (byName[e.name] ?? 0) + e.dur / 1000;
  }

  await cdp.send("Target.closeTarget", { targetId });

  const sorted = [...frames].sort((a, b) => a - b);
  return {
    name: c.name,
    raster: byName.RasterTask ?? 0,
    paintTotal: Object.values(byName).reduce((a, b) => a + b, 0),
    byName,
    frames: frames.length,
    dropped: frames.filter((f) => f > 20).length,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
  };
}

async function main() {
  try {
    await fetch(APP_URL);
  } catch {
    console.error(`Nothing is serving ${APP_URL}. Start the site first, or set APP_URL.`);
    process.exitCode = 1;
    return;
  }

  const { proc, wsUrl } = await launchBrowser();
  const cdp = await Cdp.connect(wsUrl);

  const rows = [];
  for (const c of CASES) rows.push(await profileCase(cdp, c));

  cdp.close();
  proc.kill();

  console.log(`\nhome page, ${WALLPAPER}, scroll down and back up${HEADFUL ? "" : " (headless)"}\n`);
  console.log(
    "case".padEnd(18),
    "raster".padStart(9),
    "paint+raster".padStart(13),
    "frames".padStart(7),
    ">20ms".padStart(6),
    "p95".padStart(7)
  );
  const baseline = rows.find((r) => r.name === "none · off")?.raster ?? 0;
  for (const r of rows) {
    console.log(
      r.name.padEnd(18),
      `${r.raster.toFixed(0)}ms`.padStart(9),
      `${r.paintTotal.toFixed(0)}ms`.padStart(13),
      String(r.frames).padStart(7),
      String(r.dropped).padStart(6),
      `${r.p95.toFixed(1)}ms`.padStart(7)
    );
  }
  if (baseline > 0) {
    const widget = rows.find((r) => r.name === "image · widget");
    if (widget) {
      console.log(
        `\nA photograph in widget placement rasters ${(widget.raster / baseline).toFixed(1)}× ` +
          `what the same scroll costs with no wallpaper.`
      );
    }
  }
  console.log(
    "\nRatios are the finding; the absolute numbers belong to this machine and browser."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
