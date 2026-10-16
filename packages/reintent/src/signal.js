/**
 * A small reactive graph: signals hold values, computeds derive from them, effects act on them.
 * Dependencies are found by reading (no declared deps), so code reads like plain functions.
 *
 *   signal(v)        a value; read with s(), write with s.set(v)
 *   computed(fn)     a value derived from what fn reads; cached, recomputed only when something it
 *                    read changed — and when it comes out equal, nothing downstream re-runs
 *   effect(fn)       runs fn now and again whenever something it read changed; → dispose()
 *   batch(fn)        several writes, one propagation
 *   untracked(fn)    read without depending
 *
 * Push dirty, pull versions: a write marks everything downstream dirty and queues effects; a
 * dirty node, when read, checks whether any dependency's version moved (bringing dependencies up
 * to date first) and only then re-runs. A computed whose new value equals the old keeps its
 * version, which is what lets a change stop where it stops mattering.
 */

let listener = null;
let depth = 0;
const queue = new Set();

class Node {
  constructor(kind, fn, equals) {
    this.kind = kind; // 'signal' | 'computed' | 'effect'
    this.fn = fn;
    this.equals = equals;
    this.deps = new Map(); // node → its version when read
    this.subs = new Set();
    this.dirty = kind !== 'signal';
    this.ran = false;
    this.version = 0;
    this.value = undefined;
    this.disposed = false;
  }
}

function track(n) {
  if (!listener || listener.disposed) return;
  listener.deps.set(n, n.version);
  n.subs.add(listener);
}
function markDirty(n) {
  for (const s of n.subs) {
    if (s.dirty) continue;
    s.dirty = true;
    if (s.kind === 'effect') queue.add(s);
    else markDirty(s);
  }
}
function run(n) {
  for (const d of n.deps.keys()) d.subs.delete(n);
  n.deps = new Map();
  const prev = listener;
  listener = n;
  try {
    const v = n.fn(n.value);
    if (n.kind === 'computed') {
      if (!n.ran || !n.equals(n.value, v)) {
        n.value = v;
        n.version++;
      }
    } else n.value = v;
  } finally {
    n.ran = true;
    listener = prev;
  }
}
// Bring a node up to date: re-run it only if a dependency's version moved since it last ran.
function refresh(n) {
  if (!n.dirty || n.disposed) return;
  let changed = !n.ran;
  if (!changed)
    for (const [d, v] of n.deps) {
      refresh(d);
      if (d.version !== v) {
        changed = true;
        break;
      }
    }
  n.dirty = false;
  if (changed) run(n);
}
function flush() {
  while (queue.size) {
    const [e] = queue;
    queue.delete(e);
    refresh(e);
  }
}

export function signal(value, { equals = Object.is } = {}) {
  const n = new Node('signal', null, equals);
  n.value = value;
  const read = () => {
    track(n);
    return n.value;
  };
  read.set = (v) => {
    if (n.equals(n.value, v)) return;
    n.value = v;
    n.version++;
    markDirty(n);
    if (!depth) flush();
  };
  read.update = (f) => read.set(f(n.value));
  read.peek = () => n.value;
  return read;
}

export function computed(fn, { equals = Object.is } = {}) {
  const n = new Node('computed', fn, equals);
  const read = () => {
    refresh(n);
    track(n);
    return n.value;
  };
  read.peek = () => (refresh(n), n.value);
  return read;
}

export function effect(fn) {
  const n = new Node('effect', fn, null);
  refresh(n);
  return () => {
    n.disposed = true;
    for (const d of n.deps.keys()) d.subs.delete(n);
    n.deps.clear();
    queue.delete(n);
  };
}

export function batch(fn) {
  depth++;
  try {
    return fn();
  } finally {
    if (!--depth) flush();
  }
}

export function untracked(fn) {
  const prev = listener;
  listener = null;
  try {
    return fn();
  } finally {
    listener = prev;
  }
}

/** Structural equality for small plain values (kinds, Defer objects, decision records). */
export const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
