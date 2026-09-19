// =============================================================================
// Scroll probe — what happened to the last few touches, on the phone itself.
//
// Off unless asked for. `?scroll-probe=1` turns it on for this browser (it is
// remembered in localStorage, so it survives navigations and reloads);
// `?scroll-probe=0` turns it off. The loader in app/layout.tsx writes this
// file in synchronously, before any of the app's own scripts, because half of
// what it reports is who registered a touch listener — and a listener
// registered before the probe exists is one it never hears about.
//
// Why it exists: a scroll that will not start on iOS has two very different
// causes and they look identical from the outside.
//
//   JS    something called preventDefault() on a touchmove. The probe patches
//         Event.prototype.preventDefault and names the caller.
//   UI    nothing in the page said no, and the page still did not move. The
//         gesture went to a different scroller — the window, an iframe, a
//         horizontal strip — or to none. That is WebKit / UIKit, not us.
//
// One line per gesture, newest first:
//
//   !!UI #12 fy-240 c0→0 w2 mv18 pd0 canc:true p.text-sm A
//    │   │   │      │      │  │    │   │         │       └ status-tap armed
//    │   │   │      │      │  │    │   │         └ where the finger landed
//    │   │   │      │      │  │    │   └ was the first touchmove cancelable
//    │   │   │      │      │  │    │     (true = the page is a blocking
//    │   │   │      │      │  │    │     touch region; scroll waits on JS)
//    │   │   │      │      │  │    └ preventDefault() calls on its moves
//    │   │   │      │      │  └ touchmoves delivered
//    │   │   │      │      └ window scrollY moved by (the root scroller)
//    │   │   │      └ #bezel-scroll moved by: at lift → 600ms later
//    │   │   └ finger travel, px (negative = finger went up)
//    │   └ gesture number
//    └ flagged: the finger travelled > 80px and the page did not follow
//
// Below the gestures: every non-passive touch listener currently attached
// (with where it was registered from), the preventDefault callers so far,
// and the page's scroll state right now.
// =============================================================================

