"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

// =============================================================================
// SortableMasonry
//
// An iPad-springboard-style widget grid. Renders children into a responsive
// CSS multi-column masonry (1 / 2 / 3 columns) and lets the visitor rearrange
// them by *long-pressing* a widget — which lifts it and enters a jiggle "edit
// mode" where everything is immediately draggable. The order is an array of
// widget IDs persisted to localStorage, so each visitor keeps their own layout.
//
// Why this shape:
//   - CSS `columns` keeps all items in a single DOM container, so Framer
//     Motion `layout` can FLIP-animate every card to its new slot — even
//     across columns — when the order changes. It also renders correctly on
//     the server (no JS measurement needed), which matters for static export.
//   - dnd-kit owns the interaction (long-press sensor, collision detection,
//     keyboard a11y, the lifted DragOverlay clone). We don't apply its
//     per-item transforms; Framer Motion handles the reflow visuals instead.
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
}

const LAYOUT_SPRING = { type: "spring" as const, stiffness: 500, damping: 34 };

// Long-press threshold. Below this, a press is a normal tap/click (links work);
// holding past it lifts the widget into edit mode. `tolerance` lets a touch
// drift slightly (and scroll) before the hold is cancelled.
const ACTIVATION = { delay: 200, tolerance: 8 };

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
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id });

  return (
    <motion.div
      ref={setNodeRef}
      layout
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
      className="mb-4 break-inside-avoid"
      style={{
        opacity: isDragging ? 0 : 1,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* Inner wrapper owns the jiggle rotate so it never fights the layout
          transform Framer applies to the outer element. */}
      <div
        className={cn(editing && !isDragging && "widget-jiggle")}
        style={
          editing ? { animationDelay: `${(index % 6) * 0.07}s` } : undefined
        }
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
  const [activeId, setActiveId] = useState<string | null>(null);

  // Restore the persisted order on mount and whenever the widget set changes.
  useEffect(() => {
    const stored = loadOrder(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage + syncing to the current widget set
    setOrder(reconcile(stored ?? ids, ids));
  }, [storageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey

  // Escape leaves edit mode.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION }),
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

  const orderedIds = order.filter((id) => itemsById.has(id));

  return (
    <DndContext
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
          // Tapping empty space between cards leaves edit mode.
          onPointerDown={(e) => {
            if (editing && e.target === e.currentTarget) setEditing(false);
          }}
        >
          {orderedIds.map((id, i) => (
            <SortableMasonryItem key={id} id={id} index={i} editing={editing}>
              {itemsById.get(id)}
            </SortableMasonryItem>
          ))}
        </div>
      </SortableContext>

      <DragOverlay
        dropAnimation={{
          duration: 240,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
      >
        {activeId ? (
          <div
            className="drop-shadow-2xl"
            style={{ transform: "scale(1.04) rotate(1.5deg)", cursor: "grabbing" }}
          >
            {itemsById.get(activeId)}
          </div>
        ) : null}
      </DragOverlay>

      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2"
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
