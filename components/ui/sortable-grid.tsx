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
  type CollisionDetection,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { HANDOFF, setHomeEditing } from "./home-edit-store";
import { ResizeGrip, type ResizeAxes } from "./resize-grip";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  clearOrder,
  guardActivators,
  loadOrder,
  reconcile,
  saveOrder,
} from "./sortable-order";
import { useColumnCount } from "./use-column-count";
import { usePressHold } from "./use-press-hold";
import {
  CELL_ROW_PX,
  DEFAULT_SIZE_SPEC,
  cellGeometry,
  clampSize,
  clearSizes,
  footprintPx,
  landingIndex,
  loadSizes,
  packGrid,
  reconcileSizes,
  sameSize,
  saveSizes,
  snapPxToCells,
  type GridLayout,
  type Size,
  type StoredSizes,
  type WidgetSizeSpec,
} from "./widget-grid";
import { WidgetSizeProvider } from "./widget-size";
import { landsOnOwnAction } from "./widget-surface";

// =============================================================================
// SortableGrid
//
// An Android-launcher-shaped widget grid. Widgets sit on a lattice of cells
// (one column wide, `CELL_ROW_PX` tall), each occupying a footprint the
// visitor can change, and the grid packs them from the saved order. The
// visitor can rearrange them and resize them, mirroring how a launcher — and
// iPadOS / macOS — treat each pointer type:
//   - Mouse / trackpad: a press-and-move *is* a drag straight away (no wait);
//     a press held *still* enters edit mode (iPad-with-trackpad behaviour),
//     which is how a mouse reaches the resize corner without first dragging.
//   - Touch: a plain swipe scrolls; you must long-press to pick a widget up,
//     so dragging never fights the page scroll. The held card grows slowly for
//     the length of the hold (iOS's "about to lift" tell) and pops up once
//     the drag activates.
// A press only counts as a pickup when it lands on the widget's *own*
// surface — the part whose tap is the whole-widget action (title, padding,
// static text). Rows, links, buttons and inputs carry their own tap, so a
// press-and-hold on them is theirs (scroll the list, open the link preview,
// press the button) and never lifts the card. In edit mode, like an iOS
// jiggle, the whole card is a handle again — and each resizable widget grows
// a corner (`ResizeGrip`): drag it and the card stretches under the pointer
// while its footprint snaps to whole cells, the widget re-rendering at each
// snap so what it *will become* is visible before release. Resize exists only
// in edit mode; that is the whole arbitration with pickup — the corner is
// never there to be pressed by accident, and it swallows its own press.
//
// Dragging lifts the card and enters the jiggle "edit mode"; a click/tap on
// any empty (non-widget) area, or the "Done" pill, leaves it. Persisted state
// is the order (an array of widget ids, unchanged from the masonry days) and
// the chosen footprints (`{ id: [w, h] }`), so each visitor keeps their own
// layout.
//
// Why this shape (and what it replaced):
//   - It was a CSS multi-column masonry: one SSR-renderable container, and a
//     column *width* that never changed so widgets never stretched. Multicol
//     cannot express a widget two columns wide, so it had to go; what stays
//     is the SSR-with-no-measurement property. Placement is a pure function
//     of (order, sizes, column count) — `packGrid`, the same dense first-fit
//     as `grid-auto-flow: dense`, spelled out — and the server computes it
//     for every column count at once, emitting each widget's cell per
//     breakpoint as CSS variables that the `sm:` / `lg:` / `roomy:` variants
//     switch between. No JavaScript decides where anything goes at first
//     paint.
//   - Column count still grows with the screen and column width still
//     doesn't (see `gridScale`): a widget's *cell* is the ~330px it always
//     was. What changed is that a widget may now take two of them.
//   - Reordering is dnd-kit's sensors and DragOverlay, but not its sort
//     transforms: with mixed footprints the strategy maths is meaningless.
//     Instead a custom collision function turns the pointer into a landing
//     index on the cell lattice (`landingIndex`, pure in the pointer and the
//     order without the lifted widget, so it cannot oscillate), the order
//     updates live, and Framer Motion `layout="position"` slides the other
//     cards to their new cells. `position` and not `layout`: a size change
//     (a resize, a breakpoint) snaps rather than tweens, so text is never
//     scaled mid-flight. The old masonry note about Framer's FLIP fighting
//     multicol reconciliation no longer applies — this is a plain grid.
// =============================================================================