(function () {
  if (window.__scrollProbe) return;
  var P = (window.__scrollProbe = {
    gestures: [],
    blocks: {},
    listeners: new Map(),
    dead: 0,
    flips: 0,
    n: 0,
    cur: null,
  });

  var root = document.documentElement;
  var ARMED = "data-bezel-status-tap";

  function describe(t) {
    if (!t) return "?";
    if (t === window) return "window";
    if (t === document) return "document";
    var s = (t.nodeName || "?").toLowerCase();
    if (t.id) s += "#" + t.id;
    var c = t.getAttribute && t.getAttribute("class");
    if (c) s += "." + c.trim().split(/\s+/).slice(0, 2).join(".");
    return s.slice(0, 40);
  }

  function caller(depth) {
    return (new Error().stack || "")
      .split("\n")
      .slice(2, 2 + depth)
      .map(function (l) {
        return l
          .replace(/https?:\/\/[^/]+\//, "")
          .replace(/_next\/static\/chunks\//, "")
          .replace(/\?[^:]*/, "")
          .slice(0, 60);
      })
      .join(" < ");
  }

  // --- Who says no --------------------------------------------------------
  var preventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (this.type === "touchmove" || this.type === "touchstart") {
      var key = this.type + (this.cancelable ? "" : "(ignored)") + " " + caller(2);
      P.blocks[key] = (P.blocks[key] || 0) + 1;
      if (P.cur) P.cur.pd++;
    }
    return preventDefault.apply(this, arguments);
  };

  // --- Who is listening, blocking ------------------------------------------
  // A touch listener is passive by default only on window, document and body;
  // anywhere else, leaving `passive` out makes it blocking.
  var add = EventTarget.prototype.addEventListener;
  var remove = EventTarget.prototype.removeEventListener;
  var nextId = 0;
  function capture(o) {
    return typeof o === "boolean" ? o : !!(o && o.capture);
  }
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if ((type === "touchstart" || type === "touchmove") && fn) {
      var isRoot =
        this === window || this === document || this === document.body || this === root;
      var passive = o && typeof o === "object" && "passive" in o ? o.passive : isRoot;
      if (!passive) {
        P.listeners.set(++nextId, {
          target: this,
          type: type,
          fn: fn,
          capture: capture(o),
          label: type + " @" + describe(this) + " " + caller(2),
        });
      }
    }
    return add.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, o) {
    var self = this;
    P.listeners.forEach(function (v, k) {
      if (v.target === self && v.type === type && v.fn === fn && v.capture === capture(o)) {
        P.listeners.delete(k);
      }
    });
    return remove.call(this, type, fn, o);
  };

  // --- Gestures -------------------------------------------------------------
  function container() {
    return document.getElementById("bezel-scroll");
  }
  function positions() {
    var c = container();
    return { c: c ? c.scrollTop : 0, w: window.scrollY };
  }

  var opts = { capture: true, passive: true };
  add.call(
    window,
    "touchstart",
    function (e) {
      if (e.touches.length > 1) return;
      var s = positions();
      P.cur = {
        id: ++P.n,
        y0: e.touches[0].clientY,
        y: e.touches[0].clientY,
        c0: s.c,
        w0: s.w,
        moves: 0,
        pd: 0,
        cancelable: null,
        target: describe(e.target),
        armed: root.hasAttribute(ARMED),
      };
    },
    opts
  );
  add.call(
    window,
    "touchmove",
    function (e) {
      var g = P.cur;
      if (!g) return;
      g.moves++;
      if (e.touches[0]) g.y = e.touches[0].clientY;
      if (g.cancelable === null) g.cancelable = e.cancelable;
    },
    opts
  );
  function end(e) {
    var g = P.cur;
    if (!g || e.touches.length) return;
    P.cur = null;
    var s = positions();
    g.dy = Math.round(g.y - g.y0);
    g.dc = Math.round(s.c - g.c0);
    g.dw = +(s.w - g.w0).toFixed(1);
    if (Math.abs(g.dy) > 80 && Math.abs(g.dc) < 5 && Math.abs(g.dw) < 5) {
      g.flag = g.pd ? "JS" : "UI";
      P.dead++;
    }
    setTimeout(function () {
      g.dcLater = Math.round(positions().c - g.c0);
      render();
    }, 600);
    P.gestures.unshift(g);
    P.gestures.length = Math.min(P.gestures.length, 6);
    render();
  }
  add.call(window, "touchend", end, opts);
  add.call(window, "touchcancel", end, opts);

  new MutationObserver(function () {
    var armed = root.hasAttribute(ARMED);
    if (armed !== P.armed) {
      P.armed = armed;
      P.flips++;
    }
  }).observe(root, { attributes: true, attributeFilter: [ARMED] });

  // --- Display --------------------------------------------------------------
  var box;
  function render() {
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("role", "status");
      box.style.cssText =
        "position:fixed;left:4px;bottom:4px;z-index:2147483647;pointer-events:none;" +
        "font:10px/1.25 ui-monospace,monospace;background:rgba(0,0,0,.8);color:#0f0;" +
        "padding:4px;max-width:96vw;white-space:pre-wrap;border-radius:4px";
      root.appendChild(box);
    }
    var c = container();
    var s = positions();
    var lines = [
      "dead " + P.dead + "  armFlips " + P.flips +
        "  htmlOverflow " + getComputedStyle(root).overflowY +
        (root.style.overflowY ? " (inline " + root.style.overflowY + ")" : "") +
        "  vv " + Math.round(visualViewport ? visualViewport.height : 0) + "/" + innerHeight,
    ];
    P.gestures.forEach(function (g) {
      lines.push(
        (g.flag ? "!!" + g.flag + " " : "") + "#" + g.id + " fy" + g.dy +
          " c" + g.dc + "→" + (g.dcLater === undefined ? "…" : g.dcLater) +
          " w" + g.dw + " mv" + g.moves + " pd" + g.pd + " canc:" + g.cancelable +
          " " + g.target + (g.armed ? " A" : "")
      );
    });
    var grouped = {};
    P.listeners.forEach(function (v) {
      if (!(v.target instanceof Node) || v.target.isConnected) {
        grouped[v.label] = (grouped[v.label] || 0) + 1;
      }
    });
    var labels = Object.keys(grouped);
    lines.push("blocking listeners: " + (labels.length ? "" : "none"));
    labels.forEach(function (k) {
      lines.push("  x" + grouped[k] + " " + k);
    });
    Object.keys(P.blocks)
      .slice(-4)
      .forEach(function (k) {
        lines.push("preventDefault x" + P.blocks[k] + " " + k);
      });
    lines.push(
      "now c" + Math.round(s.c) + "/" + (c ? c.scrollHeight - c.clientHeight : "-") +
        " w" + s.w + " " + location.pathname + location.search
    );
    box.textContent = lines.join("\n");
  }
  setInterval(render, 1000);
})();
