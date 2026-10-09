// React: a node lives as long as the component that declares it. Its fields
// are read through to the latest render, so a node registers once per id and
// never re-registers because a closure changed.

import { useCallback, useEffect, useRef } from "react";
import { elementVisible, measureElement, type ElementDecl } from "./dom";
import { mountInspector, type Inspector } from "./inspector";
import { sem, type Layer } from "./layer";
import type { SemNode } from "./types";

/** A node whose every field is read from `latest` at the time it is asked for. */
function live(latest: { current: SemNode | null }): SemNode {
  return new Proxy({} as SemNode, {
    get: (_, key) => (latest.current as unknown as Record<string | symbol, unknown> | null)?.[key],
  });
}

/** Declare a node for as long as this component is mounted. Null declares nothing. */
export function useSemNode(decl: SemNode | null, layer: Layer = sem): void {
  const latest = useRef(decl);
  useEffect(() => {
    latest.current = decl;
  });
  const id = decl?.id;
  useEffect(() => (id ? layer.node(live(latest)) : undefined), [id, layer]);
}

/**
 * A ref for an element that is a node: its place and visibility come from the
 * element, the rest from `decl`. `<p ref={useSemElement({ id, kind, intent })}>`.
 */
export function useSemElement<T extends Element>(decl: ElementDecl | null, layer: Layer = sem): (el: T | null) => (() => void) | undefined {
  const latest = useRef(decl);
  useEffect(() => {
    latest.current = decl;
  });
  const id = decl?.id;
  return useCallback(
    (el: T | null) => {
      if (!el || !id) return undefined;
      const node: { current: SemNode | null } = {
        get current() {
          const d = latest.current;
          return d
            ? {
                ...d,
                backend: d.backend ?? (el instanceof SVGElement ? "svg" : "dom"),
                measure: () => measureElement(el),
                visible: () => elementVisible(el) && (d.visible?.() ?? true),
              }
            : null;
        },
      };
      return layer.node(live(node));
    },
    [id, layer],
  );
}

/**
 * `?sem` puts the layer on `window.__sem` (for a script or the console);
 * `?inspect` does that and draws the inspector over the page, in inspect mode
 * (touches pick nodes; `?inspect=live` starts with the page live), and puts
 * the inspector on `window.__semInspector`.
 */
export function useSemDevtools(layer: Layer = sem): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("sem") && !params.has("inspect")) return;
    const g = globalThis as { __sem?: Layer; __semInspector?: Inspector };
    g.__sem = layer;
    const inspector = params.has("inspect")
      ? mountInspector(layer, { mode: params.get("inspect") === "live" ? "live" : "inspect" })
      : undefined;
    if (inspector) g.__semInspector = inspector;
    return () => {
      inspector?.unmount();
      if (g.__sem === layer) delete g.__sem;
      if (g.__semInspector === inspector) delete g.__semInspector;
    };
  }, [layer]);
}
