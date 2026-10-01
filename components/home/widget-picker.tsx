"use client";

import { Menu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { useMasonryEdit } from "@/components/ui/sortable-masonry";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { resetWidgetPrefs, setWidgetEnabled, useWidgetPrefs } from "./widgets";

/**
 * `Widgets` — beside Done while the home grid is in edit mode: every widget
 * the grid can show here, ticked when it is on. A widget off by default (the
 * Lab) is added from here; any other can be taken away. The grid's Reset puts
 * these back too, so it is registered as one of the masonry's sections.
 *
 * The popup is portalled, so it carries `data-edit-controls`: a tap inside it
 * is a tap on the edit controls, and does not end edit mode.
 */
export function WidgetPicker({
  widgets,
}: {
  /** The widgets that could be on the grid right now, in grid order. */
  widgets: { id: string; title: string }[];
}) {
  const { locale } = useLocale();
  const { isEnabled, customized } = useWidgetPrefs();
  const registerSection = useMasonryEdit()?.registerSection;

  useEffect(
    () => registerSection?.("widget-prefs", { reset: resetWidgetPrefs, isCustomized: customized }),
    [registerSection, customized],
  );

  // Edit mode is entered by holding a widget, so the last one cannot go.
  const onCount = widgets.filter((w) => isEnabled(w.id)).length;

  return (
    <Menu.Root>
      {/* A pill, as Done is: the controls float over the grid, and bare
          text there reads against whatever card is under it. */}
      <Menu.Trigger className="pressable rounded-full border border-border/60 bg-glass-strong-hover px-5 py-2.5 text-xs font-mono text-tertiary-foreground shadow-raised backdrop-blur-xl transition-colors hover:text-foreground active:bg-card active:text-foreground data-[popup-open]:text-foreground md:px-4 md:py-1.5">
        {t(locale, "widgetEditWidgets")}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="center" sideOffset={10} className="z-50">
          <Menu.Popup
            data-edit-controls
            className={cn(
              "system-chrome min-w-[12rem] origin-[var(--transform-origin)] rounded-xl border border-border/50",
              "bg-glass-sheet p-1 shadow-overlay backdrop-blur-xl",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            {widgets.map((w) => {
              const on = isEnabled(w.id);
              return (
                <Menu.CheckboxItem
                  key={w.id}
                  checked={on}
                  onCheckedChange={(next) => setWidgetEnabled(w.id, next)}
                  closeOnClick={false}
                  disabled={on && onCount <= 1}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none",
                    "text-foreground data-[highlighted]:bg-muted/40 data-[disabled]:cursor-default data-[disabled]:opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      on ? "border-foreground bg-foreground text-background" : "border-border",
                    )}
                  >
                    <Menu.CheckboxItemIndicator>
                      <Check className="size-3" strokeWidth={3} />
                    </Menu.CheckboxItemIndicator>
                  </span>
                  <span className="flex-1 truncate font-mono text-xs">{w.title}</span>
                </Menu.CheckboxItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
