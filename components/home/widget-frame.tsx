"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { Check, LayoutGrid, MinusCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useId,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { useMasonryEdit } from "@/components/ui/sortable-masonry";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  GLASS_PILL_FLAT,
  GLASS_TRACK,
} from "@/systems/theater/lib/chrome";
import { setWidgetEnabled, useWidgetForm, wasJustChosen } from "./widgets";

// =============================================================================
// WidgetFrame — what the home screen wraps every widget in: the widget's
// menu, and the form it is drawn in.
//
// Modelled on the three Apple platforms, each where it belongs:
//
//   macOS   right-click a widget: its forms as a choice (Sonoma's Small /
//           Medium / Large), then Edit Home Screen and Remove Widget.
//   iOS     hold a widget and the grid jiggles (SortableMasonry); a widget
//   iPadOS  that comes in forms shows a strip on its lower edge, the way
//           iOS 18 offers sizes on a widget in edit mode — tap a form and
//           the widget changes in place.
//
// The menu is the pointer's: Base UI's ContextMenu also opens on a touch
// long-press, and here a long-press already lifts the card, so a finger is
// turned away from it and goes through edit mode instead.
//
// A change of form morphs: the frame eases from the old height to the new
// while the new face resolves in (`.widget-form-in`). Only for a choice made
// just now — a saved form arriving after hydration simply is.
// =============================================================================

/** A form's component, by the form ids `HOME_WIDGETS` declares. */
export type WidgetForms = Record<string, ComponentType>;

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const MORPH_MS = 420;

export function WidgetFrame({
  id,
  removable,
  forms,
  children,
}: {
  id: string;
  /** False for the last widget on the grid, which cannot go. */
  removable: boolean;
  /** The widget's forms; or `children` for a widget drawn one way. */
  forms?: WidgetForms;
  children?: ReactNode;
}) {
  const { locale } = useLocale();
  const edit = useMasonryEdit();
  const { forms: specs, form, setForm } = useWidgetForm(id);
  const reduce = useReducedMotion();
  const pointer = useRef<string>("mouse");

  const Form = forms && form ? forms[form] : null;
  const hasForms = !!Form && specs.length > 1;
  const morphing = !!form && wasJustChosen(id) && !reduce;

  // The frame's height between morphs (kept by a ResizeObserver on the face),
  // and on a new form a morph from it: hold the old height, ease to the new.
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  useLayoutEffect(() => {
    const box = outer.current;
    const el = inner.current;
    if (!box || !el) return;
    let timer = 0;
    let settle: (() => void) | null = null;

    const from = lastHeight.current;
    const to = el.offsetHeight;
    if (morphing && from && from !== to) {
      box.style.overflow = "hidden";
      box.style.height = `${from}px`;
      void box.offsetHeight; // commit the start before the transition begins
      box.style.transition = `height ${MORPH_MS}ms ${EASE}`;
      box.style.height = `${to}px`;
      settle = () => {
        // Where the frame is now — mid-way, if another form interrupts.
        lastHeight.current = box.getBoundingClientRect().height;
        box.style.removeProperty("height");
        box.style.removeProperty("transition");
        box.style.removeProperty("overflow");
      };
      timer = window.setTimeout(() => {
        settle?.();
        settle = null;
      }, MORPH_MS + 40);
    } else {
      lastHeight.current = to;
    }

    const ro = new ResizeObserver(() => {
      if (!box.style.height) lastHeight.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
      settle?.();
    };
    // Keyed on the form: the face is remounted per form, and a morph is a
    // change of form, nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const body = (
    <div ref={outer} className="rounded-2xl">
      <div
        ref={inner}
        key={form ?? "one"}
        className={cn(morphing && "widget-form-in")}
      >
        {Form ? <Form /> : children}
      </div>
    </div>
  );

  // Base UI cancels its own handler when asked; the event type does not say so.
  const turnAway = (e: unknown) =>
    (e as { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className="relative"
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        // A finger's long-press is the grid's: it lifts the card.
        onTouchStart={turnAway}
        onContextMenu={(e) => {
          if (pointer.current === "touch") turnAway(e);
        }}
      >
        {body}
        {edit?.editing && hasForms && (
          <FormStrip
            specs={specs}
            form={form}
            onSelect={setForm}
            label={t(locale, "widgetForm")}
          />
        )}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-[60]">
          <ContextMenu.Popup
            // A tap in here is a tap on the edit controls, not on the grid.
            data-edit-controls
            className={cn(
              "system-chrome min-w-[13rem] origin-[var(--transform-origin)] rounded-xl border border-border/50",
              "bg-glass-sheet p-1 shadow-overlay backdrop-blur-xl outline-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            {hasForms && (
              <>
                <ContextMenu.RadioGroup value={form} onValueChange={(v) => setForm(String(v))}>
                  {specs.map((f) => {
                    const Icon = f.icon;
                    return (
                      <ContextMenu.RadioItem
                        key={f.id}
                        value={f.id}
                        closeOnClick
                        className={ITEM}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="flex-1">{t(locale, f.title)}</span>
                        <ContextMenu.RadioItemIndicator>
                          <Check className="size-3.5" strokeWidth={2.5} />
                        </ContextMenu.RadioItemIndicator>
                      </ContextMenu.RadioItem>
                    );
                  })}
                </ContextMenu.RadioGroup>
                <ContextMenu.Separator className="mx-2 my-1 h-px bg-border/60" />
              </>
            )}
            <ContextMenu.Item className={ITEM} onClick={() => edit?.enterEdit()}>
              <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">{t(locale, "widgetEditHome")}</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={cn(ITEM, "text-red-500")}
              disabled={!removable}
              onClick={() => setWidgetEnabled(id, false)}
            >
              <MinusCircle className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{t(locale, "widgetRemove")}</span>
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const ITEM = cn(
  "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none",
  "text-foreground data-[highlighted]:bg-muted/40",
  "data-[disabled]:opacity-40",
);

/**
 * The forms as a strip on the card's lower edge, half over it, in edit mode
 * only. One glyph per form, the current one on a sliding pill — the same
 * motion as the album tabs, so a choice of one-of-a-few looks the same
 * wherever it is made.
 */
function FormStrip({
  specs,
  form,
  onSelect,
  label,
}: {
  specs: ReturnType<typeof useWidgetForm>["forms"];
  form: string | null;
  onSelect: (form: string) => void;
  label: string;
}) {
  const { locale } = useLocale();
  const pillId = useId();
  const reduce = useReducedMotion();
  return (
    <div
      // The grid lets this through: not a pickup, and its taps are not
      // swallowed the way the rest of a jiggling card's are.
      data-widget-edit
      role="radiogroup"
      aria-label={label}
      className={cn(
        "absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 items-center rounded-full p-0.5 shadow-raised",
        GLASS_TRACK,
      )}
    >
      {specs.map((f) => {
        const Icon = f.icon;
        const active = f.id === form;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(locale, f.title)}
            title={t(locale, f.title)}
            onClick={() => onSelect(f.id)}
            className={cn(
              "pressable relative isolate flex h-7 w-9 items-center justify-center rounded-full outline-none",
              active ? "text-foreground" : "text-tertiary-foreground hover:text-muted-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn("absolute inset-0 -z-10 rounded-full", GLASS_PILL_FLAT)}
                transition={reduce ? { duration: 0 } : { type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              />
            )}
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
