"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  loadOrder,
  reconcile,
  saveOrder,
} from "./sortable-order";
import { usePressHold } from "./use-press-hold";
import { landsOnOwnAction } from "./widget-surface";
import {
  type CellSpan,
  type LayoutFile,
  type ResizeCorner,
  boardRows,
  clearLayout,
  defaultLayout,
  loadLayout,
  reconcileLayout,
  resolveSpan,
  saveLayout,
  specFor,
  spanFromCorner,
  visualOrder,
} from "./widget-span";

// =============================================================================
// WidgetBoard
//
// An Android home-screen: a grid of square cells, widgets that occupy a
// rectangle of them, holes allowed, and a resize frame in edit mode. The
// masonry's hand-feel is kept (mouse 8px, touch 400ms hold, jiggle, Done /
// Reset). What changed is the model — see docs/system-widget-board.md.
// =============================================================================

export interface BoardWidget {
  id: string;
  node: ReactNode;
}

export interface MasonrySection {
  reset: () => void;
  isCustomized: boolean;
}

interface MasonryEditContextValue {
  editing: boolean;
  enterEdit: () => void;
  registerSection: (id: string, section: MasonrySection) => () => void;
}

const MasonryEditContext = createContext<MasonryEditContextValue | null>(null);

/** Same name the app folder already calls. Null outside the board. */
export function useMasonryEdit(): MasonryEditContextValue | null {
  return useContext(MasonryEditContext);
}

const STORAGE_ORDER = "hux_widget_order";

