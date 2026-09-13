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
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  chunkIntoColumns,
  clearOrder,
  flattenColumns,
  layoutsEqual,
  loadLayouts,
  reconcile,
  reconcileLayout,
  saveLayouts,
  type ColumnLayout,
} from "./sortable-order";

// =============================================================================
// SortableMasonry
//
// An iPad-springboard-style widget grid. Renders widgets into a responsive
// 1 / 2 / 3 column grid and lets the visitor rearrange them, mirroring how
// iPadOS / macOS treat each pointer type:
//   - Mouse / trackpad: a press-and-move *is* a drag straight away (no wait).
//   - Touch: a plain swipe scrolls; you must long-press to pick a widget up,
//     so dragging never fights the page scroll.
// Dragging lifts the card and enters a jiggle "edit mode"; a click/tap on any
// empty (non-widget) area leaves it. The layout is persisted to localStorage,
// so each visitor keeps their own arrangement.
//
// Why this shape:
//   - Placement is *explicit*: the layout is one list of widget IDs per column
//     (`string[][]`), not one flat sequence. Columns are plain flex children,
//     so each one is exactly as tall as what the visitor put in it — a middle
//     column can be the tallest, a column can be left half empty, and nothing
//     reflows into a neighbouring column on its own. (CSS `columns`, which
//     this used to use, auto-balances column heights: a widget's column was
//     *derived* from the running height, never chosen, so "make the middle
//     column taller" was simply not expressible.)
//   - Layouts are kept per column count, so an arrangement made on a wide
//     screen survives a visit at phone width.
//   - Before hydration (and with JS off) the grid still renders as a plain CSS
//     multi-column in declaration order, which needs no measurement and keeps
//     the page useful for static export / crawlers.
//   - This is dnd-kit's canonical multi-container sortable setup: the lifted
//     card is a `DragOverlay` clone in a portal that simply tracks the cursor
//     (so it can never "jump"), while the cards in the grid carry dnd-kit's own
//     sort transforms to slide out of the way and to settle on drop. We
//     deliberately do NOT layer Framer Motion `layout` on top — its FLIP
//     projection mutates the DOM and throws `removeChild` reconciliation
//     errors when combined with live reordering.
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
}

/** Droppable id prefix for a whole column (used for its empty tail area). */
const COLUMN_PREFIX = "column:";

/**
 * Column count per breakpoint, widest first — mirrors the Tailwind breakpoints
 * the pre-hydration fallback uses (`sm:columns-2 lg:columns-3`).
 */
const COLUMN_BREAKPOINTS: { query: string; count: number }[] = [
  { query: "(min-width: 1024px)", count: 3 },
  { query: "(min-width: 640px)", count: 2 },
];

/** Live column count; `null` until mounted (server render has no viewport). */
function useColumnCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const lists = COLUMN_BREAKPOINTS.map((bp) => window.matchMedia(bp.query));
    const sync = () => {
      const hit = COLUMN_BREAKPOINTS.findIndex((_, i) => lists[i].matches);
      setCount(hit === -1 ? 1 : COLUMN_BREAKPOINTS[hit].count);
    };
    sync();
    for (const list of lists) list.addEventListener("change", sync);
    return () => {
      for (const list of lists) list.removeEventListener("change", sync);
    };
  }, []);

  return count;
}

// =============================================================================
// Edit-mode context
//
// Widgets with their *own* inner drag surface (the app shelf's icon grid) need
// to cooperate with the masonry's single edit mode: an inner drag should enter
// the same jiggle state (which also makes the item wrapper swallow the click
// that fires after a drop — otherwise dropping an icon would navigate its
// link), and the shared "Reset" control should restore inner layouts too.
// =============================================================================

export interface MasonrySection {
  /** Restore this section's default order (called by the masonry's Reset). */
  reset: () => void;
  /** True when the section's layout diverges from its default. */
  isCustomized: boolean;
}

interface MasonryEditContextValue {
  /** True while the grid is in jiggle edit mode. */
  editing: boolean;
  /** Enter edit mode (inner drag surfaces call this on their drag start). */
  enterEdit: () => void;
  /** Register an inner drag surface; returns an unregister cleanup. */
  registerSection: (id: string, section: MasonrySection) => () => void;
}

const MasonryEditContext = createContext<MasonryEditContextValue | null>(null);

/** Null outside a SortableMasonry — callers degrade to standalone behavior. */
export function useMasonryEdit(): MasonryEditContextValue | null {
  return useContext(MasonryEditContext);
}

/**
 * What the DragOverlay clone sees: it is being "held", so editing-styled
 * affordances render, but registration is a no-op — the clone is a visual
 * copy and must never own (or, on unmount, tear down) a section slot.
 */
const CLONE_EDIT_CONTEXT: MasonryEditContextValue = {
  editing: true,
  enterEdit: () => {},
  registerSection: () => () => {},
};

