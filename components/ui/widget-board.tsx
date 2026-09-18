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
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { HANDOFF, setHomeEditing } from "./home-edit-store";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  clearOrder,
  guardActivators,
  loadOrder,
  loadSizeMap,
  reconcile,
  saveOrder,
  saveSizeMap,
} from "./sortable-order";
import { usePressHold } from "./use-press-hold";
import {
  FOOTPRINT,
  cellArea,
  fitSize,
  isWidgetSize,
  nextSize,
  offeredSizes,
  placeInFlow,
  resolveDropIndex,
  resolveResize,
  snapToCell,
  sortSizes,
  type Placed,
  type WidgetSize,
} from "./widget-size";
import { landsOnOwnAction } from "./widget-surface";

// =============================================================================
// WidgetBoard
//
// The home screen's widget grid, shaped like an iOS / iPadOS home screen: a
// board of square cells, and widgets that each occupy a declared footprint
// of them — small (1×1), medium (2×1), large (2×2), xl (4×2). Every widget
// says which sizes it supports and carries a different design for each; the
// visitor picks among them, and the board decides what fits the screen.
//
// Three facts make up a layout, and only two are the visitor's:
//   - the ORDER of widget ids (localStorage, unchanged since the masonry —
//     `status` is still `status` because renaming it would throw away
//     everyone's saved order);
//   - the SIZE each widget was set to (localStorage, stored beside it);
//   - the column count, which the screen decides: 2 cells on a phone, 4 on
//     a tablet, 6 on a desktop, 8 on a roomy display once there is enough
//     board to fill it.
//
// Placement is CSS Grid's own `row dense` auto-flow: widgets go in order,
// each into the first spot scanning from the top-left where it fits, so a
// widget that cannot finish a row starts the next one and a smaller widget
// later in the order slides up into the gap. `placeInFlow` (widget-size.ts)
// writes the same rule out in TypeScript, and that mirror is how the drag
// system knows which widget sits under a cell without measuring one.
//
// Rearranging keeps the masonry's hand-feel — mouse drags after 8px, touch
// after a 400ms long-press with the slow grow, a jiggle "edit mode", a
// DragOverlay clone under the cursor — and changes what the drop *means*:
//   - the lifted widget's footprint snaps to whole cells, and the board
//     resolves that against the other widgets laid out without it
//     (`resolveDropIndex`): over a widget, take its place; over empty
//     cells, continue the sequence there. The answer depends only on where
//     the hand is, so the preview never oscillates;
//   - the other widgets slide to their new cells live (FLIP on the wrapper's
//     transform), so what will happen is visible before letting go;
//   - in edit mode a widget with more than one size wears a grip at its
//     bottom-right corner, iOS 18's resize handle: drag it to the footprint
//     you want, or tap it to step to the next size. The widget switches its
//     design as the grip crosses, and the board reflows around it.
//
// Why a grid of cells rather than the multi-column masonry it replaces:
// masonry can only stack cards in a column, so it had no way to say
// "two smalls side by side", and a card's height was whatever its content
// happened to be. Fixed cells are what make a size a *design decision*: a
// widget designs for its box, and "more than fits" means a bigger size or
// the page — never a taller card. Everything the masonry got right about
// SSR survives: the grid is one container, the cell is pure CSS
// (`.widget-board` in globals.css, from the frame's container width), and
// nothing is measured to render.
// =============================================================================

export interface BoardWidget {
  /** Stable identifier used for ordering + persistence. */
  id: string;
  /**
   * The size families this widget supports, each with its own design. Any
   * order; sorted small → xl on the way in. One entry means the widget has
   * exactly one shape and shows no grip.
   */
  sizes: readonly WidgetSize[];
  /** The size it takes until the visitor picks another. Defaults to the first supported. */
  defaultSize?: WidgetSize;
  /** Render the widget at a size it supports. Called for the grid and the lifted clone alike. */
  render: (size: WidgetSize) => ReactNode;
}

/** Cells of board it takes before a roomy display unlocks its eighth column. */
const WIDE_BOARD_AREA = 24;

// =============================================================================
// Edit-mode context
//
// Widgets with their *own* inner drag surface (the app folder's icon grid)
// cooperate with the board's single edit mode: an inner drag enters the same
// jiggle state (which also makes the item wrapper swallow the click that
// fires after a drop — otherwise dropping an icon would navigate its link),
// and the shared "Reset" control restores inner layouts too.
// =============================================================================

export interface BoardSection {
  /** Restore this section's default order (called by the board's Reset). */
  reset: () => void;
  /** True when the section's layout diverges from its default. */
  isCustomized: boolean;
}

