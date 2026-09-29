"use client";

import { AppTile, type AppTileSize } from "@/components/apps/app-tile";
import { useBoardEdit } from "@/components/ui/widget-board";
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
  APPS_BY_ID,
  DEFAULT_APP_FOLDER_LAYOUT,
  DEFAULT_APP_IDS,
  FEATURED_APPS,
  chunkAppPages,
  pageCapacity,
  type AppFolderAxis,
  type AppFolderLayout,
} from "@/lib/apps";
import type { AppLink } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "@/components/ui/widget-size";
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
// + board edit/jiggle behavior is preserved from the original AppShelf.
//
// On the widget board the folder is sized like a widget, and a size is how
// many icon slots it covers — the iPhone's own arithmetic, where a small
// widget takes the room of 2×2 icons:
//
//   small   2×2 — four icons, the room of a small widget
//   medium  4×2
//   large   4×4
//   xl      8×2 (iPad)
//
// Under the Apple skin the slots are the board's icon grid (`.app-grid` in
// globals.css): icons sized and spaced from the cell and the two gaps, so
// every icon's edge meets a widget's edge. A folder larger than its catalog
// is not offered — four apps are a small square, not a medium with an empty
// row (see `appFolderSizes`); a catalog larger than the folder pages.
// Classic keeps its centred pages (smaller icons on the small square), since
// its gaps have no room for a name under a grid-aligned icon.
// =============================================================================

const STORAGE_KEY = "hux_app_order_v2";

/**
 * Icon slots per size. `tile` is Classic's fixed icon (the Apple skin sizes
 * icons from the grid instead) — 48px on the small square, where four 64px
 * icons and their names would not fit. `classicLabels` can hide Classic's
 * names for a shape that has no room for them; every shape has room today.
 */
const FOLDER_SHAPE: Record<
  WidgetSize,
  { layout: AppFolderLayout; tile: AppTileSize; classicLabels: boolean }
> = {
  small: { layout: { columns: 2, rows: 2, axis: "x" }, tile: "md", classicLabels: true },
  medium: { layout: DEFAULT_APP_FOLDER_LAYOUT, tile: "lg", classicLabels: true },
  large: { layout: { columns: 4, rows: 4, axis: "x" }, tile: "lg", classicLabels: true },
  xl: { layout: { columns: 8, rows: 2, axis: "x" }, tile: "lg", classicLabels: true },
};

/**
 * The sizes the folder offers for a catalog of `appCount` apps: small always
 * (it pages), and a larger one only once the catalog outgrows the one below
 * it — a size whose slots would mostly stand empty is not a size.
 */
export function appFolderSizes(appCount: number): WidgetSize[] {
  const sizes: WidgetSize[] = ["small"];
  if (appCount > pageCapacity(FOLDER_SHAPE.small.layout)) sizes.push("medium");
  if (appCount > pageCapacity(FOLDER_SHAPE.medium.layout)) sizes.push("large", "xl");
  return sizes;
}

/** The smallest size that holds the whole catalog on one page. */
export function appFolderDefaultSize(appCount: number): WidgetSize {
  const sizes = appFolderSizes(appCount);
  return (
    sizes.find((s) => pageCapacity(FOLDER_SHAPE[s].layout) >= appCount) ??
    sizes[sizes.length - 1]
  );
}

// iOS grows a held icon a touch more than a held widget — it's smaller, so the
// same absolute lift needs a larger ratio to register. The lifted clone pops
// from the held size to the lift size, so the two must agree.
const ICON_HOLD_SCALE = 1.08;
const ICON_LIFT_SCALE = 1.15;

export interface AppFolderProps {
  /** Override page layout; defaults to 4×2 horizontal pages. */
  layout?: Partial<AppFolderLayout>;
  /** The widget size on the board; picks the page shape (see `FOLDER_SHAPE`). */
  size?: WidgetSize;
  className?: string;
}

// -----------------------------------------------------------------------------
// Sortable icon
// -----------------------------------------------------------------------------

