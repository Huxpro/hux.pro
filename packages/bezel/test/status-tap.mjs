// =============================================================================
// The status-bar tap, in a real browser.
//
//   node packages/bezel/test/status-tap.mjs
//
// The gesture itself is Safari's and cannot be produced here — what Safari
// does to the page, though, is exactly one thing: it scrolls the main frame to
// 0. That is reproducible anywhere, and everything this module gets wrong is
// on the page's side of it.
//
// So the harness compiles the package's own sources, puts them in a container
// scroll fixture, and drives the cases that broke on a phone: the tap arriving
// mid-fling, a fling that outlives the kill, a scroll lock taking <html> away,
// a finger landing on a page already on its way up.
//
// Chromium is not WebKit. It shares the rendering loop this depends on (a
// frame's scroll events, then its animation frame callbacks), which is what
// the ordering cases are about. The park sticking at all is the one thing only
// a phone can confirm.
// =============================================================================

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PACKAGE = join(HERE, "..");
const REPO = join(PACKAGE, "..", "..");

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      /* next */
    }
  }
  return null;
}

// -- the fixture ------------------------------------------------------------
// A page in container scroll: the package's stylesheet, a fixed <body>, a tall
// container. `window.__tap` is this harness's hand on the page.

const FIXTURE = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0 }
  #bezel-scroll { top: 0; bottom: 0; left: 0; right: 0 }
  #tall { height: 6000px; background: linear-gradient(#eee, #333) }
</style>
</head>
<body>
  <div id="bezel-scroll"><div id="tall"></div></div>
  <script type="importmap">{"imports":{"react":"/react.js"}}</script>
  <script type="module">
    import { ensureBezelStyle } from "/css.js";
    import { SCROLL_ATTRIBUTE } from "/constants.js";
    import { enableStatusTapToTop } from "/status-tap.js";

    ensureBezelStyle();
    document.documentElement.setAttribute(SCROLL_ATTRIBUTE, "container");

    const el = document.getElementById("bezel-scroll");
    const stop = enableStatusTapToTop();

    window.__tap = {
      stop,
      el,
      /** Wait n animation frames. */
      frames: (n = 1) =>
        new Promise((resolve) => {
          const tick = () => (n-- <= 0 ? resolve() : requestAnimationFrame(tick));
          tick();
        }),
      /** Sample the container every frame for ms. */
      sample: (ms) =>
        new Promise((resolve) => {
          const out = [];
          const t0 = performance.now();
          const tick = () => {
            out.push(Math.round(el.scrollTop));
            if (performance.now() - t0 < ms) requestAnimationFrame(tick);
            else resolve(out);
          };
          tick();
        }),
      touch: (type) => {
        const touch = new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: 300 });
        document.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === "touchend" || type === "touchcancel" ? [] : [touch],
            targetTouches: [],
            changedTouches: [touch],
          })
        );
      },
      state: () => ({
        armed: document.documentElement.hasAttribute("data-bezel-status-tap"),
        windowY: window.scrollY,
        container: Math.round(el.scrollTop),
        htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      }),
    };
  </script>
