"use client";

import { AppTile } from "@/components/apps/app-tile";
import { useMasonryEdit } from "@/components/ui/sortable-masonry";
import { usePressHold } from "@/components/ui/use-press-hold";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  clearOrder,
  guardActivators,
  loadOrder,
  reconcile,
  saveOrder,
} from "@/components/ui/sortable-order";
import {
  APPS,
  APPS_BY_ID,
  DEFAULT_APP_FOLDER_LAYOUT,
  DEFAULT_APP_IDS,
  chunkAppPages,
  pageCapacity,
  type AppFolderAxis,
  type AppFolderLayout,
} from "@/lib/apps";
import type { AppLink } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useOptionalWindows } from "@/systems/windows";
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

// =============================================================================
// AppFolder
//
// Home-screen app folder: an iPad-style icon grid that snap-scrolls into pages
// when there are more apps than fit on one page. Axis is configurable (x like
// iOS folders, or y for a vertical stack of pages). Nested dnd-kit reordering
// + masonry edit/jiggle behavior is preserved from the original AppShelf.
// =============================================================================

const STORAGE_KEY = "hux_app_order";

// iOS grows a held icon a touch more than a held widget — it's smaller, so the
// same absolute lift needs a larger ratio to register. The lifted clone pops
// from the held size to the lift size, so the two must agree.
const ICON_HOLD_SCALE = 1.08;
const ICON_LIFT_SCALE = 1.15;

export interface AppFolderProps {
  /** Override page layout; defaults to 4×2 horizontal pages. */
  layout?: Partial<AppFolderLayout>;
  className?: string;
}

// -----------------------------------------------------------------------------
// Sortable icon
// -----------------------------------------------------------------------------

function SortableAppIcon({
  id,
  revealBadge = false,
}: {
  id: string;
  revealBadge?: boolean;
}) {
  const app = APPS_BY_ID.get(id)!;
  const { setNodeRef, attributes, listeners, isDragging, transform, transition } =
    useSortable({ id });
  const hold = usePressHold({ ...TOUCH_ACTIVATION, scale: ICON_HOLD_SCALE });

  // Pointer presses on an icon must not bubble to the masonry item wrapper,
  // where they would activate the *outer* sortable and lift the whole folder
  // (and start the folder's own press-and-hold grow).
  const guardedListeners = useMemo(
    () =>
      guardActivators(listeners, (event) => {
        event.stopPropagation();
        return false;
      }),
    [listeners],
  );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...guardedListeners}
      onPointerDown={(e) => {
        e.stopPropagation();
        hold.onPointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      className="flex justify-center"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
    >
      <div {...hold.holdProps}>
        <AppLaunchLink app={app}>
          <AppTile app={app} size="lg" revealBadge={revealBadge} />
        </AppLaunchLink>
      </div>
    </div>
  );
}

/** Real anchor + left-click → window; ⌘/middle-click keeps a new tab. */
function AppLaunchLink({
  app,
  children,
}: {
  app: AppLink;
  children: React.ReactNode;
}) {
  const windows = useOptionalWindows();
  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      onClick={(e) => {
        if (
          !windows ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        windows.openApp(app);
      }}
      // `pressable` + the tile's `group-active/app` dim: an iOS icon darkens
      // the instant it is touched, before anything else happens.
      className="group/app pressable relative z-0 block overflow-visible outline-none hover:z-10 focus-visible:z-10"
    >
      {children}
    </a>
  );
}

// -----------------------------------------------------------------------------
// Page dots
// -----------------------------------------------------------------------------

