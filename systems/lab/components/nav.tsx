"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { LAB_GROUPS, LAB_INDEX, LABS, labFromPath } from "../catalog";
import { useFrameStrings } from "../i18n";

/**
 * The lab's name in its bar, and the way to every other lab: a dropdown that
 * lists the whole family, the index first. `page` sets it at title size, for
 * a page that has no bar.
 */
export function LabNav({
  appearance = "bar",
  className,
}: {
  appearance?: "page" | "bar";
  className?: string;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const F = useFrameStrings();
  const current = labFromPath(pathname);
  const page = appearance === "page";
  const title = current ? current.name[locale] : LAB_INDEX.name[locale];

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "group inline-flex min-w-0 items-center gap-1 rounded-md text-left outline-none",
          "focus-visible:ring-1 focus-visible:ring-foreground/20",
          page
            ? "font-serif text-2xl tracking-tight text-foreground sm:text-3xl"
            : [
                "text-sm font-medium text-foreground",
                // On the bar: a press wash and a 48px target, like the
                // `λhux` beside it.
                "pressable hit-area -mx-1.5 h-7 rounded-full px-1.5 transition-colors",
                "hover:bg-muted/60 active:bg-muted data-[popup-open]:bg-muted/60",
              ],
          className,
        )}
        aria-label={`${F.labs} · ${title}`}
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180",
            page ? "h-4 w-4" : "h-3 w-3",
          )}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Menu.Popup
            className={cn(
              "min-w-[17rem] max-w-[calc(100vw-2rem)] origin-[var(--transform-origin)] rounded-xl border border-border/50",
              "bg-glass-sheet p-1 shadow-overlay backdrop-blur-xl",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            <NavItem
              href={LAB_INDEX.href}
              mark={`/${LAB_INDEX.mark}`}
              hint={F.everyLab}
              active={!current}
            />
            {/* The index's two sections, in its order: libraries, then studies. */}
            {LAB_GROUPS.map(({ kind, title }) => (
              <Menu.Group key={kind}>
                <div className="mx-2 my-1 h-px bg-border/60" />
                <Menu.GroupLabel className={cn(TYPE.labelSm, "px-2.5 pb-0.5 pt-1.5")}>
                  {t(locale, title)}
                </Menu.GroupLabel>
                {LABS.filter((lab) => lab.kind === kind).map((lab) => (
                  <NavItem
                    key={lab.id}
                    href={lab.href}
                    mark={lab.name[locale]}
                    hint={lab.hint[locale]}
                    active={lab.id === current?.id}
                  />
                ))}
              </Menu.Group>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function NavItem({ href, mark, hint, active }: { href: string; mark: string; hint: string; active: boolean }) {
  return (
    <Menu.LinkItem
      href={href}
      closeOnClick
      render={<Link href={href} />}
      className={cn(
        "flex cursor-pointer flex-col rounded-lg px-2.5 py-2 outline-none",
        "data-[highlighted]:bg-muted/40",
        active && "bg-muted/25",
      )}
    >
      <span className="font-mono text-xs text-foreground">{mark}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </Menu.LinkItem>
  );
}