</body>
</html>`;

const REACT_STUB = `export const useEffect = () => {};
export const useRef = (v) => ({ current: v });
export default { useEffect, useRef };
`;

// -- build ------------------------------------------------------------------

function build() {
  const out = mkdtempSync(join(tmpdir(), "bezel-status-tap-"));
  execFileSync(
    join(REPO, "node_modules", ".bin", "tsc"),
    [
      join(PACKAGE, "src", "status-tap.ts"),
      join(PACKAGE, "src", "css.ts"),
      "--outDir",
      out,
      "--target",
      "es2022",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--skipLibCheck",
      "--jsx",
      "react-jsx",
    ],
    { stdio: "inherit" }
  );
  writeFileSync(join(out, "react.js"), REACT_STUB);
  writeFileSync(join(out, "index.html"), FIXTURE);
  return out;
}

function serve(dir) {
  const types = { ".js": "text/javascript", ".html": "text/html" };
  const server = createServer((req, res) => {
    let path = (req.url ?? "/").split("?")[0];
    if (path === "/") path = "/index.html";
    // tsc leaves relative specifiers extensionless; the browser needs the file.
    if (!extname(path)) path += ".js";
    try {
      const body = readFileSync(join(dir, path));
      res.writeHead(200, { "content-type": types[extname(path)] ?? "text/plain" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// -- assertions -------------------------------------------------------------

let passed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
    return;
  }
  failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

/** The largest single-frame move up the page, i.e. the worst lurch. */
function biggestStepDown(samples) {
  let worst = 0;
  for (let i = 1; i < samples.length; i += 1) {
    worst = Math.max(worst, samples[i - 1] - samples[i]);
  }
  return worst;
}

/** The largest single-frame move back down the page. */
function biggestStepUp(samples) {
  let worst = 0;
  for (let i = 1; i < samples.length; i += 1) {
    worst = Math.max(worst, samples[i] - samples[i - 1]);
  }
  return worst;
}

// -- the run ----------------------------------------------------------------

async function main() {
  const playwright = loadPlaywright();
  if (!playwright) {
    console.log("playwright is not installed — skipping (npm i -g playwright)");
    return 0;
  }

  const dir = build();
  const { server, port } = await serve(dir);
  const url = `http://127.0.0.1:${port}/`;
  const browser = await playwright.chromium.launch();

  const open = async (ua = IPHONE_UA, options = {}) => {
    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      ...options,
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => window.__tap.frames(2));
    return { context, page };
  };

  try {
    // -- arming ------------------------------------------------------------
    {
      const { context, page } = await open();
      const top = await page.evaluate(async () => {
        const s = window.__tap.state();
        return s;
      });
      check("at the top: not armed, <html> reads locked", !top.armed && top.htmlOverflowY === "hidden", top);

      const scrolled = await page.evaluate(async () => {
        window.__tap.el.scrollTop = 2000;
        await window.__tap.frames(3);
        return window.__tap.state();
      });
      check(
        "scrolled away: armed, window parked",
        scrolled.armed && scrolled.windowY >= 1.5 && scrolled.container === 2000,
        scrolled
      );

      const back = await page.evaluate(async () => {
        window.__tap.el.scrollTop = 0;
        await window.__tap.frames(3);
        return window.__tap.state();
      });
      check(
        "back at the top: disarmed, window returned, <html> locked again",
        !back.armed && back.windowY === 0 && back.htmlOverflowY === "hidden",
        back
      );
      await context.close();
    }

    // -- the gesture -------------------------------------------------------
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        const armed = t.state().armed;
        // What Safari does to the page, and nothing else.
        window.scrollTo(0, 0);
        const samples = await t.sample(1000);
        return { armed, samples, state: t.state() };
      });
      check("tap while at rest: armed first", result.armed);
      check(
        "tap while at rest: lands at the top",
        result.state.container === 0,
        result.samples.slice(-3)
      );
      check(
        "tap while at rest: eases, never jumps",
        result.samples.length > 6 && biggestStepUp(result.samples) <= 2,
        result.samples
      );
      check(
        "tap while at rest: <html> handed back",
        !result.state.armed && result.state.htmlOverflowY === "hidden",
        result.state
      );
      await context.close();
    }

    // -- the gesture, mid-fling (the swallow) ------------------------------
    // The container is moving every frame, so its scroll event and the
    // window's land in the same frame. Acting inside the scroll handlers
    // re-parks the window before the window's handler runs, and the tap is
    // lost — which is the bug this is here for.
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 4000;
        await t.frames(3);

        // A fling: the container keeps moving on its own for 10 frames, and
        // the tap arrives in the middle of it.
        let caught = false;
        await new Promise((resolve) => {
          let i = 0;
          const tick = () => {
            i += 1;
            if (i <= 10) {
              t.el.scrollTop = 4000 - i * 120;
              if (i === 5) window.scrollTo(0, 0);
              requestAnimationFrame(tick);
              return;
            }
            resolve();
          };
          requestAnimationFrame(tick);
        });
        const samples = await t.sample(1200);
        caught = samples[samples.length - 1] === 0;
        return { caught, samples, state: t.state() };
      });
      check("tap mid-fling: the gesture is not swallowed", result.caught, result.samples.slice(-4));
      check(
        "tap mid-fling: no lurch back down the page",
        biggestStepUp(result.samples) <= 2,
        result.samples
      );
      await context.close();
    }

    // -- a fling that outlives the kill ------------------------------------
    // Momentum the compositor is still applying shows up as the container
    // moving under the animation. It must carry on from where the container
    // actually is, not yank it back onto a curve that stopped being true.
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        window.scrollTo(0, 0);
        await t.frames(8);
        // The "fling": one shove further down the page, mid-return.
        const before = Math.round(t.el.scrollTop);
        t.el.scrollTop = before + 400;
        await t.frames(1);
        const next = Math.round(t.el.scrollTop);
        const samples = await t.sample(1500);
        return { before, next, samples, state: t.state() };
      });
      check(
        "fling under the return: still lands at the top",
        result.state.container === 0,
        result.samples.slice(-3)
      );
      // Re-based, the next frame carries on from the shove and is still below
      // where the page was before it. Driven from the original `from`, the
      // next frame is back on the old curve — the shove erased, in one jump.
      check(
        "fling under the return: carries on from it, rather than erasing it",
        result.next > result.before,
        { before: result.before, next: result.next, worst: biggestStepDown(result.samples) }
      );
      await context.close();
    }

    // -- a finger cancels --------------------------------------------------
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        window.scrollTo(0, 0);
        await t.frames(6);
        t.touch("touchstart");
        await t.frames(2);
        const stopped = Math.round(t.el.scrollTop);
        await t.frames(6);
        const settled = Math.round(t.el.scrollTop);
        t.touch("touchend");
        await t.frames(6);
        return { stopped, settled, state: t.state() };
      });
      check(
        "a finger stops the return where it is",
        result.stopped > 0 && result.settled === result.stopped,
        result
      );
      check("and the page re-arms after it", result.state.armed, result.state);
      await context.close();
    }

    // -- a touch-driven scroll is not the gesture --------------------------
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        t.touch("touchstart");
        window.scrollTo(0, 0);
        await t.frames(8);
        return { container: Math.round(t.el.scrollTop) };
      });
      check("a window scroll under a finger is not read as a tap", result.container === 3000, result);
      await context.close();
    }

    // -- a rotation is not the gesture -------------------------------------
    // A rotation, or a keyboard being dismissed, can take the window back to 0
    // by itself. Reading that as a tap sends the page to the top out of
    // nowhere, which is worse than missing a real one.
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        window.dispatchEvent(new Event("resize"));
        window.scrollTo(0, 0);
        await t.frames(10);
        return { container: Math.round(t.el.scrollTop) };
      });
      check("a window scroll right after a resize is not read as a tap", result.container === 3000, result);
      await context.close();
    }

    // -- a scroll lock takes over ------------------------------------------
    // Base UI locks by writing an inline overflow onto <html> when it does not
    // already read as locked. Being armed is what makes it not read as locked,
    // so this has to stand down and come back.
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 2000;
        await t.frames(3);
        const armed = t.state().armed;
        document.documentElement.style.overflowY = "hidden";
        await t.frames(3);
        const underLock = t.state();
        document.documentElement.style.overflowY = "";
        await t.frames(4);
        return { armed, underLock, after: t.state() };
      });
      check("armed before the lock", result.armed);
      check("stands down under a foreign lock", !result.underLock.armed, result.underLock);
      check("re-arms when the lock clears", result.after.armed, result.after);
      await context.close();
    }

    // -- reduced motion ----------------------------------------------------
    {
      const { context, page } = await open(IPHONE_UA, { reducedMotion: "reduce" });
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 3000;
        await t.frames(3);
        window.scrollTo(0, 0);
        await t.frames(4);
        return { container: Math.round(t.el.scrollTop) };
      });
      check("reduced motion jumps rather than eases", result.container === 0, result);
      await context.close();
    }

    // -- off iOS -----------------------------------------------------------
    {
      const { context, page } = await open(DESKTOP_UA, { hasTouch: false, isMobile: false });
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 2000;
        await t.frames(4);
        return t.state();
      });
      check(
        "off iOS: nothing is armed and <html> is left alone",
        !result.armed && result.windowY === 0 && result.htmlOverflowY === "hidden",
        result
      );
      await context.close();
    }

    // -- cleanup -----------------------------------------------------------
    {
      const { context, page } = await open();
      const result = await page.evaluate(async () => {
        const t = window.__tap;
        t.el.scrollTop = 2000;
        await t.frames(3);
        const armed = t.state().armed;
        t.stop();
        await t.frames(3);
        return { armed, after: t.state() };
      });
      check(
        "cleanup gives the window and <html> back",
        result.armed && !result.after.armed && result.after.windowY === 0,
        result
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  return failures.length === 0 ? 0 : 1;
}

process.exitCode = await main();
