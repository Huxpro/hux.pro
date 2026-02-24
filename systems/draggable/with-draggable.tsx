"use client";

import { useDevtool } from "@/systems/devtool";
import { motion, useDragControls, useMotionValue } from "framer-motion";
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
// useDraggable hook
// =============================================================================

export function useDraggable(id: string) {
  const { getDraggableConfig, getDragResetCounter } = useDevtool();
  const config = getDraggableConfig(id);
  const resetCounter = getDragResetCounter(id);

  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const isDraggingRef = useRef(false);
  const prevResetCounterRef = useRef(resetCounter);
  const storageKey = `hux_drag_${id}`;

  // Restore persisted position
  useEffect(() => {
    if (!config.draggable || !config.persist) return;
    const saved = loadPosition(storageKey);
    if (saved) {
      x.set(saved.x);
      y.set(saved.y);
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

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
    document.documentElement.classList.add("dragging");
  }, []);

  const onDragEnd = useCallback(() => {
    document.documentElement.classList.remove("dragging");
    if (config.persist) {
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