function PageDots({
  count,
  active,
  axis,
  onSelect,
}: {
  count: number;
  active: number;
  axis: AppFolderAxis;
  onSelect: (index: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5",
        axis === "x" ? "pt-2" : "absolute right-1 top-1/2 -translate-y-1/2 flex-col",
      )}
      role="tablist"
      aria-label="App folder pages"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Page ${i + 1}`}
          onClick={() => onSelect(i)}
          className={cn(
            "pressable h-1.5 w-1.5 rounded-full transition-colors",
            i === active
              ? "bg-foreground/70"
              : "bg-foreground/25 hover:bg-foreground/40 active:bg-foreground/55",
          )}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Folder
// -----------------------------------------------------------------------------

export function AppFolder({ layout: layoutOverride, className }: AppFolderProps) {
  const layout: AppFolderLayout = {
    ...DEFAULT_APP_FOLDER_LAYOUT,
    ...layoutOverride,
  };
  const capacity = pageCapacity(layout);
  const edit = useMasonryEdit();
  const editing = edit?.editing ?? false;
  const [order, setOrder] = useState<string[]>(DEFAULT_APP_IDS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadOrder(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage
    setOrder(reconcile(stored ?? DEFAULT_APP_IDS, DEFAULT_APP_IDS));
    setMounted(true);
  }, []);

  const pages = useMemo(
    () => chunkAppPages(order.filter((id) => APPS_BY_ID.has(id)), capacity),
    [order, capacity],
  );
  const pageCount = pages.length;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reset = useCallback(() => {
    clearOrder(STORAGE_KEY);
    setOrder(DEFAULT_APP_IDS);
    setPageIndex(0);
    scrollerRef.current?.scrollTo({ top: 0, left: 0 });
  }, []);

  const isCustomized = order.join("|") !== DEFAULT_APP_IDS.join("|");
  const registerSection = edit?.registerSection;
  useEffect(() => {
    return registerSection?.("app-shelf", { reset, isCustomized });
  }, [registerSection, reset, isCustomized]);

  const enterEdit = edit?.enterEdit;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    enterEdit?.();
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
      saveOrder(STORAGE_KEY, prev);
      return prev;
    });
  }

  // Track which snap page is in view for the page dots.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || pageCount <= 1) return;

    const update = () => {
      if (layout.axis === "x") {
        const w = el.clientWidth || 1;
        setPageIndex(Math.round(el.scrollLeft / w));
      } else {
        const h = el.clientHeight || 1;
        setPageIndex(Math.round(el.scrollTop / h));
      }
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [layout.axis, pageCount]);

  // Keep pageIndex in range when the catalog shrinks.
  useEffect(() => {
    if (pageIndex >= pageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp after catalog/order change
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageIndex, pageCount]);

  const scrollToPage = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(index, pageCount - 1));
      if (layout.axis === "x") {
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
      } else {
        el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
      }
      setPageIndex(clamped);
    },
    [layout.axis, pageCount],
  );

  if (APPS.length === 0) return null;

  const needsPages = pageCount > 1;
  // Single page: natural grid height (no forced empty rows — `repeat(rows)`
  // plus row-gap was leaving a phantom gap under a short catalog).
  // Multi page: lock row count so every snap page shares one footprint
  // (8 / 12 / 16 icons → pages of `columns × rows`, last page may be short).
  const pageStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
    ...(needsPages
      ? { gridTemplateRows: `repeat(${layout.rows}, auto)` }
      : null),
  };

  return (
    <DndContext
      id="hux-app-folder"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div
          className={cn(
            "relative rounded-2xl border px-1 py-1.5",
            "transition-colors duration-300",
            // At rest the labels have nothing behind them but the wallpaper,
            // so the folder is a bare zone whose ink may flip (see
            // docs/system-legibility.md). Editing puts glass under it, and
            // glass carries the card colour, so the zone stops being bare;
            // `ink-bare-rest` does the same for the hover glass.
            editing
              ? "border-border/60 bg-glass-strong shadow-raised backdrop-blur-sm"
              : "ink-bare ink-bare-rest border-transparent hover:border-border/40 hover:bg-glass",
            className,
          )}
        >
          <div
            ref={scrollerRef}
            className={cn(
              // Hide scrollbars — page dots are the affordance; snap does the rest.
              "no-scrollbar",
              // Hover scale (105%) + the corner badge hang a few px off the
              // 64px tile. Keep that overflow visible on a single page so the
              // art isn't sheared; snap pages still have to clip, so each
              // page grid carries matching padding below.
              needsPages && layout.axis === "x" &&
                "flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
              needsPages && layout.axis === "y" &&
                "flex flex-col snap-y snap-mandatory overflow-y-auto overflow-x-hidden",
            )}
            style={
              needsPages && layout.axis === "y"
                ? {
                    // Cap vertical folder height to one page so y-snap works.
                    maxHeight: `calc(${layout.rows} * 5.5rem)`,
                  }
                : undefined
            }
          >
            {pages.map((page, pi) => (
              <div
                key={`page-${pi}`}
                className={cn(
                  "grid gap-x-2 gap-y-5",
                  // Room for the tile's hover scale + badge overhang so
                  // overflow-x/y on a snap scroller can't clip the art.
                  "px-1 py-1.5",
                  needsPages && "w-full shrink-0 snap-start snap-always",
                )}
                style={pageStyle}
              >
                {page.map((id) => (
                  <SortableAppIcon
                    key={id}
                    id={id}
                    revealBadge={editing}
                  />
                ))}
              </div>
            ))}
          </div>

          <PageDots
            count={pageCount}
            active={pageIndex}
            axis={layout.axis}
            onSelect={scrollToPage}
          />
        </div>
      </SortableContext>

      {mounted &&
        createPortal(
          <DragOverlay>
            {activeId && APPS_BY_ID.has(activeId) ? (
              <div
                // Pops from the held size to its floating size, so pickup
                // reads as one motion.
                className="widget-lift select-none drop-shadow-xl pointer-events-none"
                style={
                  {
                    "--press-hold-scale": ICON_HOLD_SCALE,
                    "--lift-scale": ICON_LIFT_SCALE,
                    cursor: "grabbing",
                  } as CSSProperties
                }
              >
                <AppTile
                  app={APPS_BY_ID.get(activeId)!}
                  size="lg"
                  revealBadge
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

/** @deprecated Prefer {@link AppFolder} — kept as a stable export alias. */
export const AppShelf = AppFolder;