interface BoardEditContextValue {
  /** True while the board is in jiggle edit mode. */
  editing: boolean;
  /** Enter edit mode (inner drag surfaces call this on their drag start). */
  enterEdit: () => void;
  /** Register an inner drag surface; returns an unregister cleanup. */
  registerSection: (id: string, section: BoardSection) => () => void;
}

const BoardEditContext = createContext<BoardEditContextValue | null>(null);

/** Null outside a WidgetBoard — callers degrade to standalone behavior. */
export function useBoardEdit(): BoardEditContextValue | null {
  return useContext(BoardEditContext);
}

/**
 * What the DragOverlay clone sees: it is being "held", so editing-styled
 * affordances render, but registration is a no-op — the clone is a visual
 * copy and must never own (or, on unmount, tear down) a section slot.
 */
const CLONE_EDIT_CONTEXT: BoardEditContextValue = {
  editing: true,
  enterEdit: () => {},
  registerSection: () => () => {},
};

// =============================================================================
// Geometry — read off the grid, never assumed
//
// The cell is a CSS calculation of the frame's container width (see
// `.widget-board`), so the one place it is known in pixels is the grid's
// resolved track list. Reading that keeps CSS the single source of truth
// for column count and cell size; the drag system only ever asks "what is
// the board right now".
// =============================================================================

interface BoardMetrics {
  cols: number;
  cell: number;
  gap: number;
  /** Viewport x of the first column (the grid is centered in its frame). */
  originX: number;
  /** Viewport y of the first row. */
  originY: number;
}

function readMetrics(grid: HTMLElement): BoardMetrics | null {
  const style = getComputedStyle(grid);
  const tracks = style.gridTemplateColumns
    .split(" ")
    .map((v) => Number.parseFloat(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (tracks.length === 0) return null;
  const cell = tracks[0];
  const gap = Number.parseFloat(style.columnGap) || 0;
  const rect = grid.getBoundingClientRect();
  const content = tracks.length * cell + (tracks.length - 1) * gap;
  return {
    cols: tracks.length,
    cell,
    gap,
    originX: rect.left + (rect.width - content) / 2,
    originY: rect.top,
  };
}

/** The board's column count, measured after mount; null until then (SSR). */
function useBoardColumns(gridRef: React.RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState<number | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => {
      const next = readMetrics(grid)?.cols ?? null;
      setCols((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [gridRef]);
  return cols;
}

// =============================================================================
// FLIP — the reflow the visitor watches
//
// A reorder or a resize changes where CSS puts every widget after it, and a
// grid does not animate its own auto-placement. So: the board snapshots each
// wrapper's on-screen rect just before it commits a layout change, and after
// the commit plays each one from where it was to where it now is. Measured
// mid-animation, a snapshot is the *visual* position, so a second change
// during the first's motion continues from where the eye is, not from where
// layout says.
// =============================================================================

const FLIP_MS = 260;
const FLIP_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function useFlip(gridRef: React.RefObject<HTMLDivElement | null>, key: string) {
  const first = useRef<Map<string, DOMRect> | null>(null);

  /** Call right before a state change that will move widgets. */
  const snapshot = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const rects = new Map<string, DOMRect>();
    for (const el of grid.querySelectorAll<HTMLElement>("[data-widget-id]")) {
      rects.set(el.dataset.widgetId!, el.getBoundingClientRect());
    }
    first.current = rects;
  }, [gridRef]);

  useLayoutEffect(() => {
    const rects = first.current;
    first.current = null;
    const grid = gridRef.current;
    if (!rects || !grid) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const el of grid.querySelectorAll<HTMLElement>("[data-widget-id]")) {
      const was = rects.get(el.dataset.widgetId!);
      if (!was) continue;
      for (const a of el.getAnimations()) a.cancel();
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: FLIP_MS, easing: FLIP_EASE },
      );
    }
  }, [gridRef, key]);

  return snapshot;
}

// =============================================================================
// Board item
// =============================================================================

