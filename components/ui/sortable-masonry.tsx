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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { HANDOFF, setHomeEditing } from "./home-edit-store";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  clearOrder,
  guardActivators,
  loadOrder,
  reconcile,
  saveOrder,
} from "./sortable-order";
import { usePressHold } from "./use-press-hold";
import { landsOnOwnAction } from "./widget-surface";

// =============================================================================
// SortableMasonry
//
// An iPad-springboard-style widget grid. Renders children into a responsive
// CSS multi-column masonry (1 / 2 / 3 / 4 columns) and lets the visitor rearrange
// them, mirroring how iPadOS / macOS treat each pointer type:
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
// empty (non-widget) area, or the "Done" pill, leaves it. The order is an array of widget IDs
// persisted to localStorage, so each visitor keeps their own layout.
//
// Why this shape:
//   - CSS `columns` keeps every card in a single, SSR-renderable container
//     (no JS measurement), which matters for static export.
//   - Column *count* grows with the screen, column *width* doesn't: like an
//     iPad Pro springboard, a bigger display shows more widgets rather than
//     stretched ones. Each step therefore pairs a column count with a
//     container max-width (see `gridScale`), so a column keeps roughly the
//     same width as the screen grows and the grid stays centered in whatever
//     space is left over.
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
// The fourth column only unlocks once there are enough widgets to fill it:
// CSS multicol balances by height, so with a handful of cards a fourth column
// takes a single widget and leaves a lopsided, half-empty grid. Below that
// threshold an ultrawide screen instead gets three slightly roomier columns —
// still far narrower than the ~630px a widget already renders at on a phone in
// landscape, so nothing has to be re-tuned.
//
// The last step is gated on `roomy:` (wide *and* tall, see globals.css), not
// width alone: it exists to spend space the screen actually has spare, so a
// short ultrawide — already scrolling — keeps the familiar desktop board.
// =============================================================================

const MIN_ITEMS_FOR_FOUR_COLUMNS = 8;

function gridScale(count: number) {
  return count >= MIN_ITEMS_FOR_FOUR_COLUMNS
    ? {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-[84rem]",
        columns: "columns-1 sm:columns-2 lg:columns-3 roomy:columns-4",
      }
    : {
        width: "max-w-[680px] lg:max-w-5xl roomy:max-w-6xl",
        columns: "columns-1 sm:columns-2 lg:columns-3",
      };
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

  return (
    <div
      ref={setNodeRef}
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
      // text selection.
      className="mb-4 break-inside-avoid system-voice"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The dragged card is represented by the DragOverlay clone; leave a
        // blank placeholder in the flow so siblings know where the gap is.
        opacity: isDragging ? 0 : 1,
        cursor: editing ? "grab" : undefined,
      }}
    >
      {/* Three transforms, three wrappers, so none fights another: the outer
          element carries dnd-kit's sort transform, this one the slow
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

  const [order, setOrder] = useState<string[]>(ids);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sections, setSections] = useState<Map<string, MasonrySection>>(
    () => new Map(),
  );

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

  // Restore the persisted order on mount and whenever the widget set changes.
  useEffect(() => {
    const stored = loadOrder(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage + syncing to the current widget set
    setOrder(reconcile(stored ?? ids, ids));
  }, [storageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- ids tracked via idsKey

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
    for (const section of sections.values()) section.reset();
  }

  const orderedIds = order.filter((id) => itemsById.has(id));
  const scale = gridScale(orderedIds.length);
  // Only offer "Reset" once some layout actually diverges from its default.
  // `idsKey` is already the default order joined, so compare against it;
  // inner drag surfaces (sections) report their own divergence.
  const isCustomized =
    orderedIds.join("|") !== idsKey ||
    [...sections.values()].some((s) => s.isCustomized);

  const grid = (
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
        <div className={cn("mx-auto w-full", scale.width)}>
          <div className={cn(scale.columns, "gap-x-4", className)}>
            {orderedIds.map((id, i) => (
              <SortableMasonryItem key={id} id={id} index={i} editing={editing}>
                {itemsById.get(id)}
              </SortableMasonryItem>
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