function SortableAppIcon({
  id,
  revealBadge = false,
  tile = "lg",
  labelClassName,
}: {
  id: string;
  revealBadge?: boolean;
  tile?: AppTileSize;
  labelClassName?: string;
}) {
  const app = APPS_BY_ID.get(id)!;
  const { setNodeRef, attributes, listeners, isDragging, transform, transition } =
    useSortable({ id });
  const hold = usePressHold({ ...TOUCH_ACTIVATION, scale: ICON_HOLD_SCALE });

  // Pointer presses on an icon must not bubble to the board item wrapper,
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
          <AppTile
            app={app}
            size={tile}
            labelClassName={labelClassName}
            revealBadge={revealBadge}
          />
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
        axis === "x"
          ? // Apple skin: under the folder, in the gap the icon names use,
            // so the dots never push the grid off its slots.
            "pt-2 skin-apple:absolute skin-apple:inset-x-0 skin-apple:top-full skin-apple:pt-1"
          : "absolute right-1 top-1/2 -translate-y-1/2 flex-col",
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

export function AppFolder({
  layout: layoutOverride,
  size = "medium",
  className,
}: AppFolderProps) {
  const shape = FOLDER_SHAPE[size];
  const labelClassName = shape.classicLabels ? undefined : "skin-classic:hidden";
  const layout: AppFolderLayout = {
    ...shape.layout,
    ...layoutOverride,
  };
  const capacity = pageCapacity(layout);
  const edit = useBoardEdit();
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

  if (FEATURED_APPS.length === 0) return null;

  const needsPages = pageCount > 1;
  // Single page: natural grid height (no forced empty rows — `repeat(rows)`
  // plus row-gap was leaving a phantom gap under a short catalog).
  // Multi page: lock row count so every snap page shares one footprint
  // (8 / 12 / 16 icons → pages of `columns × rows`, last page may be short).
  //
  // The columns and rows are variables so each skin can lay the same markup
  // out its own way (dnd-kit cannot host the icons twice): Classic in equal
  // fractions of the folder, Apple on the board's icon grid.
  const pageStyle = {
    "--cols": layout.columns,
    "--rows": layout.rows,
  } as CSSProperties;

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
            // Fills its cell on the board. Classic: the page grid sits
            // centred in whatever height is left, the way a folder's icons
            // float. Apple: icons start at the top-left slot, on the grid.
            "app-grid relative flex h-full flex-col justify-center rounded-2xl border",
            "skin-apple:justify-start",
            // Apple skin: no platter, ever — iOS draws none behind icons;
            // in edit mode the icons jiggle as the object, as its own do.
            // No border either, so nothing insets the icons off the grid.
            "skin-apple:border-0 skin-apple:bg-transparent skin-apple:shadow-none skin-apple:backdrop-blur-none",
            "skin-apple:hover:bg-transparent",
            "transition-colors duration-300",
            // At rest the labels have nothing behind them but the wallpaper,
            // so the folder is a bare zone whose ink may flip — on the
            // picture's middle band, where it sits (see
            // docs/system-legibility.md). Editing puts glass under it, and
            // glass carries the card colour, so the zone stops being bare;
            // `ink-bare-rest` does the same for the hover glass.
            editing
              ? "border-border/60 bg-glass-strong shadow-raised backdrop-blur-sm"
              : "ink-bare-mid ink-bare-rest border-transparent hover:border-border/40 hover:bg-glass",
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
                  "grid gap-x-2",
                  // Classic's small square is tight: two rows of 48px
                  // icons and their names, 157px tall at the smallest.
                  size === "small" ? "gap-y-3" : shape.classicLabels ? "gap-y-5" : "gap-y-2",
                  "grid-cols-[repeat(var(--cols),minmax(0,1fr))]",
                  needsPages && "grid-rows-[repeat(var(--rows),auto)]",
                  // Apple skin: the board's icon grid (`.app-grid`).
                  "skin-apple:grid-cols-[repeat(var(--cols),var(--icon))] skin-apple:grid-rows-[repeat(var(--rows),var(--icon))]",
                  "skin-apple:gap-x-(--icon-hgap) skin-apple:gap-y-(--icon-vgap) skin-apple:justify-start",
                  // The folder is chrome-less at rest, so its own edges are
                  // where the tiles sit, not a card border — keep this snug
                  // (rather than the ~20px card padding elsewhere) so icons
                  // read flush with sibling widgets' top/left/right edges.
                  // The remaining sliver is just clipping headroom for the
                  // hover scale (top/left/right) and the badge overhang
                  // (bottom) once a snap scroller has to clip overflow.
                  "px-0 pt-1 pb-2 skin-apple:px-(--icon-bleed) skin-apple:py-0",
                  needsPages && "w-full shrink-0 snap-start snap-always",
                )}
                style={pageStyle}
              >
                {page.map((id) => (
                  <SortableAppIcon
                    key={id}
                    id={id}
                    revealBadge={editing}
                    tile={shape.tile}
                    labelClassName={labelClassName}
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
                  size={shape.tile}
                  labelClassName={labelClassName}
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
