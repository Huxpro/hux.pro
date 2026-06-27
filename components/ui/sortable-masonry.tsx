"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

// =============================================================================
// SortableMasonry
//
// An iPad-springboard-style widget grid. Renders children into a responsive
// CSS multi-column masonry (1 / 2 / 3 columns) and lets the visitor rearrange
// them, mirroring how iPadOS / macOS treat each pointer type:
//   - Mouse / trackpad: a press-and-move *is* a drag straight away (no wait).
//   - Touch: a plain swipe scrolls; you must long-press to pick a widget up,
//     so dragging never fights the page scroll.
// Dragging lifts the card and enters a jiggle "edit mode"; a click/tap on any
// empty (non-widget) area leaves it. The order is an array of widget IDs
// persisted to localStorage, so each visitor keeps their own layout.
//
// Why this shape:
//   - CSS `columns` keeps every card in a single, SSR-renderable container
//     (no JS measurement), which matters for static export.
//   - This is dnd-kit's canonical sortable setup: the lifted card is a
//     `DragOverlay` clone in a portal that simply tracks the cursor (so it can
//     never "jump"), while the cards in the grid carry dnd-kit's own sort
//     transforms to slide out of the way and to settle on drop. We deliberately
//     do NOT layer Framer Motion `layout` on top — its FLIP projection mutates
//     the DOM and, combined with live reordering inside CSS multicol, throws
//     `removeChild` reconciliation errors.
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
}

// Mouse / trackpad: start dragging once the pointer travels 8px while pressed.
// A plain click (no travel) still navigates links.
const MOUSE_ACTIVATION = { distance: 8 };

// Touch: a plain swipe scrolls the page; only a 200ms long-press picks a widget
// up. `tolerance` lets the finger drift a little during the hold without
// cancelling (and a larger drift before the hold completes reverts to scroll).
const TOUCH_ACTIVATION = { delay: 200, tolerance: 8 };

// =============================================================================
// Persistence
// =============================================================================

function loadOrder(key: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    }
  } catch {
    // ignore
  }
  return null;
}

function saveOrder(key: string, order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore
  }
}

function clearOrder(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Merge a stored order with the current set of widget IDs: keep the stored
 * order for IDs that still exist, drop ones that vanished, and append any new
 * widgets at the end. Keeps a saved layout stable as widgets come and go.
 */
function reconcile(stored: string[], all: string[]): string[] {
  const allSet = new Set(all);
  const kept = stored.filter((id) => allSet.has(id));
  const keptSet = new Set(kept);
  const added = all.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}

// =============================================================================
// Sortable item
// =============================================================================

function SortableMasonryItem({
  id,
  index,
  editing,
  children,
}: {
  id: string;
  index: number;
  editing: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, attributes, listeners, isDragging, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      data-widget-id={id}
      {...attributes}
      {...listeners}
      // In edit mode a tap shouldn't navigate (iPad jiggle behaviour); swallow
      // clicks that bubble up from links inside the widget.
      onClickCapture={(e) => {
        if (editing) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      // Widgets are tactile objects, not prose — never let a drag turn into a
      // text selection.
      className="mb-4 break-inside-avoid select-none"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The dragged card is represented by the DragOverlay clone; leave a
        // blank placeholder in the flow so siblings know where the gap is.
        opacity: isDragging ? 0 : 1,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* Inner wrapper owns the jiggle rotate so it never fights the sort
          transform on the outer element. */}
      <div
        className={cn(editing && !isDragging && "widget-jiggle")}
        style={
          editing && !isDragging
            ? { animationDelay: `${(index % 6) * 0.07}s` }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// SortableMasonry
// =============================================================================

export function SortableMasonry({
  items,
  storageKey = "hux_widget_order",
  className,
}: {
  items: SortableWidget[];
  storageKey?: string;
  className?: string;
}) {
  const { locale } = useLocale();

  const ids = items.map((i) => i.id);
  const idsKey = ids.join("|");
  const itemsById = new Map(items.map((i) => [i.id, i.node]));

  const [order, setOrder] = useState<string[]>(ids);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Restore the persisted order on mount and whenever the widget set changes.
  useEffect(() => {
    const stored = loadOrder(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage + syncing to the current widget set
    setOrder(reconcile(stored ?? ids, ids));
  }, [storageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey

  // Leave edit mode on Escape, or on a completed click/tap anywhere outside a
  // widget (clicking another widget keeps you in edit mode so you can keep
  // rearranging). A real drag doesn't emit a click, so this never fires mid-drag.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Clicking a widget (keep rearranging) or the edit controls themselves
      // (Reset stays in edit mode; Done has its own handler) shouldn't exit.
      if (target?.closest("[data-widget-id], [data-edit-controls]")) return;
      setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [editing]);

  const sensors = useSensors(
    // Mouse / trackpad drags immediately; touch requires a long-press so plain
    // swipes still scroll the page.
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setEditing(true);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function handleDragEnd() {
    setActiveId(null);
    setOrder((prev) => {
      saveOrder(storageKey, prev);
      return prev;
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleReset() {
    clearOrder(storageKey);
    setOrder(ids); // back to the order widgets are declared in
  }

  const orderedIds = order.filter((id) => itemsById.has(id));
  // Only offer "Reset" once the layout actually diverges from the default.
  const isCustomized = orderedIds.join("|") !== ids.filter((id) => itemsById.has(id)).join("|");

  return (
    <DndContext
      // Stable id so dnd-kit's generated accessibility ids (DndDescribedBy-*)
      // are deterministic across SSR and client — otherwise its internal
      // counter mismatches and React reports an unpatchable hydration error.
      id="hux-widget-grid"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div
          className={cn("columns-1 sm:columns-2 lg:columns-3 gap-x-4", className)}
        >
          {orderedIds.map((id, i) => (
            <SortableMasonryItem key={id} id={id} index={i} editing={editing}>
              {itemsById.get(id)}
            </SortableMasonryItem>
          ))}
        </div>
      </SortableContext>

      {/* The lifted card: a portal clone that tracks the cursor. */}
      <DragOverlay>
        {activeId ? (
          <div
            className="select-none drop-shadow-2xl"
            style={{ transform: "scale(1.03)", cursor: "grabbing" }}
          >
            {itemsById.get(activeId)}
          </div>
        ) : null}
      </DragOverlay>

      {/* Edit-mode controls: a primary "Done" pill, with a quieter "Reset"
          to its left once the layout has been customised. */}
      <AnimatePresence>
        {editing && (
          <motion.div
            data-edit-controls
            className="fixed inset-x-0 bottom-24 z-50 flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            {isCustomized && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                {t(locale, "widgetEditReset")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground shadow-lg backdrop-blur-xl transition-colors hover:text-foreground"
            >
              {t(locale, "widgetEditDone")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}