function BoardItem({
  id,
  index,
  size,
  offered,
  editing,
  onResize,
  children,
}: {
  id: string;
  index: number;
  size: WidgetSize;
  /** Sizes this widget can be switched to on the current board. */
  offered: readonly WidgetSize[];
  editing: boolean;
  /** Live resize from the grip: `commit` is the pointer letting go. */
  onResize: (id: string, size: WidgetSize, commit: boolean) => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id });
  const hold = usePressHold(TOUCH_ACTIVATION);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [resizing, setResizing] = useState(false);
  const footprint = FOOTPRINT[size];

  // Gate every press activator on where the press landed: a control's press
  // is the control's. Edit mode lifts the gate.
  const keepForControl = (e: React.SyntheticEvent) =>
    !editing && landsOnOwnAction(e);
  const guardedListeners = useMemo(
    () => guardActivators(listeners, keepForControl),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keepForControl only closes over `editing`
    [listeners, editing],
  );

  // ---------------------------------------------------------------------------
  // The grip. Pointer capture keeps the whole gesture on the button, so the
  // board's sensors, the page scroll and the press-and-hold grow never see
  // it. The footprint asked for is the pointer's distance from the widget's
  // top-left in cells: dragging the corner to where a large's corner would
  // be asks for large. A release that never travelled is a tap: next size.
  // ---------------------------------------------------------------------------
  const onGripDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary) return;
    e.stopPropagation();
    const grid = itemRef.current?.closest<HTMLElement>("[data-widget-board]");
    const item = itemRef.current;
    if (!grid || !item) return;
    const metrics = readMetrics(grid);
    if (!metrics) return;
    const origin = item.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const stride = metrics.cell + metrics.gap;
    let moved = false;
    let current = size;
    const button = e.currentTarget;
    button.setPointerCapture(e.pointerId);
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) {
        return;
      }
      moved = true;
      const w = (ev.clientX - origin.left + metrics.gap) / stride;
      const h = (ev.clientY - origin.top + metrics.gap) / stride;
      const next = resolveResize(w, h, current, offered);
      if (next !== current) {
        current = next;
        onResize(id, next, false);
      }
    };
    const onUp = () => {
      button.removeEventListener("pointermove", onMove);
      button.removeEventListener("pointerup", onUp);
      button.removeEventListener("pointercancel", onUp);
      setResizing(false);
      onResize(id, moved ? current : nextSize(size, offered), true);
    };
    button.addEventListener("pointermove", onMove);
    button.addEventListener("pointerup", onUp);
    button.addEventListener("pointercancel", onUp);
  };

  const swallow = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        itemRef.current = el;
      }}
      data-widget-id={id}
      data-widget-size={size}
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
      // text selection.
      className="relative min-w-0 select-none"
      style={{
        gridColumn: `span ${footprint.w}`,
        gridRow: `span ${footprint.h}`,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* The dragged card is represented by the DragOverlay clone; what stays
          in the flow is its footprint, drawn as a faint dashed outline so the
          landing spot reads on any wallpaper. */}
      {isDragging && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl border border-dashed border-border bg-ink/[0.03]"
        />
      )}
      {/* Three transforms, three wrappers, so none fights another: the outer
          element carries the FLIP slide, this one the slow press-and-hold
          grow, the innermost the jiggle rotate. */}
      <div
        {...hold.holdProps}
        className={cn(hold.holdProps.className, "h-full")}
        style={{ ...hold.holdProps.style, opacity: isDragging ? 0 : 1 }}
      >
        <div
          // `@container`: a widget's per-size design reads its own width
          // (cells are square, so width stands in for height too) through
          // `@min-[…]` variants — a medium on a roomy board has room for a
          // line more than a medium on a phone.
          className={cn(
            "@container relative h-full",
            editing && !isDragging && !resizing && "widget-jiggle",
          )}
          style={
            editing && !isDragging && !resizing
              ? { animationDelay: `${(index % 6) * 0.07}s` }
              : undefined
          }
        >
          {children}
          {editing && offered.length > 1 && (
            <button
              type="button"
              aria-label={t(locale, "widgetResize")}
              title={t(locale, "widgetResize")}
              data-widget-grip
              onPointerDown={onGripDown}
              onMouseDown={swallow}
              onTouchStart={swallow}
              onClick={swallow}
              className={cn(
                "widget-grip pressable absolute -bottom-2 -right-2 z-10",
                "flex h-7 w-7 items-center justify-center rounded-full",
                "border border-border/60 bg-glass-strong-hover text-muted-foreground shadow-raised backdrop-blur-xl",
                "transition-colors hover:text-foreground active:text-foreground",
                resizing && "text-foreground",
              )}
            >
              {/* A corner bracket: the thing you take hold of is the corner. */}
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 10h8V2" />
                <path d="M6 6l4 4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// WidgetBoard
// =============================================================================

const noStrategy = () => null;

export function WidgetBoard({
  items,
  storageKey = "hux_widget_order",
  sizeStorageKey = "hux_widget_sizes",
  className,
}: {
  items: BoardWidget[];
  storageKey?: string;
  sizeStorageKey?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const gridRef = useRef<HTMLDivElement | null>(null);

  const ids = items.map((i) => i.id);
  const idsKey = ids.join("|");
  const byId = useMemo(() => {
    const map = new Map<
      string,
      { render: BoardWidget["render"]; sizes: WidgetSize[]; defaultSize: WidgetSize }
    >();
    for (const item of items) {
      const sizes = sortSizes(item.sizes);
      const defaultSize =
        item.defaultSize && sizes.includes(item.defaultSize)
          ? item.defaultSize
          : sizes[0];
      map.set(item.id, { render: item.render, sizes, defaultSize });
    }
    return map;
  }, [items]);

  const [order, setOrder] = useState<string[]>(ids);
  /** Sizes the visitor picked, by id. Absent means the widget's default. */
  const [chosen, setChosen] = useState<Record<string, WidgetSize>>({});
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sections, setSections] = useState<Map<string, BoardSection>>(
    () => new Map(),
  );
  const cols = useBoardColumns(gridRef);

  const enterEdit = useCallback(() => setEditing(true), []);
  const registerSection = useCallback(
    (id: string, section: BoardSection) => {
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
    const storedOrder = loadOrder(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage + syncing to the current widget set
    setOrder(reconcile(storedOrder ?? ids, ids));
    const storedSizes = loadSizeMap(sizeStorageKey) ?? {};
    const next: Record<string, WidgetSize> = {};
    for (const [id, size] of Object.entries(storedSizes)) {
      const widget = byId.get(id);
      if (widget && isWidgetSize(size) && widget.sizes.includes(size)) {
        next[id] = size;
      }
    }
    setChosen(next);
  }, [storageKey, sizeStorageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey; byId follows items

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
  // Effective sizes: the chosen (or default) size, clamped to what the board
  // can hold. Before mount the column count is unknown and nothing is
  // clamped — the server renders defaults, which always fit two cells.
  // ---------------------------------------------------------------------------
  const orderedIds = order.filter((id) => byId.has(id));
  const fit = cols ?? Number.POSITIVE_INFINITY;
  const sizeOf = (id: string): WidgetSize => {
    const widget = byId.get(id)!;
    return fitSize(chosen[id] ?? widget.defaultSize, widget.sizes, fit);
  };
  const area = orderedIds.reduce((sum, id) => sum + cellArea(sizeOf(id)), 0);
  const wide = area >= WIDE_BOARD_AREA;
  const layoutKey =
    orderedIds.join("|") + "#" + orderedIds.map(sizeOf).join("|");
  const snapshot = useFlip(gridRef, layoutKey);

  // ---------------------------------------------------------------------------
  // Drag
  // ---------------------------------------------------------------------------
  const sensors = useSensors(
    // Mouse / trackpad drags immediately; touch requires a long-press so plain
    // swipes still scroll the page.
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Frozen for the drag: the others laid out without the lifted widget. */
  const dragRef = useRef<{
    rest: string[];
    restPlaced: Placed[];
    cell: { col: number; row: number } | null;
  } | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
    setEditing(true);
    const grid = gridRef.current;
    const metrics = grid ? readMetrics(grid) : null;
    const rest = orderedIds.filter((x) => x !== id);
    dragRef.current = {
      rest,
      restPlaced: placeInFlow(
        rest.map((x) => ({ id: x, size: sizeOf(x) })),
        metrics?.cols ?? cols ?? 2,
      ),
      cell: null,
    };
  }

  function handleDragMove(e: DragMoveEvent) {
    const drag = dragRef.current;
    const grid = gridRef.current;
    const rect = e.active.rect.current.translated;
    if (!drag || !grid || !rect) return;
    const metrics = readMetrics(grid);
    if (!metrics) return;
    const id = String(e.active.id);
    const stride = metrics.cell + metrics.gap;
    const cell = snapToCell(
      (rect.left - metrics.originX) / stride,
      (rect.top - metrics.originY) / stride,
      FOOTPRINT[sizeOf(id)],
      metrics.cols,
    );
    if (drag.cell && drag.cell.col === cell.col && drag.cell.row === cell.row) {
      return;
    }
    drag.cell = cell;
    const index = resolveDropIndex(drag.restPlaced, {
      ...cell,
      ...FOOTPRINT[sizeOf(id)],
    });
    const next = [...drag.rest];
    next.splice(index, 0, id);
    if (next.join("|") === orderedIds.join("|")) return;
    snapshot();
    setOrder(next);
  }

  function handleDragEnd() {
    setActiveId(null);
    dragRef.current = null;
    setOrder((prev) => {
      saveOrder(storageKey, prev);
      return prev;
    });
  }

  function handleDragCancel() {
    setActiveId(null);
    dragRef.current = null;
  }

  // ---------------------------------------------------------------------------
  // Resize — from a widget's grip
  // ---------------------------------------------------------------------------
  // The grip reads the latest picks between renders (a drag fires faster
  // than React commits), so they are mirrored into a ref on every commit.
  const chosenRef = useRef(chosen);
  useEffect(() => {
    chosenRef.current = chosen;
  }, [chosen]);
  const handleResize = useCallback(
    (id: string, size: WidgetSize, commit: boolean) => {
      const widget = byId.get(id);
      if (!widget) return;
      const prev = chosenRef.current;
      let next = prev;
      if ((prev[id] ?? widget.defaultSize) !== size) {
        next = { ...prev };
        if (size === widget.defaultSize) delete next[id];
        else next[id] = size;
        snapshot();
        chosenRef.current = next;
        setChosen(next);
      }
      if (commit) saveSizeMap(sizeStorageKey, next);
    },
    [byId, sizeStorageKey, snapshot],
  );

  function handleReset() {
    clearOrder(storageKey);
    saveSizeMap(sizeStorageKey, {});
    snapshot();
    setOrder(ids); // back to the order widgets are declared in
    setChosen({});
    for (const section of sections.values()) section.reset();
  }

  // Only offer "Reset" once some layout actually diverges from its default.
  // `idsKey` is already the default order joined, so compare against it;
  // inner drag surfaces (sections) report their own divergence.
  const isCustomized =
    orderedIds.join("|") !== idsKey ||
    Object.keys(chosen).length > 0 ||
    [...sections.values()].some((s) => s.isCustomized);

  const board = (
    <DndContext
      // Stable id so dnd-kit's generated accessibility ids (DndDescribedBy-*)
      // are deterministic across SSR and client — otherwise its internal
      // counter mismatches and React reports an unpatchable hydration error.
      id="hux-widget-grid"
      sensors={sensors}
      // The board resolves its own target from the lifted footprint (see
      // handleDragMove); this only feeds the keyboard sensor's sense of
      // which way "right" is.
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* A sortable context so each item has the sortable hooks (keyboard
          coordinates, aria), but no strategy: the reflow is the grid's own,
          animated by FLIP, never a transform per item. */}
      <SortableContext items={orderedIds} strategy={noStrategy}>
        {/* The frame is the container the cell is calculated from — it owns
            the responsive width, so column count and cell size stay in step. */}
        <div
          data-wide={wide ? "" : undefined}
          className={cn(
            "@container mx-auto w-full",
            "max-w-[680px] lg:max-w-5xl roomy:max-w-6xl roomy:data-wide:max-w-[84rem]",
            className,
          )}
        >
          <div
            ref={gridRef}
            data-widget-board
            data-wide={wide ? "" : undefined}
            className="widget-board"
          >
            {orderedIds.map((id, i) => {
              const widget = byId.get(id)!;
              const size = sizeOf(id);
              return (
                <BoardItem
                  key={id}
                  id={id}
                  index={i}
                  size={size}
                  offered={offeredSizes(widget.sizes, fit)}
                  editing={editing}
                  onResize={handleResize}
                >
                  {widget.render(size)}
                </BoardItem>
              );
            })}
          </div>
        </div>
      </SortableContext>

      {/* The lifted card: a portal clone that tracks the cursor. The clone is
          purely visual, so it gets the inert CLONE_EDIT_CONTEXT — it must not
          register sections (otherwise a dragged app folder would register a
          second "app-shelf" and, on drop, its unmount would tear down the
          real folder's registration), but it should *look* held, so
          editing-styled affordances like the folder platter stay visible
          while lifted. */}
      <DragOverlay>
        {activeId && byId.has(activeId) ? (
          <BoardEditContext.Provider value={CLONE_EDIT_CONTEXT}>
            <div
              // Pops from the held size (the press-and-hold grow ends at
              // 1.03) to its floating size, so pickup reads as one motion.
              // `pointer-events-none`: the clone is under the finger when a
              // hold is released without moving, and the click a touch
              // release synthesises would otherwise land on a link inside
              // the clone (which lives in a portal, outside the item's
              // click-swallowing wrapper) and navigate.
              className="widget-lift @container h-full select-none drop-shadow-2xl pointer-events-none"
              style={{ cursor: "grabbing" }}
            >
              {byId.get(activeId)!.render(sizeOf(activeId))}
            </div>
          </BoardEditContext.Provider>
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
    <BoardEditContext.Provider value={editContext}>
      {board}
    </BoardEditContext.Provider>
  );
}
