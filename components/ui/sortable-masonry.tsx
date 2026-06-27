"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
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
//   - CSS `columns` keeps all items in a single DOM container, so Framer
//     Motion `layout` can FLIP-animate every card to its new slot — even
//     across columns — when the order changes. It also renders correctly on
//     the server (no JS measurement needed), which matters for static export.
//   - dnd-kit owns the interaction (per-input sensors, collision detection,
//     keyboard a11y). While a card is held, dnd-kit drives *its* transform so
//     it tracks the pointer; every other card is positioned by Framer Motion
//     `layout`. On release dnd-kit clears the transform and Framer FLIPs the
//     card into its slot — so the two systems never disagree about where a
//     card is (which is what breaks `DragOverlay`-based drop animations here).
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
}

const LAYOUT_SPRING = { type: "spring" as const, stiffness: 500, damping: 34 };

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
    <motion.div
      ref={setNodeRef}
      data-widget-id={id}
      // While held, dnd-kit owns the transform (cursor tracking) so Framer must
      // stand down; on release Framer's layout takes over and FLIPs it home.
      layout={!isDragging}
      transition={LAYOUT_SPRING}
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
        transform: isDragging ? CSS.Translate.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? "relative" : undefined,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* Inner wrapper owns the jiggle rotate + lift scale so they never fight
          the layout/drag transform on the outer element. */}
      <div
        className={cn(
          editing && !isDragging && "widget-jiggle",
          isDragging && "drop-shadow-2xl"
        )}
        style={{
          ...(editing && !isDragging
            ? { animationDelay: `${(index % 6) * 0.07}s` }
            : {}),
          ...(isDragging
            ? { transform: "scale(1.03)", transition: "transform 140ms ease" }
            : {}),
        }}
      >
        {children}
      </div>
    </motion.div>
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
      if (target?.closest("[data-widget-id]")) return;
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

  function handleDragStart() {
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
    setOrder((prev) => {
      saveOrder(storageKey, prev);
      return prev;
    });
  }

  const orderedIds = order.filter((id) => itemsById.has(id));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
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

      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {t(locale, "widgetEditHint")}
            </span>
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
