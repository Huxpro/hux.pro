"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  getClientRect,
  useDraggable,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { HANDOFF, setHomeEditing } from "./home-edit-store";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  chunkIntoColumns,
  clearOrder,
  flattenColumns,
  guardActivators,
  layoutsEqual,
  loadLayouts,
  reconcile,
  reconcileLayout,
  saveLayouts,
  type ColumnLayout,
} from "./sortable-order";
import { usePressHold } from "./use-press-hold";
import { landsOnOwnAction } from "./widget-surface";

// =============================================================================
// SortableMasonry
//
// An iPad-springboard-style widget grid. Renders widgets into a responsive
// 1 / 2 / 3 / 4 column grid and lets the visitor rearrange them, mirroring how
// iPadOS / macOS treat each pointer type:
//   - Mouse / trackpad: a press-and-move *is* a drag straight away (no wait).
//   - Touch: a plain swipe scrolls; you must long-press to pick a widget up,
//     so dragging never fights the page scroll. The held card grows slowly for
//     the length of the hold (iOS's "about to lift" tell) and pops up once
//     the drag activates.
// A press only counts as a pickup when it lands on the widget's *own*
// surface — the part whose tap is the whole-widget action (title, padding,
// static text). Rows, links, buttons and inputs carry their own tap, so a
// press-and-hold on them is theirs (scroll the list, open the link preview,
// press the button) and never lifts the card. In edit mode, like an iOS
// jiggle, the whole card is a handle again.
// Dragging lifts the card and enters a jiggle "edit mode"; a click/tap on any
// empty (non-widget) area, or the "Done" pill, leaves it. The layout is
// persisted to localStorage, so each visitor keeps their own arrangement.
//
// Why this shape:
//   - Placement is *explicit*: the layout is one list of widget IDs per column
//     (`string[][]`), not one flat sequence, so a column is exactly as tall as
//     what the visitor put in it. The middle column can be the tallest, a
//     column can be left empty, and nothing reflows into a neighbour on its
//     own. (CSS `columns`, which this used to use, auto-balances column
//     heights: a widget's column was *derived* from the running height, never
//     chosen, so "make the middle column taller" was not expressible.)
//   - **Every widget keeps its DOM node, in one stable parent, forever.** The
//     grid is a single relative container; each card is absolutely positioned
//     and moves by `transform` alone. React never reorders or reparents the
//     children, so a widget is never unmounted and remounted by a drag. This
//     is load-bearing, not an optimisation: widgets own live, stateful DOM
//     (the talks widget hosts the theater's persistent YouTube player node,
//     the app folder portals its own drag overlay), and tearing that down
//     mid-drag threw `removeChild` / update-depth errors that took the page
//     down with them.
//   - Placement during a drag is computed from our own geometry (pointer
//     position vs. the measured cards), not from dnd-kit droppables. Because
//     the geometry already includes the held card's slot, inserting is
//     naturally hysteretic: a card only changes places once the pointer
//     crosses a neighbour's midpoint, so nothing oscillates.
//   - Layouts are kept per column count, so an arrangement made on a wide
//     screen survives a visit at phone width.
//   - Before the cards have been measured (and with JS off) the grid renders
//     as a plain CSS multi-column in declaration order — same container, same
//     children, only the styling differs, so switching costs no remount.
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
}

/** Gutter between cards, in px — matches the fallback's `gap-x-4` / `mb-4`. */
const GAP = 16;

/**
 * Live column count, mirroring the Tailwind breakpoints the pre-measurement
 * fallback renders with (`sm:columns-2 lg:columns-3 roomy:columns-4`).
 * `null` until mounted — the server render has no viewport to ask.
 *
 * `roomyColumns` is what the widest step resolves to for the current widget
 * count: 4 once there are enough widgets to fill a fourth column, 3 otherwise
 * (see `gridScale`).
 */
