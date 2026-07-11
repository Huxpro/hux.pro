"use client";

import appIconSnapshot from "@/content/app-icons.json";
import appsJson from "@/content/apps.json";
import type { AppIconSnapshot, AppLink } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useMasonryEdit } from "@/components/ui/sortable-masonry";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  clearOrder,
  loadOrder,
  reconcile,
  saveOrder,
} from "@/components/ui/sortable-order";
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
import { useCallback, useEffect, useMemo, useState } from "react";

// =============================================================================
// AppShelf
//
// An iPad-springboard row of app icons: external links to projects, each
// wearing the icon its site declares for home-screen use (resolved at build
// time by `pnpm apps:snapshot` — see scripts/app-icon-snapshot.ts). The shelf
// itself is one widget in the home masonry, so it drags alongside widgets;
// the icons *inside* it form a nested drag surface with its own persisted
// order, exactly like rearranging apps around widgets on iPadOS.
//
// Nesting details worth knowing:
//   - Icon drags stop pointer-event propagation so a press on an icon never
//     lifts the whole shelf (the shelf still lifts from its empty areas).
//   - An inner drag start enters the masonry's shared edit mode via
//     useMasonryEdit(); that turns on the jiggle *and* makes the masonry item
//     wrapper swallow the post-drop click, which would otherwise open the
//     dropped icon's link. The shared Reset also restores the icon order,
//     through the section registration below.
// =============================================================================

const APPS = (appsJson as { apps: AppLink[] }).apps;
const ICONS = appIconSnapshot as AppIconSnapshot;
const STORAGE_KEY = "hux_app_order";
const DEFAULT_IDS = APPS.map((a) => a.id);
const APPS_BY_ID = new Map(APPS.map((a) => [a.id, a]));

// -----------------------------------------------------------------------------
// Icon visual
// -----------------------------------------------------------------------------

/**
 * Full-bleed vs padded: opaque, purpose-drawn app icons (manifest / apple-touch
 * art is square and generously sized) fill the tile edge-to-edge like a real
 * home-screen icon; small or non-square favicons are glyphs, so they sit
 * centered on the tile with breathing room instead of being blown up blurry.
 */
function iconFillsTile(entry: AppIconSnapshot[string] | undefined): boolean {
  if (!entry?.width || !entry?.height) return false;
  return entry.width === entry.height && entry.width >= 160;
}

/** The tile + label, sans interactivity — shared by the grid and the overlay. */
function AppIconVisual({ app }: { app: AppLink }) {
  const entry = ICONS[app.id];
  return (
    <span className="flex w-full flex-col items-center">
      <span
        className={cn(
          "block h-16 w-16 overflow-hidden rounded-[22.5%]",
          // Icons composite on white, like Safari's add-to-home-screen tiles —
          // dark glyphs stay visible in dark mode and transparency looks
          // intentional. The border keeps white-on-white tiles defined.
          "bg-white border border-black/8 dark:border-white/12",
          "transition-transform duration-200 group-hover/app:scale-105",
        )}
      >
        {entry ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny local static asset; next/image adds nothing for a 64px tile
          <img
            src={entry.file}
            alt=""
            draggable={false}
            className={cn(
              "h-full w-full",
              iconFillsTile(entry) ? "object-cover" : "object-contain p-3",
            )}
          />
        ) : (
          // No snapshot yet (run `pnpm apps:snapshot`) — a monogram tile.
          <span className="flex h-full w-full items-center justify-center font-mono text-xl text-neutral-400">
            {app.title.charAt(0)}
          </span>
        )}
      </span>
      <span className="mt-1.5 block max-w-18 truncate text-center text-[11px] leading-tight text-muted-foreground">
        {app.title}
      </span>
    </span>
  );
}

// -----------------------------------------------------------------------------
// Sortable icon
// -----------------------------------------------------------------------------

function SortableAppIcon({ id }: { id: string }) {
  const app = APPS_BY_ID.get(id)!;
  const { setNodeRef, attributes, listeners, isDragging, transform, transition } =
    useSortable({ id });

  // Pointer presses on an icon must not bubble to the masonry item wrapper,
  // where they would activate the *outer* sortable and lift the whole shelf.
  const guardedListeners = useMemo(() => {
    if (!listeners) return undefined;
    const guarded: typeof listeners = { ...listeners };
    for (const key of ["onMouseDown", "onTouchStart", "onPointerDown"]) {
      const original = guarded[key];
      if (!original) continue;
      guarded[key] = (event: React.SyntheticEvent) => {
        event.stopPropagation();
        original(event);
      };
    }
    return guarded;
  }, [listeners]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...guardedListeners}
      className="flex justify-center"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The lifted icon is the DragOverlay clone; leave a gap in the grid.
        opacity: isDragging ? 0 : 1,
      }}
    >
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        className="group/app block outline-none"
      >
        <AppIconVisual app={app} />
      </a>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shelf
// -----------------------------------------------------------------------------

export function AppShelf() {
  const edit = useMasonryEdit();
  const [order, setOrder] = useState<string[]>(DEFAULT_IDS);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Restore the persisted icon order on mount.
  useEffect(() => {
    const stored = loadOrder(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage
    setOrder(reconcile(stored ?? DEFAULT_IDS, DEFAULT_IDS));
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reset = useCallback(() => {
    clearOrder(STORAGE_KEY);
    setOrder(DEFAULT_IDS);
  }, []);

  // Let the masonry's shared Reset restore the icon order too (and let icon
  // customization alone make the Reset control appear).
  const isCustomized = order.join("|") !== DEFAULT_IDS.join("|");
  const registerSection = edit?.registerSection;
  useEffect(() => {
    return registerSection?.("app-shelf", { reset, isCustomized });
  }, [registerSection, reset, isCustomized]);

  const enterEdit = edit?.enterEdit;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    // Same jiggle mode as dragging a widget — and required so the masonry
    // item wrapper swallows the click that follows this drag's drop.
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

  if (APPS.length === 0) return null;

  return (
    <DndContext
      // Stable id for deterministic SSR ids — same reason as the masonry's.
      id="hux-app-shelf"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        {/* Chrome-less on purpose: icons sit directly on the page surface,
            the way springboard icons sit on wallpaper next to widget cards. */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-5 px-1 py-2">
          {order.map((id) =>
            APPS_BY_ID.has(id) ? <SortableAppIcon key={id} id={id} /> : null,
          )}
        </div>
      </SortableContext>

      {/* The lifted icon: a portal clone that tracks the cursor. */}
      <DragOverlay>
        {activeId && APPS_BY_ID.has(activeId) ? (
          <div
            className="select-none drop-shadow-xl"
            style={{ transform: "scale(1.1)", cursor: "grabbing" }}
          >
            <AppIconVisual app={APPS_BY_ID.get(activeId)!} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