export interface SortableWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /** The rendered widget. */
  node: ReactNode;
  /**
   * The footprints this widget has a representation for, and the one it
   * takes when first placed. Omitted: exactly one cell, never resizable.
   */
  size?: WidgetSizeSpec;
}

// =============================================================================
// Edit-mode context
//
// Widgets with their *own* inner drag surface (the app folder's icon grid)
// need to cooperate with the grid's single edit mode: an inner drag should
// enter the same jiggle state (which also makes the item wrapper swallow the
// click that fires after a drop — otherwise dropping an icon would navigate
// its link), and the shared "Reset" control should restore inner layouts too.
// =============================================================================

export interface GridSection {
  /** Restore this section's default order (called by the grid's Reset). */
  reset: () => void;
  /** True when the section's layout diverges from its default. */
  isCustomized: boolean;
}

interface GridEditContextValue {
  /** True while the grid is in jiggle edit mode. */
  editing: boolean;
  /** Enter edit mode (inner drag surfaces call this on their drag start). */
  enterEdit: () => void;
  /** Register an inner drag surface; returns an unregister cleanup. */
  registerSection: (id: string, section: GridSection) => () => void;
}

const GridEditContext = createContext<GridEditContextValue | null>(null);

/** Null outside a SortableGrid — callers degrade to standalone behavior. */
export function useGridEdit(): GridEditContextValue | null {
  return useContext(GridEditContext);
}

/**
 * What the DragOverlay clone sees: it is being "held", so editing-styled
 * affordances render, but registration is a no-op — the clone is a visual
 * copy and must never own (or, on unmount, tear down) a section slot.
 */
const CLONE_EDIT_CONTEXT: GridEditContextValue = {
  editing: true,
  enterEdit: () => {},
  registerSection: () => () => {},
};

// =============================================================================
// Responsive scale
//
// Column count and container width move together so a cell never stretches
// or shrinks with the screen — only how many fit per row changes.
//
//   <sm    1 column   @ 680px     phone
//   sm     2 columns  @ 680px     tablet / small laptop   (~332px per column)
//   lg     3 columns  @ 1024px    desktop                 (~331px per column)
//   roomy  4 columns  @ 1344px    large / ultrawide       (~324px per column)
//          3 columns  @ 1152px    …with few widgets       (~373px per column)
//
// The fourth column only unlocks once there are enough widgets to fill it;
// below that threshold an ultrawide screen instead gets three slightly
// roomier columns. The last step is gated on `roomy:` (wide *and* tall, see
// globals.css), not width alone: it exists to spend space the screen actually
// has spare, so a short ultrawide — already scrolling — keeps the familiar
// desktop board. `useColumnCount` mirrors these steps for the JS side.
// =============================================================================

const MIN_ITEMS_FOR_FOUR_COLUMNS = 8;

function gridScale(count: number) {
  return count >= MIN_ITEMS_FOR_FOUR_COLUMNS
    ? {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-[84rem]",
        columns: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 roomy:grid-cols-4",
        roomy: 4 as const,
      }
    : {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-6xl",
        columns: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        roomy: 3 as const,
      };
}

/** Column counts, in breakpoint order, that `PLACEMENT_CLASS` switches between. */
function columnSteps(roomy: 3 | 4): [number, number, number, number] {
  return [1, 2, 3, roomy];
}

// Each widget's cell at every breakpoint, as CSS variables the variants pick
// from. Static class strings so Tailwind can see them.
const PLACEMENT_CLASS = cn(
  "[grid-column:var(--gc1)] [grid-row:var(--gr1)]",
  "sm:[grid-column:var(--gc2)] sm:[grid-row:var(--gr2)]",
  "lg:[grid-column:var(--gc3)] lg:[grid-row:var(--gr3)]",
  "roomy:[grid-column:var(--gc4)] roomy:[grid-row:var(--gr4)]",
);

function placementVars(id: string, layouts: GridLayout[]): CSSProperties {
  const vars: Record<string, string> = {};
  layouts.forEach((layout, i) => {
    const p = layout.cells.get(id);
    if (!p) return;
    vars[`--gc${i + 1}`] = `${p.x + 1} / span ${p.w}`;
    vars[`--gr${i + 1}`] = `${p.y + 1} / span ${p.h}`;
  });
  return vars as CSSProperties;
}