function useColumnCount(roomyColumns: number): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const steps: { query: string; count: number }[] = [
      { query: ROOMY_QUERY, count: roomyColumns },
      { query: "(min-width: 1024px)", count: 3 },
      { query: "(min-width: 640px)", count: 2 },
    ];
    const lists = steps.map((step) => window.matchMedia(step.query));
    const sync = () => {
      const hit = steps.findIndex((_, i) => lists[i].matches);
      setCount(hit === -1 ? 1 : steps[hit].count);
    };
    sync();
    for (const list of lists) list.addEventListener("change", sync);
    return () => {
      for (const list of lists) list.removeEventListener("change", sync);
    };
  }, [roomyColumns]);

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
// Responsive scale
//
// Column count and container width move together so the widgets themselves
// never stretch or shrink with the screen — only how many fit per row changes.
//
//   <sm    1 column   @ 680px     phone
//   sm     2 columns  @ 680px     tablet / small laptop   (~332px per column)
//   lg     3 columns  @ 1024px    desktop                 (~331px per column)
//   roomy  4 columns  @ 1344px    large / ultrawide       (~324px per column)
//          3 columns  @ 1152px    …with few widgets       (~373px per column)
//
// The fourth column only unlocks once there are enough widgets to fill it: with
// a handful of cards a fourth column starts out holding one widget and leaves a
// lopsided, half-empty grid. (The visitor can still *make* it lopsided — that is
// the point of explicit placement — but it shouldn't be the default they are
// handed.) Below that threshold an ultrawide screen instead gets three slightly
// roomier columns — still far narrower than the ~630px a widget already renders
// at on a phone in landscape, so nothing has to be re-tuned.
//
// The last step is gated on `roomy:` (wide *and* tall, see globals.css), not
// width alone: it exists to spend space the screen actually has spare, so a
// short ultrawide — already scrolling — keeps the familiar desktop board.
// =============================================================================

const MIN_ITEMS_FOR_FOUR_COLUMNS = 8;

/** `roomy:` from globals.css — wide *and* tall, as a media query. */
const ROOMY_QUERY = "(min-width: 96rem) and (min-height: 1000px)";

function gridScale(count: number) {
  return count >= MIN_ITEMS_FOR_FOUR_COLUMNS
    ? {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-[84rem]",
        columns: "columns-1 sm:columns-2 lg:columns-3 roomy:columns-4",
        roomyColumns: 4,
      }
    : {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-6xl",
        columns: "columns-1 sm:columns-2 lg:columns-3",
        roomyColumns: 3,
      };
}

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
  const target = from[0] === column && from[1] < index ? index - 1 : index;
  next[column].splice(Math.max(0, Math.min(target, next[column].length)), 0, id);
  return next;
}

interface Slot {
  x: number;
  y: number;
  height: number;
}

/** Where every placed card sits, in container coordinates. */
function computeSlots(
  layout: ColumnLayout,
  heights: Record<string, number>,
  columnWidth: number,
): { slots: Record<string, Slot>; height: number } {
  const slots: Record<string, Slot> = {};
  let tallest = 0;

  layout.forEach((column, index) => {
    let y = 0;
    for (const id of column) {
      const height = heights[id] ?? 0;
      slots[id] = { x: index * (columnWidth + GAP), y, height };
      // A widget that renders nothing (the music widget without a playlist,
      // a group whose commits are all filtered out) takes no space at all —
      // not even a gutter.
      if (height > 0) y += height + GAP;
    }
    tallest = Math.max(tallest, y);
  });

  return { slots, height: Math.max(0, tallest - GAP) };
}

// =============================================================================
// Item
//
// One widget. Its DOM node never moves in the tree: in "flow" mode it is a
// normal block in the multi-column fallback, and in "grid" mode it is absolute
// and driven entirely by `transform`.
// =============================================================================