// =============================================================================
// Layout helpers
// =============================================================================

/** Column + row index of an ID, or null when it isn't placed. */
function locate(layout: ColumnLayout, id: string): [number, number] | null {
  for (let col = 0; col < layout.length; col++) {
    const row = layout[col].indexOf(id);
    if (row !== -1) return [col, row];
  }
  return null;
}

/** Move `id` to `column` at `index`, returning a new layout. */
function place(
  layout: ColumnLayout,
  id: string,
  column: number,
  index: number,
): ColumnLayout {
  const from = locate(layout, id);
  if (!from || !layout[column]) return layout;

  const next = layout.map((col) => [...col]);
  next[from[0]].splice(from[1], 1);
  // Removing from the same column above the target shifts the target up by one.
  const target =
    from[0] === column && from[1] < index ? index - 1 : index;
  next[column].splice(Math.max(0, Math.min(target, next[column].length)), 0, id);
  return next;
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
      // A long-press (or right-click) on a widget should be a drag handle, not
      // an OS context menu / Android link popup.
      onContextMenu={(e) => e.preventDefault()}
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
// Column
//
// A droppable, independently-tall stack. Its droppable area stretches to the
// full grid height (flex `stretch`), so the empty space under a short column
// is a valid drop target: that is what lets a visitor deliberately grow one
// column past its neighbours.
// =============================================================================

function MasonryColumn({
  index,
  ids,
  children,
}: {
  index: number;
  ids: string[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN_PREFIX}${index}` });

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="min-w-0 flex-1">
        {children}
      </div>
    </SortableContext>
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

  const columnCount = useColumnCount();
  const mounted = columnCount !== null;
  const columns = columnCount ?? 1;

  const [layout, setLayout] = useState<ColumnLayout>(() =>
    chunkIntoColumns(ids, 1),
  );
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sections, setSections] = useState<Map<string, MasonrySection>>(
    () => new Map(),
  );
  // Every column count the visitor has arranged, so switching widths (or
  // rotating a phone) and coming back restores what they set up there.
  const storedRef = useRef<Record<number, ColumnLayout>>({});

  const enterEdit = useCallback(() => setEditing(true), []);
  const registerSection = useCallback(
    (id: string, section: MasonrySection) => {
      setSections((prev) => new Map(prev).set(id, section));
      return () => {
        setSections((prev) => {
          // Only the registration that owns the slot may clear it — a stale
          // cleanup (e.g. from a re-render race) must not clobber a newer one.
          if (prev.get(id) !== section) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      };
    },
    [],
  );
  const editContext = useMemo(
    () => ({ editing, enterEdit, registerSection }),
    [editing, enterEdit, registerSection],
  );

  const defaultLayout = useMemo(
    () => chunkIntoColumns(ids, columns),
    [idsKey, columns], // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey
  );

  // Restore the persisted layout on mount, and re-derive it whenever the column
  // count or the widget set changes.
  useEffect(() => {
    if (!mounted) return;
    const stored = loadLayouts(storageKey);
    storedRef.current = stored.byCount;

    const exact = stored.byCount[columns];
    // No arrangement for this width yet: carry over the nearest one the
    // visitor *did* make (widest first) rather than snapping to the default.
    const nearest = exact
      ? undefined
      : Object.keys(stored.byCount)
          .map(Number)
          .sort((a, b) => b - a)
          .map((n) => stored.byCount[n])[0];

    const base = exact
      ? exact
      : nearest
        ? chunkIntoColumns(flattenColumns(nearest), columns)
        : stored.flat
          ? // Legacy v1 payload: one flat sequence, chunked column-major.
            chunkIntoColumns(reconcile(stored.flat, ids), columns)
          : defaultLayout;

    setLayout(reconcileLayout(base, ids, columns));
  }, [storageKey, idsKey, columns, mounted, defaultLayout]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey

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

  // Resolve what the pointer is over, widget first. Falling back to the nearest
  // widget *within the hovered column* (rather than to the column itself) keeps
  // the gaps between cards from yanking the held widget to the column's end;
  // the column only wins when it has nothing else to offer, i.e. it is empty —
  // which is precisely how a widget gets dropped into an empty column.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);

      const widget = hits.find(
        (hit) => !String(hit.id).startsWith(COLUMN_PREFIX),
      );
      if (widget) return [widget];

      const column = hits.find((hit) =>
        String(hit.id).startsWith(COLUMN_PREFIX),
      );
      if (column) {
        const index = Number(String(column.id).slice(COLUMN_PREFIX.length));
        const siblings = new Set(layout[index] ?? []);
        siblings.delete(String(args.active.id));
        if (siblings.size > 0) {
          const nearest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter((c) =>
              siblings.has(String(c.id)),
            ),
          });
          if (nearest.length > 0) return nearest;
        }
        return [column];
      }

      return closestCenter(args);
    },
    [layout],
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setEditing(true);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);

    setLayout((prev) => {
      const from = locate(prev, draggedId);
      if (!from) return prev;

      let column: number;
      let index: number;

      if (overId.startsWith(COLUMN_PREFIX)) {
        column = Number(overId.slice(COLUMN_PREFIX.length));
        if (!Number.isInteger(column) || !prev[column]) return prev;
        index = prev[column].length;
      } else {
        if (overId === draggedId) return prev;
        const target = locate(prev, overId);
        if (!target) return prev;
        column = target[0];
        // Insert above or below the hovered widget depending on which half of
        // it the held card has reached — the usual "cross the midpoint" rule,
        // so a hover near an edge doesn't flip the order back and forth.
        const held = active.rect.current.translated;
        const below = held
          ? held.top + held.height / 2 > over.rect.top + over.rect.height / 2
          : false;
        index = target[1] + (below ? 1 : 0);
      }

      const next = place(prev, draggedId, column, index);
      return layoutsEqual(next, prev) ? prev : next;
    });
  }

  const persist = useCallback(
    (next: ColumnLayout) => {
      storedRef.current = { ...storedRef.current, [columns]: next };
      saveLayouts(storageKey, storedRef.current);
    },
    [columns, storageKey],
  );

  function handleDragEnd() {
    setActiveId(null);
    setLayout((prev) => {
      persist(prev);
      return prev;
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleReset() {
    clearOrder(storageKey);
    storedRef.current = {};
    setLayout(defaultLayout); // back to the placement widgets are declared in
    for (const section of sections.values()) section.reset();
  }

  // Only render widgets that still exist, and never render one twice.
  const placed = useMemo(() => {
    const seen = new Set<string>();
    return layout.map((col) =>
      col.filter((id) => {
        if (!itemsById.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    );
  }, [layout, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- itemsById tracked via idsKey

  // Only offer "Reset" once some layout actually diverges from its default.
  // Inner drag surfaces (sections) report their own divergence.
  const isCustomized =
    (mounted && !layoutsEqual(placed, defaultLayout)) ||
    [...sections.values()].some((s) => s.isCustomized);

  // Running index across columns, purely to stagger the jiggle animation.
  let jiggleIndex = 0;

  const grid = (
    <DndContext
      // Stable id so dnd-kit's generated accessibility ids (DndDescribedBy-*)
      // are deterministic across SSR and client — otherwise its internal
      // counter mismatches and React reports an unpatchable hydration error.
      id="hux-widget-grid"
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {mounted ? (
        <div className={cn("flex gap-x-4", className)}>
          {placed.map((columnIds, col) => (
            <MasonryColumn key={col} index={col} ids={columnIds}>
              {columnIds.map((id) => (
                <SortableMasonryItem
                  key={id}
                  id={id}
                  index={jiggleIndex++}
                  editing={editing}
                >
                  {itemsById.get(id)}
                </SortableMasonryItem>
              ))}
            </MasonryColumn>
          ))}
        </div>
      ) : (
        // Pre-hydration / no-JS: a plain CSS multi-column in declaration order.
        // Needs no viewport measurement, so it is correct at every width.
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            className={cn(
              "columns-1 sm:columns-2 lg:columns-3 gap-x-4",
              className,
            )}
          >
            {ids.map((id, i) => (
              <SortableMasonryItem key={id} id={id} index={i} editing={editing}>
                {itemsById.get(id)}
              </SortableMasonryItem>
            ))}
          </div>
        </SortableContext>
      )}

      {/* The lifted card: a portal clone that tracks the cursor. The clone is
          purely visual, so it gets the inert CLONE_EDIT_CONTEXT — it must not
          register sections (otherwise a dragged app shelf would register a
          second "app-shelf" and, on drop, its unmount would tear down the
          real shelf's registration), but it should *look* held, so
          editing-styled affordances like the shelf platter stay visible
          while lifted. */}
      <DragOverlay>
        {activeId ? (
          <MasonryEditContext.Provider value={CLONE_EDIT_CONTEXT}>
            <div
              className="select-none drop-shadow-2xl"
              style={{ transform: "scale(1.03)", cursor: "grabbing" }}
            >
              {itemsById.get(activeId)}
            </div>
          </MasonryEditContext.Provider>
        ) : null}
      </DragOverlay>

      {/* Edit-mode controls: a primary "Done" pill, with a quieter "Reset"
          to its left once the layout has been customised. */}
      <AnimatePresence>
        {editing && (
          <motion.div
            data-edit-controls
            // bottom-24 keeps these controls clear of the command bar (fixed at
            // bottom-6); revisit if that bar moves.
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
              className="rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground shadow-raised backdrop-blur-xl transition-colors hover:text-foreground"
            >
              {t(locale, "widgetEditDone")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );

  return (
    <MasonryEditContext.Provider value={editContext}>
      {grid}
    </MasonryEditContext.Provider>
  );
}