function readCols(el: HTMLElement | null): number {
  if (!el) return 4;
  const raw = getComputedStyle(el).getPropertyValue("--board-cols").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

function readCell(el: HTMLElement): { cell: number; gap: number } {
  const styles = getComputedStyle(el);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 16;
  const cell = Number.parseFloat(styles.getPropertyValue("--cell")) || 80;
  return { cell, gap };
}

function pointerDistance(
  from: { x: number; y: number },
  ev: PointerEvent,
): number {
  return Math.hypot(ev.clientX - from.x, ev.clientY - from.y);
}

// -----------------------------------------------------------------------------
// One cell
// -----------------------------------------------------------------------------

function BoardItem({
  id,
  span,
  index,
  editing,
  dragging,
  resizeLabel,
  children,
  onMoveStart,
  onResizeStart,
}: {
  id: string;
  span: CellSpan;
  index: number;
  editing: boolean;
  dragging: boolean;
  resizeLabel: string;
  children: ReactNode;
  onMoveStart: (e: ReactPointerEvent<HTMLElement>, id: string) => void;
  onResizeStart: (
    e: ReactPointerEvent<HTMLElement>,
    id: string,
    corner: ResizeCorner,
  ) => void;
}) {
  const hold = usePressHold(TOUCH_ACTIVATION);
  const spec = specFor(id);
  const resizable = spec.minW !== spec.maxW || spec.minH !== spec.maxH;

  const keepForControl = (e: React.SyntheticEvent) =>
    !editing && landsOnOwnAction(e);

  return (
    <div
      data-widget-id={id}
      className="widget-cell select-none"
      style={{
        gridColumn: `${span.col + 1} / span ${span.w}`,
        gridRow: `${span.row + 1} / span ${span.h}`,
        cursor: editing ? "grab" : undefined,
        zIndex: dragging ? 5 : 1,
        touchAction: editing ? "none" : undefined,
      }}
      onPointerDown={(e) => {
        if (keepForControl(e)) return;
        if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
        hold.onPointerDown(e);
        onMoveStart(e, id);
      }}
      onClickCapture={(e) => {
        if (editing) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div {...hold.holdProps} className="h-full">
        <div
          className={cn(
            "h-full",
            dragging && "widget-lift",
            editing && !dragging && "widget-jiggle",
          )}
          style={
            editing && !dragging
              ? { animationDelay: `${(index % 6) * 0.07}s` }
              : undefined
          }
        >
          {children}
        </div>
      </div>
      {editing && resizable && (
        <div className="widget-resize-frame" aria-hidden>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              data-resize-handle={corner}
              aria-label={resizeLabel}
              title={resizeLabel}
              className={cn(
                "widget-resize-handle",
                `widget-resize-handle-${corner}`,
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeStart(e, id, corner);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Board
// -----------------------------------------------------------------------------

export function WidgetBoard({
  items,
  className,
}: {
  items: BoardWidget[];
  className?: string;
}) {
  const { locale } = useLocale();
  const boardRef = useRef<HTMLDivElement>(null);

  const ids = items.map((i) => i.id);
  const idsKey = ids.join("|");
  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.id, i.node])),
    [items],
  );

  const [cols, setCols] = useState(4);
  const [order, setOrder] = useState<string[]>(ids);
  const [spans, setSpans] = useState<Record<string, CellSpan>>(() =>
    defaultLayout(ids, 4),
  );
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveSpan, setLiveSpan] = useState<CellSpan | null>(null);
  const [sections, setSections] = useState<Map<string, MasonrySection>>(
    () => new Map(),
  );

  const spansRef = useRef(spans);
  useEffect(() => {
    spansRef.current = spans;
  }, [spans]);

  const persist = useCallback(
    (nextSpans: Record<string, CellSpan>, nextCols: number, nextIds: string[]) => {
      const file: LayoutFile = { cols: nextCols, spans: nextSpans };
      saveLayout(file);
      const nextOrder = visualOrder(nextIds, nextSpans);
      saveOrder(STORAGE_ORDER, nextOrder);
      setOrder(nextOrder);
    },
    [],
  );

  const enterEdit = useCallback(() => setEditing(true), []);
  const registerSection = useCallback(
    (id: string, section: MasonrySection) => {
      setSections((prev) => new Map(prev).set(id, section));
      return () => {
        setSections((prev) => {
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

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const apply = () => {
      const nextCols = readCols(el);
      setCols((prev) => (prev === nextCols ? prev : nextCols));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const storedOrder = reconcile(loadOrder(STORAGE_ORDER) ?? ids, ids);
    const storedLayout = loadLayout();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: localStorage + measured columns
    setOrder(storedOrder);
    setSpans(reconcileLayout(storedLayout, storedOrder, cols));
  }, [idsKey, cols]); // eslint-disable-line react-hooks/exhaustive-deps -- ids via idsKey

  useEffect(() => {
    setHomeEditing(editing);
    return () => setHomeEditing(false);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
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

  const commitSpans = useCallback(
    (next: Record<string, CellSpan>) => {
      setSpans(next);
      persist(next, cols, ids);
    },
    [cols, ids, persist],
  );

  const othersOf = useCallback((id: string, from: Record<string, CellSpan>) => {
    return Object.entries(from)
      .filter(([key]) => key !== id)
      .map(([, span]) => span);
  }, []);

  const onMoveStart = useCallback(
    (e: ReactPointerEvent<HTMLElement>, id: string) => {
      if (e.button !== 0) return;
      const start = spansRef.current[id];
      if (!start) return;
      const origin = { x: e.clientX, y: e.clientY };
      const touch = e.pointerType === "touch";
      let armed = false;
      let last = start;
      let holdTimer: number | null = null;

      const arm = () => {
        if (armed) return;
        armed = true;
        setEditing(true);
        setActiveId(id);
        setLiveSpan(start);
      };

      const onMove = (ev: PointerEvent) => {
        const dist = pointerDistance(origin, ev);
        if (!armed) {
          if (touch) {
            if (dist > TOUCH_ACTIVATION.tolerance && holdTimer != null) {
              window.clearTimeout(holdTimer);
              holdTimer = null;
            }
            return;
          }
          if (dist < MOUSE_ACTIVATION.distance) return;
          arm();
        }
        const board = boardRef.current;
        if (!board) return;
        ev.preventDefault();
        const { cell, gap } = readCell(board);
        const step = cell + gap;
        const proposed = {
          ...start,
          col: start.col + (ev.clientX - origin.x) / step,
          row: start.row + (ev.clientY - origin.y) / step,
        };
        last = resolveSpan(
          specFor(id),
          proposed,
          othersOf(id, spansRef.current),
          cols,
          start,
        );
        setLiveSpan(last);
      };

      const onUp = () => {
        if (holdTimer != null) window.clearTimeout(holdTimer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (armed) {
          commitSpans({ ...spansRef.current, [id]: last });
        }
        setActiveId(null);
        setLiveSpan(null);
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      if (touch) {
        holdTimer = window.setTimeout(arm, TOUCH_ACTIVATION.delay);
      }
    },
    [cols, commitSpans, othersOf],
  );

  const onResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLElement>, id: string, corner: ResizeCorner) => {
      e.preventDefault();
      const start = spansRef.current[id];
      if (!start) return;
      setEditing(true);
      setActiveId(id);
      setLiveSpan(start);
      const originX = e.clientX;
      const originY = e.clientY;
      let last = start;

      const onMove = (ev: PointerEvent) => {
        const board = boardRef.current;
        if (!board) return;
        ev.preventDefault();
        const { cell, gap } = readCell(board);
        const step = cell + gap;
        const proposed = spanFromCorner(
          start,
          corner,
          (ev.clientX - originX) / step,
          (ev.clientY - originY) / step,
        );
        last = resolveSpan(
          specFor(id),
          proposed,
          othersOf(id, spansRef.current),
          cols,
          start,
        );
        setLiveSpan(last);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        commitSpans({ ...spansRef.current, [id]: last });
        setActiveId(null);
        setLiveSpan(null);
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [cols, commitSpans, othersOf],
  );

  function handleReset() {
    clearOrder(STORAGE_ORDER);
    clearLayout();
    setOrder(ids);
    setSpans(defaultLayout(ids, cols));
    for (const section of sections.values()) section.reset();
  }

  const defaults = defaultLayout(ids, cols);
  const defaultJson = JSON.stringify(defaults);
  const currentJson = JSON.stringify(
    Object.fromEntries(ids.map((id) => [id, spans[id]])),
  );
  const isCustomized =
    currentJson !== defaultJson ||
    [...sections.values()].some((s) => s.isCustomized);

  const displaySpans = { ...spans };
  if (activeId && liveSpan) displaySpans[activeId] = liveSpan;

  const rows = Math.max(boardRows(Object.values(displaySpans)), 1);
  const orderedIds = order.filter((id) => itemsById.has(id) && displaySpans[id]);

  return (
    <MasonryEditContext.Provider value={editContext}>
      <div className={cn("widget-board-frame mx-auto w-full", className)}>
        <div
          ref={boardRef}
          className="widget-board"
          style={{ gridTemplateRows: `repeat(${rows}, var(--cell))` }}
        >
          {orderedIds.map((id, i) => (
            <BoardItem
              key={id}
              id={id}
              span={displaySpans[id]}
              index={i}
              editing={editing}
              dragging={activeId === id}
              resizeLabel={t(locale, "widgetResize")}
              onMoveStart={onMoveStart}
              onResizeStart={onResizeStart}
            >
              {itemsById.get(id)}
            </BoardItem>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            data-edit-controls
            className="system-chrome fixed inset-x-0 bottom-6 md:bottom-24 z-50 flex items-center justify-center gap-4 px-6"
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
                data-edit-reset
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                onClick={handleReset}
                className="pressable text-xs font-mono uppercase tracking-wider text-tertiary-foreground transition-colors hover:text-muted-foreground active:text-foreground"
              >
                {t(locale, "widgetEditReset")}
              </button>
            )}
            <button
              type="button"
              data-edit-done
              onPointerDown={(e) => {
                e.stopPropagation();
                setEditing(false);
              }}
              onClick={() => setEditing(false)}
              className="pressable rounded-full border border-border/60 bg-glass-strong-hover px-5 py-2.5 md:px-4 md:py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground shadow-raised backdrop-blur-xl transition-colors hover:text-foreground active:bg-card active:text-foreground"
            >
              {t(locale, "widgetEditDone")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MasonryEditContext.Provider>
  );
}

/** @deprecated Prefer WidgetBoard. Kept so existing imports type-check during the cutover. */
export type SortableWidget = BoardWidget;
export const SortableMasonry = WidgetBoard;