function MasonryItem({
  id,
  index,
  editing,
  slot,
  columnWidth,
  animate,
  measure,
  children,
}: {
  id: string;
  index: number;
  editing: boolean;
  /** Null until the grid has been measured — the item stays in normal flow. */
  slot: Slot | null;
  columnWidth: number;
  animate: boolean;
  measure: (id: string, el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id });
  const hold = usePressHold(TOUCH_ACTIVATION);

  // Gate every press activator on where the press landed: a control's press
  // is the control's. Edit mode lifts the gate.
  const keepForControl = (e: React.SyntheticEvent) =>
    !editing && landsOnOwnAction(e);
  const guardedListeners = useMemo(
    () => guardActivators(listeners, keepForControl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keepForControl only closes over `editing`
    [listeners, editing],
  );

  const ref = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      measure(id, el);
    },
    [id, measure, setNodeRef],
  );

  const positioned: CSSProperties = slot
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: columnWidth,
        transform: `translate3d(${slot.x}px, ${slot.y}px, 0)`,
        transition: animate ? "transform 240ms cubic-bezier(0.2, 0, 0, 1)" : undefined,
      }
    : {};

  return (
    <div
      ref={ref}
      data-widget-id={id}
      {...attributes}
      {...guardedListeners}
      onPointerDown={(e) => {
        if (keepForControl(e)) return;
        hold.onPointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
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
      // text selection. `mb-4` only matters in the flow fallback; once the card
      // is positioned, the gutter is part of its slot.
      className={cn(
        "select-none",
        !slot && "mb-4 break-inside-avoid",
      )}
      style={{
        ...positioned,
        // The dragged card is represented by the DragOverlay clone; leave its
        // slot empty so the gap shows where it would land.
        opacity: isDragging ? 0 : 1,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* Three transforms, three wrappers, so none fights another: the outer
          element carries the card's slot position, this one the slow
          press-and-hold grow, the innermost the jiggle rotate. */}
      <div {...hold.holdProps}>
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

  const scale = gridScale(ids.length);
  const columnCount = useColumnCount(scale.roomyColumns);
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
  const [containerWidth, setContainerWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  // Latched: once the cards have been measured we stay in positioned mode, so a
  // widget appearing later can never snap the whole grid back to the fallback.
  const [positioned, setPositioned] = useState(false);
  const [animate, setAnimate] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedRef = useRef(new Map<string, HTMLElement>());
  // Last pointer position, in client coordinates — the drag's "where am I".
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  // Whether the drag in progress was started by a pointer. A keyboard drag
  // must follow the lifted card, never a pointer position left over from an
  // earlier mouse move.
  const pointerDragRef = useRef(false);
  // Current geometry, for callbacks dnd-kit holds across renders (the keyboard
  // coordinate getter).
  const geometryRef = useRef<{
    columnWidth: number;
    slots: Record<string, Slot>;
    layout: ColumnLayout;
  }>({ columnWidth: 0, slots: {}, layout: [] });
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

  // ---------------------------------------------------------------------------
  // Measurement: one observer for the container and every card. Heights drive
  // the slots, so a widget that grows (an image loading, weather arriving)
  // simply pushes the cards under it down.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      let next: Record<string, number> | null = null;
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (el === containerRef.current) {
          setContainerWidth(el.clientWidth);
          continue;
        }
        const id = el.dataset.widgetId;
        if (!id) continue;
        // `borderBoxSize` is the *layout* height. A bounding rect would fold in
        // the card's transform, so a card measured mid-jiggle (or mid-move)
        // would report a few px too tall and shift the column under it.
        // Round to whole pixels: sub-pixel jitter would loop us forever.
        const height = Math.round(
          entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight,
        );
        next ??= {};
        next[id] = height;
      }
      if (next) {
        const measured = next;
        setHeights((prev) => {
          const changed = Object.keys(measured).some(
            (id) => prev[id] !== measured[id],
          );
          return changed ? { ...prev, ...measured } : prev;
        });
      }
    });

    observerRef.current = observer;
    if (containerRef.current) observer.observe(containerRef.current);
    for (const el of observedRef.current.values()) observer.observe(el);

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (el) {
      setContainerWidth(el.clientWidth);
      observerRef.current?.observe(el);
    }
  }, []);

  const measure = useCallback((id: string, el: HTMLElement | null) => {
    const previous = observedRef.current.get(id);
    if (previous && previous !== el) observerRef.current?.unobserve(previous);
    if (el) {
      observedRef.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      observedRef.current.delete(id);
    }
  }, []);

  const columnWidth =
    containerWidth > 0
      ? (containerWidth - GAP * (columns - 1)) / columns
      : 0;

  const { slots, height } = useMemo(
    () => computeSlots(layout, heights, columnWidth),
    [layout, heights, columnWidth],
  );

  useEffect(() => {
    geometryRef.current = { columnWidth, slots, layout };
  }, [columnWidth, slots, layout]);

  // Switch to positioned mode once every card has a height, then let the next
  // frame turn transitions on (so cards don't animate in from the origin).
  // 0 is a valid height (a widget that renders nothing), so "measured" means
  // *recorded*, not non-zero — otherwise one empty widget would keep the whole
  // grid in the fallback and silently disable column placement.
  const allMeasured =
    columnWidth > 0 &&
    ids.length > 0 &&
    ids.every((id) => heights[id] !== undefined);

  useEffect(() => {
    if (!allMeasured || positioned) return;
    setPositioned(true);
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [allMeasured, positioned]);

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

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

  const persist = useCallback(
    (next: ColumnLayout) => {
      storedRef.current = { ...storedRef.current, [columns]: next };
      saveLayouts(storageKey, storedRef.current);
    },
    [columns, storageKey],
  );

  // ---------------------------------------------------------------------------
  // Edit mode
  // ---------------------------------------------------------------------------

  // Tell the command bar to step aside while editing (see home-edit-store).
  useEffect(() => {
    setHomeEditing(editing);
    return () => setHomeEditing(false);
  }, [editing]);

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

  // ---------------------------------------------------------------------------
  // Dragging
  //
  // dnd-kit provides the sensors, the activation constraints and the lifted
  // clone; *where the card lands* is ours to decide, from the pointer against
  // the slots we already computed. No droppables, so nothing about the drag
  // depends on dnd-kit re-measuring a grid that is moving underneath it.
  // ---------------------------------------------------------------------------

  // Arrow keys should move a held widget by a *slot*, the way dragging does.
  // dnd-kit's default getter steps 25px, which would take a dozen presses to
  // cross one column.
  const keyboardCoordinates = useCallback<KeyboardCoordinateGetter>(
    (event, { active, currentCoordinates }) => {
      const geometry = geometryRef.current;
      const id = String(active);
      const at = locate(geometry.layout, id);
      const column = at ? (geometry.layout[at[0]] ?? []) : [];
      // Step over the neighbour in that direction; fall back to the held card's
      // own height at the ends of a column.
      const rowStep = (offset: number) => {
        const neighbour = at ? column[at[1] + offset] : undefined;
        const slot = (neighbour ? geometry.slots[neighbour] : undefined) ??
          geometry.slots[id];
        return (slot?.height ?? 0) + GAP;
      };
      const columnStep = geometry.columnWidth + GAP;

      switch (event.code) {
        case "ArrowRight":
          event.preventDefault();
          return { ...currentCoordinates, x: currentCoordinates.x + columnStep };
        case "ArrowLeft":
          event.preventDefault();
          return { ...currentCoordinates, x: currentCoordinates.x - columnStep };
        case "ArrowDown":
          event.preventDefault();
          return { ...currentCoordinates, y: currentCoordinates.y + rowStep(1) };
        case "ArrowUp":
          event.preventDefault();
          return { ...currentCoordinates, y: currentCoordinates.y - rowStep(-1) };
        default:
          return undefined;
      }
    },
    [],
  );

  const sensors = useSensors(
    // Mouse / trackpad drags immediately; touch requires a long-press so plain
    // swipes still scroll the page.
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  // Track the pointer for the whole session: `onDragMove` then always has a
  // fresh, un-translated position to work from (dnd-kit's delta folds in scroll
  // offsets, which would double-count against a container rect read live).
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) pointerRef.current = { x: touch.clientX, y: touch.clientY };
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  /**
   * Where the held card should sit, given a point in client coordinates:
   * the nearest column, and the position within it that the point has passed.
   * Because `slots` already accounts for the held card's own slot, a card only
   * changes places once the point crosses a neighbour's midpoint — the layout
   * settles instead of flip-flopping.
   */
  function placementAt(
    clientX: number,
    clientY: number,
    draggedId: string,
  ): [number, number] | null {
    const el = containerRef.current;
    if (!el || columnWidth <= 0) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let column = 0;
    let best = Infinity;
    for (let i = 0; i < columns; i++) {
      const center = i * (columnWidth + GAP) + columnWidth / 2;
      const distance = Math.abs(x - center);
      if (distance < best) {
        best = distance;
        column = i;
      }
    }

    let index = 0;
    for (const id of layout[column] ?? []) {
      if (id === draggedId) continue;
      const slot = slots[id];
      if (slot && slot.y + slot.height / 2 < y) index++;
    }

    return [column, index];
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setEditing(true);
    const activator = e.activatorEvent;
    pointerDragRef.current = false;
    if (activator instanceof MouseEvent) {
      pointerDragRef.current = true;
      pointerRef.current = { x: activator.clientX, y: activator.clientY };
    } else if (
      typeof TouchEvent !== "undefined" &&
      activator instanceof TouchEvent &&
      activator.touches[0]
    ) {
      pointerDragRef.current = true;
      pointerRef.current = {
        x: activator.touches[0].clientX,
        y: activator.touches[0].clientY,
      };
    }
  }

  function handleDragMove(e: DragMoveEvent) {
    const draggedId = String(e.active.id);
    const pointer = pointerDragRef.current ? pointerRef.current : null;
    // Keyboard drags have no pointer: follow the lifted card's own rect.
    const held = e.active.rect.current.translated;
    const point = pointer
      ? pointer
      : held
        ? { x: held.left + held.width / 2, y: held.top + held.height / 2 }
        : null;
    if (!point) return;

    const target = placementAt(point.x, point.y, draggedId);
    if (!target) return;

    const next = place(layout, draggedId, target[0], target[1]);
    if (!layoutsEqual(next, layout)) setLayout(next);
  }

  function handleDragEnd() {
    setActiveId(null);
    persist(layout);
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

  // Only offer "Reset" once some layout actually diverges from its default.
  // Inner drag surfaces (sections) report their own divergence.
  const isCustomized =
    (mounted && !layoutsEqual(layout, defaultLayout)) ||
    [...sections.values()].some((s) => s.isCustomized);

  const grid = (
    <DndContext
      // Stable id so dnd-kit's generated accessibility ids (DndDescribedBy-*)
      // are deterministic across SSR and client — otherwise its internal
      // counter mismatches and React reports an unpatchable hydration error.
      id="hux-widget-grid"
      sensors={sensors}
      // Cards are positioned *entirely* by `transform`, so dnd-kit's default
      // transform-agnostic measurement would place every one of them at the
      // container's top-left — and the lifted clone would appear a whole slot
      // away from the cursor. Measure where the card actually is on screen.
      measuring={{ draggable: { measure: getClientRect } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* One container, one child per widget, always in declaration order:
          React never moves these nodes, so no widget is ever torn down and
          rebuilt by a drag. Only the styling switches between the
          pre-measurement multi-column fallback and the positioned grid.

          The caller's `className` stays on an *outer* wrapper: a positioned
          card is laid out against its ancestor's padding box, so padding on
          the element the cards live in would apply in flow mode and not in
          positioned mode — a visible jump on every load as the grid settles.
          The inner element carries no padding of its own, so both modes put a
          card in exactly the same place. */}
      <div className={cn("mx-auto w-full", scale.width, className)}>
        <div
          ref={setContainer}
          className={cn(
            positioned ? "relative" : cn(scale.columns, "gap-x-4"),
          )}
          style={positioned ? { height } : undefined}
        >
          {ids.map((id, i) => (
            <MasonryItem
              key={id}
              id={id}
              index={i}
              editing={editing}
              slot={positioned ? (slots[id] ?? null) : null}
              columnWidth={columnWidth}
              animate={animate}
              measure={measure}
            >
              {itemsById.get(id)}
            </MasonryItem>
          ))}
        </div>
      </div>

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
              // Pops from the held size (the press-and-hold grow ends at
              // 1.03) to its floating size, so pickup reads as one motion.
              // `pointer-events-none`: the clone is under the finger when a
              // hold is released without moving, and the click a touch
              // release synthesises would otherwise land on a link inside
              // the clone (which lives in a portal, outside the item's
              // click-swallowing wrapper) and navigate.
              className="widget-lift select-none drop-shadow-2xl pointer-events-none"
              style={{ cursor: "grabbing" }}
            >
              {itemsById.get(activeId)}
            </div>
          </MasonryEditContext.Provider>
        ) : null}
      </DragOverlay>

      {/* Edit-mode controls: a "Done" pill, with a quieter "Reset" to its
          left once the layout has been customised. On desktop they float
          above the command bar (fixed at bottom-6). On phones the command bar
          fades out for the duration of edit mode (see systems/command/fab.tsx)
          and the controls take its place at the bottom, where the thumb is. */}
      <AnimatePresence>
        {editing && (
          <motion.div
            data-edit-controls
            className="system-chrome fixed inset-x-0 bottom-6 md:bottom-24 z-50 flex items-center justify-center gap-4 px-6"
            // Sequenced with the command bar's fade (see HANDOFF): the
            // controls rise in once the bar has gone, and sink out before
            // it comes back. On desktop the bar stays put, so the delay is
            // simply a beat after the drag started.
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: HANDOFF.in, delay: HANDOFF.delay },
            }}
            exit={{ opacity: 0, y: 12, transition: { duration: HANDOFF.out } }}
          >
            {isCustomized && (
              <button
                type="button"
                onClick={handleReset}
                className="pressable text-xs font-mono uppercase tracking-wider text-tertiary-foreground transition-colors hover:text-muted-foreground active:text-foreground"
              >
                {t(locale, "widgetEditReset")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="pressable rounded-full border border-border/60 bg-glass-strong-hover px-5 py-2.5 md:px-4 md:py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground shadow-raised backdrop-blur-xl transition-colors hover:text-foreground active:bg-card active:text-foreground"
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
