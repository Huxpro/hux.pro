"use client";

import { useDevtool } from "@/systems/devtool";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useRef, type ComponentType } from "react";

// =============================================================================
// withDraggable — Higher-Order Component
// useDraggable  — Hook for inline drag behavior
//
// Reads per-instance config (draggable, persist) from the DevtoolProvider.
// =============================================================================

interface StoredPosition {
  x: number;
  y: number;
}

function loadPosition(key: string): StoredPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function savePosition(key: string, pos: StoredPosition): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function clearPosition(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// =============================================================================
// Viewport boundary clamping
// =============================================================================

const EDGE_INSET = 8; // px inset from viewport edges

const SPRING_CONFIG = { type: "spring" as const, stiffness: 500, damping: 30 };

function clampToViewport(
  rect: DOMRect,
  currentX: number,
  currentY: number
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cx = currentX;
  let cy = currentY;
  // Keep entire element inside viewport (with inset)
  if (rect.top < EDGE_INSET) cy += EDGE_INSET - rect.top;
  if (rect.bottom > vh - EDGE_INSET) cy -= rect.bottom - (vh - EDGE_INSET);
  if (rect.left < EDGE_INSET) cx += EDGE_INSET - rect.left;
  if (rect.right > vw - EDGE_INSET) cx -= rect.right - (vw - EDGE_INSET);
  return { x: cx, y: cy };
}

function animateToClampedPosition(
  contentEl: HTMLElement,
  x: MotionValue<number>,
  y: MotionValue<number>,
  onClamped?: (pos: StoredPosition) => void
) {
  const rect = contentEl.getBoundingClientRect();
  const clamped = clampToViewport(rect, x.get(), y.get());
  if (clamped.x !== x.get() || clamped.y !== y.get()) {
    animate(x, clamped.x, SPRING_CONFIG);
    animate(y, clamped.y, SPRING_CONFIG);
    onClamped?.(clamped);
  }
}

// =============================================================================
// useDraggable hook
// =============================================================================

export function useDraggable(id: string) {
  const { getDraggableConfig, getDragResetCounter } = useDevtool();
  const config = getDraggableConfig(id);
  const resetCounter = getDragResetCounter(id);

  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const contentRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef(false);
  const prevResetCounterRef = useRef(resetCounter);
  const storageKey = `hux_drag_${id}`;

  // Restore persisted position & validate bounds
  useEffect(() => {
    if (!config.draggable || !config.persist) return;
    const saved = loadPosition(storageKey);
    if (saved) {
      x.set(saved.x);
      y.set(saved.y);
      // Validate after layout — screen size may have changed
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        animateToClampedPosition(contentRef.current, x, y, (clamped) =>
          savePosition(storageKey, clamped)
        );
      });
    }
  }, [config.draggable, config.persist, storageKey, x, y]);

  // Reset when dragging disabled
  useEffect(() => {
    if (!config.draggable) {
      x.set(0);
      y.set(0);
    }
  }, [config.draggable, x, y]);

  // Reset when persist toggled off
  useEffect(() => {
    if (!config.persist) {
      x.set(0);
      y.set(0);
      clearPosition(storageKey);
    }
  }, [config.persist, storageKey, x, y]);

  // Reset position when a component signals reopen (and persist is off)
  useEffect(() => {
    if (resetCounter !== prevResetCounterRef.current) {
      prevResetCounterRef.current = resetCounter;
      if (!config.persist) {
        x.set(0);
        y.set(0);
      }
    }
  }, [resetCounter, config.persist, x, y]);

  // Re-clamp on window resize
  useEffect(() => {
    if (!config.draggable) return;
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!contentRef.current) return;
        animateToClampedPosition(contentRef.current, x, y, (clamped) => {
          if (config.persist) savePosition(storageKey, clamped);
        });
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [config.draggable, config.persist, storageKey, x, y]);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
    document.documentElement.classList.add("dragging");
  }, []);

  const onDragEnd = useCallback(() => {
    document.documentElement.classList.remove("dragging");
    // Clamp to viewport bounds, then persist
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const clamped = clampToViewport(rect, x.get(), y.get());
      if (clamped.x !== x.get() || clamped.y !== y.get()) {
        animate(x, clamped.x, SPRING_CONFIG);
        animate(y, clamped.y, SPRING_CONFIG);
      }
      if (config.persist) {
        savePosition(storageKey, clamped);
      }
    } else if (config.persist) {
      savePosition(storageKey, { x: x.get(), y: y.get() });
    }
    // Defer so click handlers fired in the same tick still see isDragging=true
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, [config.persist, storageKey, x, y]);

  const startDrag = useCallback(
    (e: React.PointerEvent, filter?: string) => {
      if (filter) {
        const target = e.target as HTMLElement;
        if (target.closest(filter)) return;
      }
      dragControls.start(e);
    },
    [dragControls]
  );

  const preventClickAfterDrag = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const resetPosition = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return {
    isEnabled: config.draggable,
    contentRef,
    dragControls,
    motionStyle: { x, y },
    onDragStart,
    onDragEnd,
    startDrag,
    preventClickAfterDrag,
    resetPosition,
  };
}

// =============================================================================
// withDraggable HOC
//
// Wraps a fixed-position component. The wrapper is itself `position: fixed;
// inset: 0` so the child's `position: fixed` coordinates resolve identically
// to viewport coordinates, while the wrapper's z-index ensures correct
// stacking during drag.
// =============================================================================

export function withDraggable<P extends object>(
  WrappedComponent: ComponentType<P>,
  config: { id: string; dragFilter?: string }
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  function DraggableWrapper(props: P) {
    const drag = useDraggable(config.id);

    if (!drag.isEnabled) {
      return <WrappedComponent {...props} />;
    }

    return (
      <motion.div
        style={{
          ...drag.motionStyle,
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          pointerEvents: "none",
        }}
        drag
        dragControls={drag.dragControls}
        dragListener={false}
        dragMomentum={false}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
      >
        <div
          ref={drag.contentRef as React.RefObject<HTMLDivElement>}
          style={{ pointerEvents: "auto", touchAction: "none" }}
          onPointerDown={(e) => drag.startDrag(e, config.dragFilter)}
          onClickCapture={drag.preventClickAfterDrag}
        >
          <WrappedComponent {...props} />
        </div>
      </motion.div>
    );
  }

  DraggableWrapper.displayName = `withDraggable(${displayName})`;
  return DraggableWrapper;
}