const LAYOUT_TRANSITION = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const };

/** No sort transforms: the grid re-packs and Framer moves the cards. */
const noSortingStrategy: SortingStrategy = () => null;

// =============================================================================
// Resize state
// =============================================================================

interface ResizeState {
  id: string;
  /** The footprint the stretch has snapped to (already clamped). */
  size: Size;
  /** Where the card's box is right now, px — follows the pointer. */
  px: { w: number; h: number };
  /** `live` follows the pointer; `settle` eases onto the final footprint. */
  phase: "live" | "settle";
}

/** How far past its range the box may be pulled before it stops following. */
const RESIZE_SLACK_PX = 24;
const RESIZE_SETTLE_MS = 180;

// =============================================================================
// Sortable item
// =============================================================================

interface ItemResizeHandlers {
  onStart: (e: PointerEvent<HTMLDivElement>, id: string) => void;
  onMove: (e: PointerEvent<HTMLDivElement>) => void;
  onEnd: (e: PointerEvent<HTMLDivElement>) => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>, id: string) => void;
}

function SortableGridItem({
  id,
  index,
  editing,
  size,
  axes,
  layouts,
  resize,
  resizeHandlers,
  enterEdit,
  children,
}: {
  id: string;
  index: number;
  editing: boolean;
  /** Effective footprint (clamped to the range and the viewport). */
  size: Size;
  /** Which axes the widget can be resized on here; null = not resizable. */
  axes: ResizeAxes | null;
  layouts: GridLayout[];
  resize: ResizeState | null;
  resizeHandlers: ItemResizeHandlers;
  enterEdit: () => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({
    id,
    // Framer owns every movement in the grid; dnd-kit must not also try to
    // animate a card from its previous rect.
    animateLayoutChanges: () => false,
    transition: null,
  });
  const hold = usePressHold({ ...TOUCH_ACTIVATION, mouse: true });
  const isResizing = resize?.id === id;

  // Gate every press activator on where the press landed: a control's press
  // is the control's. Edit mode lifts the gate.
  const keepForControl = (e: React.SyntheticEvent) =>
    !editing && landsOnOwnAction(e);
  const guardedListeners = useMemo(
    () => guardActivators(listeners, keepForControl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keepForControl only closes over `editing`
    [listeners, editing],
  );

  // A mouse press held still for the touch hold's duration enters edit mode
  // without lifting anything — the pointer analogue of the long-press, and
  // the way a mouse reaches the resize corner. Movement hands over to
  // dnd-kit's distance activation as before; release before the delay is
  // the click it always was.
  const stillPressRef = useRef<(() => void) | null>(null);
  const armStillPress = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || editing) return;
    stillPressRef.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    const cancel = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cancel);
      stillPressRef.current = null;
    };
    const onMove = (ev: globalThis.PointerEvent) => {
      if (
        Math.hypot(ev.clientX - startX, ev.clientY - startY) >
        MOUSE_ACTIVATION.distance
      ) {
        cancel();
      }
    };
    const timer = window.setTimeout(() => {
      cancel();
      enterEdit();
    }, TOUCH_ACTIVATION.delay);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", cancel);
    stillPressRef.current = cancel;
  };
  useEffect(() => () => stillPressRef.current?.(), []);

  const cardStyle: CSSProperties | undefined =
    isResizing && resize
      ? {
          position: "absolute",
          top: 0,
          left: 0,
          width: resize.px.w,
          height: resize.px.h,
          transition:
            resize.phase === "settle"
              ? `width ${RESIZE_SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), height ${RESIZE_SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
              : undefined,
        }
      : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      layout="position"
      transition={LAYOUT_TRANSITION}
      data-widget-id={id}
      {...attributes}
      {...guardedListeners}
      onPointerDown={(e) => {
        if (keepForControl(e)) return;
        hold.onPointerDown(e);
        armStillPress(e);
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
      // text selection.
      className={cn("relative select-none", PLACEMENT_CLASS)}
      style={{
        ...placementVars(id, layouts),
        cursor: editing ? "grab" : undefined,
        // A stretching card hangs over its neighbours.
        zIndex: isResizing ? 30 : undefined,
      }}
    >
      {/* Three transforms, three wrappers, so none fights another: the outer
          element carries Framer's layout transform, this one the slow
          press-and-hold grow, the innermost the jiggle rotate. */}
      <div {...hold.holdProps} className={cn(hold.holdProps.className, "h-full")}>
        <div
          className={cn(
            "relative h-full",
            editing && !isDragging && !isResizing && "widget-jiggle",
          )}
          style={
            editing && !isDragging && !isResizing
              ? { animationDelay: `${(index % 6) * 0.07}s` }
              : undefined
          }
        >
          {/* The lifted card is represented by the DragOverlay clone; the
              slot it will land in stays visible as an outline so the drop is
              never a surprise. While resizing, the card's box follows the
              pointer and the outline shows the footprint it has snapped to. */}
          {(isDragging || isResizing) && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-foreground/25 bg-ink/5"
            />
          )}
          <div
            className={cn("relative h-full", isDragging && "invisible")}
            style={cardStyle}
          >
            <WidgetSizeProvider size={size}>{children}</WidgetSizeProvider>
            {editing && !isDragging && axes && (
              <ResizeGrip
                axes={axes}
                label={t(locale, "widgetResize")}
                onPointerDown={(e) => resizeHandlers.onStart(e, id)}
                onPointerMove={resizeHandlers.onMove}
                onPointerUp={resizeHandlers.onEnd}
                onKeyDown={(e) => resizeHandlers.onKey(e, id)}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// SortableGrid
// =============================================================================

export function SortableGrid({
  items,
  storageKey = "hux_widget_order",
  sizesKey = "hux_widget_sizes",
  className,
}: {
  items: SortableWidget[];
  storageKey?: string;
  sizesKey?: string;
  className?: string;
}) {
  const { locale } = useLocale();

  const ids = items.map((i) => i.id);
  const idsKey = ids.join("|");
  const itemsById = new Map(items.map((i) => [i.id, i.node]));
  const specs = useMemo(
    () =>
      new Map<string, WidgetSizeSpec>(
        items.map((i) => [i.id, i.size ?? DEFAULT_SIZE_SPEC]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- specs are static per widget id
    [idsKey],
  );

  const [order, setOrder] = useState<string[]>(ids);
  const [sizes, setSizes] = useState<StoredSizes>(() =>
    reconcileSizes(null, specs),
  );
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [sections, setSections] = useState<Map<string, GridSection>>(
    () => new Map(),
  );

  const enterEdit = useCallback(() => setEditing(true), []);
  const registerSection = useCallback(
    (id: string, section: GridSection) => {
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

  // Restore the persisted layout on mount and whenever the widget set changes.
  useEffect(() => {
    // Browser-only: reading localStorage + syncing to the current widget set.
    const stored = loadOrder(storageKey);
    setOrder(reconcile(stored ?? ids, ids));
    setSizes(reconcileSizes(loadSizes(sizesKey), specs));
  }, [storageKey, sizesKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey

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
    const onKey = (e: globalThis.KeyboardEvent) => {
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

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const orderedIds = order.filter((id) => itemsById.has(id));
  const scale = gridScale(orderedIds.length);
  const columns = useColumnCount(scale.roomy);
  const gridRef = useRef<HTMLDivElement>(null);

  /** The footprint the grid packs a widget at — a live resize wins. */
  const sizeOf = useCallback(
    (id: string): Size => {
      const spec = specs.get(id) ?? DEFAULT_SIZE_SPEC;
      if (resize?.id === id) return resize.size;
      return clampSize(sizes[id] ?? spec.default, spec);
    },
    [specs, sizes, resize],
  );
  const effectiveSize = useCallback(
    (id: string): Size =>
      clampSize(sizeOf(id), specs.get(id) ?? DEFAULT_SIZE_SPEC, columns),
    [sizeOf, specs, columns],
  );

  // One layout per breakpoint step, all from the same order and sizes.
  const layouts = useMemo(
    () => columnSteps(scale.roomy).map((c) => packGrid(orderedIds, sizeOf, c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderedIds tracked by its join
    [orderedIds.join("|"), sizeOf, scale.roomy],
  );

  // ---------------------------------------------------------------------------
  // Drag — the pointer picks the landing cell (see the header comment).
  // ---------------------------------------------------------------------------

  const dragRef = useRef({ orderedIds, sizeOf, columns, activeId });
  dragRef.current = { orderedIds, sizeOf, columns, activeId };

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const { pointerCoordinates } = args;
    const { orderedIds, sizeOf, columns, activeId } = dragRef.current;
    const el = gridRef.current;
    // Keyboard drags have no pointer; let dnd-kit's own rects answer.
    if (!pointerCoordinates || !el || !activeId) return closestCenter(args);
    const rest = orderedIds.filter((id) => id !== activeId);
    const layout = packGrid(rest, sizeOf, columns);
    const geo = cellGeometry(el.getBoundingClientRect(), columns);
    const index = landingIndex(
      rest,
      layout,
      geo,
      pointerCoordinates.x,
      pointerCoordinates.y,
    );
    const overId = rest[Math.min(index, rest.length - 1)] ?? activeId;
    return [{ id: overId, data: { index } }];
  }, []);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setEditing(true);
  }

  function handleDragMove(e: DragMoveEvent) {
    const active = String(e.active.id);
    const hint = e.collisions?.[0]?.data as { index?: number } | undefined;
    let index = hint?.index;
    if (typeof index !== "number") {
      // Keyboard: take the place of the widget we are over.
      if (!e.over || e.over.id === active) return;
      const rest = orderedIds.filter((id) => id !== active);
      index = rest.indexOf(String(e.over.id));
      if (index === -1) return;
    }
    setOrder((prev) => {
      const rest = prev.filter((id) => id !== active);
      const at = Math.max(0, Math.min(index, rest.length));
      const next = [...rest.slice(0, at), active, ...rest.slice(at)];
      return next.join("|") === prev.join("|") ? prev : next;
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

  // ---------------------------------------------------------------------------
  // Resize — the corner stretches the card; the footprint snaps to cells.
  // ---------------------------------------------------------------------------

  const resizeRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    startPx: { w: number; h: number };
    spec: WidgetSizeSpec;
    live: ResizeState;
  } | null>(null);
  const settleTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const commitSize = useCallback(
    (id: string, size: Size) => {
      setSizes((prev) => {
        if (prev[id] && sameSize(prev[id], size)) return prev;
        const next = { ...prev, [id]: size };
        saveSizes(sizesKey, next);
        return next;
      });
    },
    [sizesKey],
  );

  const resizeHandlers = useMemo<ItemResizeHandlers>(
    () => ({
      onStart: (e, id) => {
        const spec = specs.get(id) ?? DEFAULT_SIZE_SPEC;
        const wrapper = e.currentTarget.closest<HTMLElement>("[data-widget-id]");
        if (!wrapper || !gridRef.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        if (settleTimer.current) window.clearTimeout(settleTimer.current);
        const rect = wrapper.getBoundingClientRect();
        const live: ResizeState = {
          id,
          size: effectiveSize(id),
          px: { w: rect.width, h: rect.height },
          phase: "live",
        };
        resizeRef.current = {
          id,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startPx: live.px,
          spec,
          live,
        };
        setResize(live);
      },
      onMove: (e) => {
        const r = resizeRef.current;
        const el = gridRef.current;
        if (!r || !el || e.pointerId !== r.pointerId) return;
        const geo = cellGeometry(el.getBoundingClientRect(), columns);
        const minPx = footprintPx(clampSize(r.spec.min, r.spec, columns), geo);
        const maxPx = footprintPx(clampSize(r.spec.max, r.spec, columns), geo);
        const px = {
          w: Math.max(
            minPx.w - RESIZE_SLACK_PX,
            Math.min(maxPx.w + RESIZE_SLACK_PX, r.startPx.w + e.clientX - r.startX),
          ),
          h: Math.max(
            minPx.h - RESIZE_SLACK_PX,
            Math.min(maxPx.h + RESIZE_SLACK_PX, r.startPx.h + e.clientY - r.startY),
          ),
        };
        const size = clampSize(snapPxToCells(px, geo), r.spec, columns);
        r.live = { id: r.id, size, px, phase: "live" };
        setResize(r.live);
      },
      onEnd: (e) => {
        const r = resizeRef.current;
        const el = gridRef.current;
        if (!r || e.pointerId !== r.pointerId) return;
        resizeRef.current = null;
        commitSize(r.id, r.live.size);
        // Ease the box from under the pointer onto its cells, then hand the
        // card back to the grid.
        const geo = el ? cellGeometry(el.getBoundingClientRect(), columns) : null;
        setResize({
          ...r.live,
          px: geo ? footprintPx(r.live.size, geo) : r.live.px,
          phase: "settle",
        });
        settleTimer.current = window.setTimeout(
          () => setResize(null),
          RESIZE_SETTLE_MS,
        );
      },
      onKey: (e, id) => {
        const spec = specs.get(id) ?? DEFAULT_SIZE_SPEC;
        const cur = effectiveSize(id);
        const step: Record<string, [number, number]> = {
          ArrowRight: [1, 0],
          ArrowLeft: [-1, 0],
          ArrowDown: [0, 1],
          ArrowUp: [0, -1],
        };
        const d = step[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        commitSize(id, clampSize({ w: cur.w + d[0], h: cur.h + d[1] }, spec, columns));
      },
    }),
    [specs, columns, effectiveSize, commitSize],
  );

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  function handleReset() {
    clearOrder(storageKey);
    clearSizes(sizesKey);
    setOrder(ids); // back to the order widgets are declared in
    setSizes(reconcileSizes(null, specs));
    for (const section of sections.values()) section.reset();
  }

  // Only offer "Reset" once some layout actually diverges from its default.
  // `idsKey` is already the default order joined, so compare against it;
  // inner drag surfaces (sections) report their own divergence.
  const isCustomized =
    orderedIds.join("|") !== idsKey ||
    orderedIds.some((id) => {
      const spec = specs.get(id) ?? DEFAULT_SIZE_SPEC;
      return !sameSize(sizes[id] ?? spec.default, spec.default);
    }) ||
    [...sections.values()].some((s) => s.isCustomized);

  /** Which axes a widget can still be resized on, at this column count. */
  const axesFor = (id: string): ResizeAxes | null => {
    const spec = specs.get(id) ?? DEFAULT_SIZE_SPEC;
    const x = clampSize(spec.max, spec, columns).w > spec.min.w;
    const y = spec.max.h > spec.min.h;
    return x && y ? "both" : x ? "x" : y ? "y" : null;
  };

  const grid = (
    <DndContext
      // Stable id so dnd-kit's generated accessibility ids (DndDescribedBy-*)
      // are deterministic across SSR and client — otherwise its internal
      // counter mismatches and React reports an unpatchable hydration error.
      id="hux-widget-grid"
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={orderedIds} strategy={noSortingStrategy}>
        <div className={cn("mx-auto w-full", scale.width, className)}>
          <div
            ref={gridRef}
            data-widget-grid
            className={cn(
              "grid gap-4 auto-rows-[var(--cell-h)]",
              scale.columns,
            )}
            style={{ "--cell-h": `${CELL_ROW_PX}px` } as CSSProperties}
          >
            {orderedIds.map((id, i) => (
              <SortableGridItem
                key={id}
                id={id}
                index={i}
                editing={editing}
                size={effectiveSize(id)}
                axes={axesFor(id)}
                layouts={layouts}
                resize={resize}
                resizeHandlers={resizeHandlers}
                enterEdit={enterEdit}
              >
                {itemsById.get(id)}
              </SortableGridItem>
            ))}
          </div>
        </div>
      </SortableContext>

      {/* The lifted card: a portal clone that tracks the cursor. The clone is
          purely visual, so it gets the inert CLONE_EDIT_CONTEXT — it must not
          register sections (otherwise a dragged app shelf would register a
          second "app-shelf" and, on drop, its unmount would tear down the
          real shelf's registration), but it should *look* held, so
          editing-styled affordances like the shelf platter stay visible
          while lifted. */}
      <DragOverlay>
        {activeId ? (
          <GridEditContext.Provider value={CLONE_EDIT_CONTEXT}>
            <WidgetSizeProvider size={effectiveSize(activeId)}>
              <div
                // Pops from the held size (the press-and-hold grow ends at
                // 1.03) to its floating size, so pickup reads as one motion.
                // `pointer-events-none`: the clone is under the finger when a
                // hold is released without moving, and the click a touch
                // release synthesises would otherwise land on a link inside
                // the clone (which lives in a portal, outside the item's
                // click-swallowing wrapper) and navigate.
                className="widget-lift h-full select-none drop-shadow-2xl pointer-events-none"
                style={{ cursor: "grabbing" }}
              >
                {itemsById.get(activeId)}
              </div>
            </WidgetSizeProvider>
          </GridEditContext.Provider>
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
    <GridEditContext.Provider value={editContext}>
      <MotionConfig reducedMotion="user">{grid}</MotionConfig>
    </GridEditContext.Provider>
  );
}
