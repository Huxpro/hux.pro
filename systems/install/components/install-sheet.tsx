"use client";

import { cn } from "@/lib/utils";
import { t, useLocale, type TranslationKey } from "@/services";
import { AdaptiveSurface, type SurfacePresentation } from "@/systems/surface";
import {
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Menu,
  MonitorDown,
  PanelBottom,
  Plus,
  Share,
  SquarePlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { installTarget, promptInstall, type InstallGuide } from "../lib/platform";
import { useInstall } from "../provider";

// ---------------------------------------------------------------------------
// InstallSheet — the directions that come before "Add to Home Screen".
//
// The tilt primer's sibling, for the same reason: the thing it leads to is a
// browser's, and a page cannot press it for you. Where Chromium hands us its
// install dialog, the sheet's button opens it — one press to learn what it is,
// one to spend the event, which is single-use. Everywhere else (every browser
// on an iPhone, Safari on a Mac, a browser that kept its event) the door is in
// the browser's own menu, and the sheet shows which buttons lead to it, drawn
// the way they look on screen, since that glyph is what the eye goes hunting
// for in a toolbar full of them.
//
// A sheet on a phone and a window on a desktop — unlike the primer, both are
// real cases here. The panel shape is skipped: this is a form, not a list,
// and a side drawer holding four lines would be mostly empty.
//
// The picture is the promise, as the primer's is: the site's own icon landing
// on a home screen (or a Dock), so what "install" gets you is on screen before
// any sentence about it.
// ---------------------------------------------------------------------------

const PRESENTATION: SurfacePresentation = { base: "sheet", lg: "window" };

/** The button to look for, drawn roughly as the browser draws it. */
type Glyph =
  | "share"
  | "more"
  | "moreV"
  | "menu"
  | "add"
  | "confirm"
  | "install"
  | "dock"
  | "open";

const GLYPHS: Record<Glyph, typeof Share> = {
  share: Share,
  more: Ellipsis,
  moreV: EllipsisVertical,
  menu: Menu,
  add: SquarePlus,
  confirm: Plus,
  install: MonitorDown,
  dock: PanelBottom,
  open: ExternalLink,
};

type Step = [Glyph, TranslationKey];

/**
 * Every guide's steps, in the order the menus are met. Kept to the three or
 * four presses it actually takes — a fifth line is where people stop reading.
 * Menu labels are quoted as the browser prints them; Chrome's is mid-rename
 * on Android, so its step names both.
 */
const STEPS: Record<InstallGuide, Step[]> = {
  installed: [],
  unsupported: [],
  "ios-safari": [
    ["more", "installStepSafariMore"],
    ["share", "installStepShare"],
    ["add", "installStepAddHome"],
    ["confirm", "installStepAddWebApp"],
  ],
  "ios-safari-legacy": [
    ["share", "installStepShareToolbar"],
    ["add", "installStepAddHome"],
    ["confirm", "installStepAdd"],
  ],
  "ipados-safari": [
    ["share", "installStepShareTop"],
    ["add", "installStepAddHome"],
    ["confirm", "installStepAdd"],
  ],
  "ios-chrome": [
    ["share", "installStepShareAddressBar"],
    ["add", "installStepAddHome"],
    ["confirm", "installStepAdd"],
  ],
  "ios-other": [
    ["menu", "installStepMenuShare"],
    ["add", "installStepAddHome"],
    ["confirm", "installStepAdd"],
  ],
  "in-app": [
    ["more", "installStepInAppMore"],
    ["open", "installStepInAppOpen"],
    ["add", "installStepInAppAgain"],
  ],
  "android-chrome": [
    ["moreV", "installStepDotsTop"],
    ["add", "installStepChromeAndroidAdd"],
    ["confirm", "installStepInstall"],
  ],
  "android-samsung": [
    ["menu", "installStepSamsungMenu"],
    ["add", "installStepSamsungAdd"],
    ["confirm", "installStepAdd"],
  ],
  "android-firefox": [
    ["moreV", "installStepDotsFirefox"],
    ["add", "installStepFirefoxAdd"],
    ["confirm", "installStepAdd"],
  ],
  "desktop-chrome": [
    ["install", "installStepAddressBarIcon"],
    ["moreV", "installStepChromeMenu"],
    ["confirm", "installStepInstallClick"],
  ],
  "desktop-edge": [
    ["install", "installStepAddressBarIcon"],
    ["more", "installStepEdgeMenu"],
    ["confirm", "installStepInstallClick"],
  ],
  "mac-safari": [
    ["dock", "installStepMacFile"],
    ["share", "installStepMacShare"],
    ["confirm", "installStepAddClick"],
  ],
};

const TITLE: Record<ReturnType<typeof installTarget>, TranslationKey> = {
  "home-screen": "installTitleHome",
  dock: "installTitleDock",
  app: "installTitleApp",
};

const BODY: Record<ReturnType<typeof installTarget>, TranslationKey> = {
  "home-screen": "installBodyHome",
  dock: "installBodyDock",
  app: "installBodyApp",
};

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

/**
 * A home screen of placeholder icons with one empty slot, and the site's icon
 * dropping into it — on a phone for a home screen, on a display's Dock for a
 * desktop. The placeholders are the same wash as the tilt primer's phone, so
 * the only thing with colour in it is the icon that is arriving.
 *
 * `landed` is the still frame: the icon already in its slot, which is the
 * picture of "done" and what reduced motion is left with.
 */
function InstallIllustration({
  shape,
  landed,
}: {
  shape: "phone" | "desktop";
  landed: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      // Short on purpose: on a phone this sits above four steps and a button,
      // and a sheet that has to scroll to reach "Got it" has lost the reader.
      className={cn("flex h-36 items-center justify-center", landed && "install-landed")}
    >
      {shape === "phone" ? <PhoneHome /> : <DesktopDock />}
    </div>
  );
}

const ICON = "/icons/icon.svg";

/**
 * Evenly spaced positions for `count` items of `size` with `gap` between them,
 * centred on `centre`. Every row of icons here goes through it, so nothing is
 * placed by hand and nothing can sit a few units off the axis it is drawn on.
 */
function centredRow(count: number, size: number, gap: number, centre: number): number[] {
  const span = count * size + (count - 1) * gap;
  const start = centre - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * (size + gap));
}

/**
 * The phone. Its screen is x 13–83, y 9–159 (centre x 48), and everything on
 * it is laid out about that centre: a 4 × 4 page of icons under the notch,
 * and a Dock whose icons stand in the page's columns — as on iOS — with its
 * backing inset from the screen's edge by the same margin on all three sides.
 */
const PHONE = {
  centre: 48,
  icon: 10,
  radius: 3,
  /** Gap between icons, both ways, so the page is a square lattice. */
  gap: 6,
  /** Top of the first row: clear of the notch (y 13–17) by the same gap. */
  top: 26,
  /** How far the Dock's backing sits inside the screen, sides and bottom. */
  dockInset: 3,
  dockHeight: 18,
  screen: { x: 13, y: 9, width: 70, height: 150 },
} as const;

function PhoneHome() {
  const { centre, icon, radius, gap, top, dockInset, dockHeight, screen } = PHONE;
  const cols = centredRow(4, icon, gap, centre);
  const rows = Array.from({ length: 4 }, (_, i) => top + i * (icon + gap));
  // The new one takes the third slot of the last row, where a fresh install
  // actually lands: after the apps already there.
  const slot = { x: cols[2], y: rows[3] };
  const dock = {
    x: screen.x + dockInset,
    width: screen.width - dockInset * 2,
    y: screen.y + screen.height - dockInset - dockHeight,
  };
  const dockIconY = dock.y + (dockHeight - icon) / 2;
  return (
    <svg viewBox="0 0 96 168" width="80" height="140" fill="none">
      <rect
        x="8"
        y="4"
        width="80"
        height="160"
        rx="15"
        className="fill-foreground/[0.04] stroke-foreground/25"
        strokeWidth="1.5"
      />
      <rect {...screen} rx="10" className="fill-foreground/[0.06]" />
      <rect x={centre - 10} y="13" width="20" height="4" rx="2" className="fill-foreground/20" />
      {rows.flatMap((y) =>
        cols.map((x) =>
          x === slot.x && y === slot.y ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={icon}
              height={icon}
              rx={radius}
              className="fill-foreground/[0.12]"
            />
          )
        )
      )}
      {/* The Dock, which stays as it is — a new app goes on the page. */}
      <rect
        x={dock.x}
        y={dock.y}
        width={dock.width}
        height={dockHeight}
        rx="7"
        className="fill-foreground/[0.04]"
      />
      {cols.map((x) => (
        <rect
          key={`dock-${x}`}
          x={x}
          y={dockIconY}
          width={icon}
          height={icon}
          rx={radius}
          className="fill-foreground/[0.12]"
        />
      ))}
      <InstallSlot x={slot.x} y={slot.y} size={icon} radius={radius} />
    </svg>
  );
}

/**
 * The display. Its screen is x 17–183 (centre x 100); the Dock is centred on
 * it with equal padding either side of its icons, and the new app lands at
 * the Dock's trailing end, as it does on a Mac. The window above is centred
 * too — anywhere else it reads as the picture being off, not the window.
 */
const DESK = {
  centre: 100,
  icon: 12,
  radius: 3,
  gap: 2,
  /** Padding inside the Dock, around its icons, all four sides. */
  pad: 4,
  /** The Dock's bottom edge, clear of the screen's (y 103) by the pad. */
  dockBottom: 99,
} as const;

function DesktopDock() {
  const { centre, icon, radius, gap, pad, dockBottom } = DESK;
  const icons = centredRow(6, icon, gap, centre);
  const slot = { x: icons[icons.length - 1], y: dockBottom - pad - icon };
  const dock = {
    x: icons[0] - pad,
    width: icons[icons.length - 1] + icon + pad - (icons[0] - pad),
    y: slot.y - pad,
    height: icon + pad * 2,
  };
  const win = { width: 84, height: 50 };
  return (
    <svg viewBox="0 0 200 126" width="220" height="139" fill="none">
      {/* The display and its stand. */}
      <rect
        x="12"
        y="4"
        width="176"
        height="104"
        rx="8"
        className="fill-foreground/[0.04] stroke-foreground/25"
        strokeWidth="1.5"
      />
      <rect x="17" y="9" width="166" height="94" rx="4" className="fill-foreground/[0.06]" />
      <path
        d={`M${centre - 14} 108 L${centre - 18} 122 H${centre + 18} L${centre + 14} 108`}
        className="stroke-foreground/25"
        strokeWidth="1.5"
      />
      {/* A window, so it reads as a desktop and not as a blank screen. */}
      <rect
        x={centre - win.width / 2}
        y="18"
        width={win.width}
        height={win.height}
        rx="4"
        className="fill-foreground/[0.08]"
      />
      <rect
        x={centre - win.width / 2}
        y="18"
        width={win.width}
        height="8"
        rx="4"
        className="fill-foreground/[0.08]"
      />
      {/* The Dock. */}
      <rect {...dock} rx="6" className="fill-foreground/[0.08]" />
      {icons.slice(0, -1).map((x) => (
        <rect
          key={x}
          x={x}
          y={slot.y}
          width={icon}
          height={icon}
          rx={radius}
          className="fill-foreground/[0.14]"
        />
      ))}
      <InstallSlot x={slot.x} y={slot.y} size={icon} radius={radius} />
    </svg>
  );
}

/**
 * The empty slot and the icon arriving in it. The slot is dashed so it reads
 * as a place rather than as one more app; the icon covers it once it lands.
 */
function InstallSlot({
  x,
  y,
  size,
  radius,
}: {
  x: number;
  y: number;
  size: number;
  radius: number;
}) {
  return (
    <>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={size - 1}
        height={size - 1}
        rx={radius}
        className="install-slot stroke-foreground/30"
        strokeWidth="0.75"
        strokeDasharray="2 1.5"
      />
      <g className="install-icon" style={{ transformOrigin: `${x + size / 2}px ${y + size / 2}px` }}>
        <clipPath id={`install-icon-clip-${x}-${y}`}>
          <rect x={x} y={y} width={size} height={size} rx={radius} />
        </clipPath>
        <image
          href={ICON}
          x={x}
          y={y}
          width={size}
          height={size}
          clipPath={`url(#install-icon-clip-${x}-${y})`}
        />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

/**
 * One visit to the sheet.
 *
 *   offer      the directions, or the button that opens the browser's dialog.
 *   asking     that dialog is up; it covers the page, so this only has to not
 *              offer the button twice.
 *   accepted   installed — said, then the sheet lets itself out.
 *   dismissed  the dialog was closed with a no. The event is spent, and the
 *              browser will offer a new one later on its own schedule.
 */
type Phase = "offer" | "asking" | "accepted" | "dismissed";

/** How long an outcome stays up before the sheet closes itself, ms. */
const DWELL: Record<"accepted" | "dismissed", number> = {
  accepted: 1800,
  dismissed: 2400,
};

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function InstallSheet() {
  const { locale } = useLocale();
  const { isOpen, close, guide, canPrompt, installed } = useInstall();
  const [phase, setPhase] = useState<Phase>("offer");

  useEffect(() => {
    if (phase !== "accepted" && phase !== "dismissed") return;
    const timer = window.setTimeout(close, DWELL[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, close]);

  // Back to the offer on the way in, during the render that opens it — the
  // same reset the tilt primer does, and for the same reason: swapping the
  // content while the sheet animates away would flash the offer behind the
  // outcome.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setPhase("offer");
  }

  const target = installTarget(guide);
  const shape = target === "home-screen" ? "phone" : "desktop";
  const steps = STEPS[guide];

  const take = async () => {
    setPhase("asking");
    const outcome = await promptInstall();
    // "unavailable": the event went stale between the render and the press.
    // Nothing was asked, so the offer stands — now as directions, since
    // `canPrompt` has gone false with it.
    setPhase(outcome === "unavailable" ? "offer" : outcome);
  };

  /** A sentence instead of the directions: there is nothing to do, or nothing
   *  left to do. */
  const status: TranslationKey | null =
    phase === "accepted" || installed
      ? "installAccepted"
      : phase === "dismissed"
        ? "installDismissed"
        : guide === "installed"
          ? "installAlready"
          : guide === "unsupported" && !canPrompt
            ? "installUnsupported"
            : null;

  const done = phase === "accepted" || installed || guide === "installed";

  return (
    <AdaptiveSurface
      id="surface-install"
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      presentation={PRESENTATION}
      title={t(locale, TITLE[target])}
      closeLabel={t(locale, "installClose")}
      windowWidth="min(92vw, 400px)"
      maxHeight="min(86vh, 640px)"
      fitContent
    >
      <div className="space-y-4 pb-2">
        <InstallIllustration shape={shape} landed={done} />

        {status ? (
          <>
            <p
              role="status"
              className="px-0.5 py-2 text-center text-[15px] leading-relaxed text-secondary-foreground"
            >
              {t(locale, status)}
            </p>
            {/* Outcomes close themselves; a standing sentence needs a way out. */}
            {phase === "offer" && (
              <button
                type="button"
                onClick={close}
                className={cn(BUTTON, "bg-foreground/[0.06] hover:bg-foreground/10")}
              >
                {t(locale, "installGotIt")}
              </button>
            )}
          </>
        ) : canPrompt ? (
          <>
            <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
              {t(locale, BODY[target])}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                // Straight from the press: `prompt()` needs the user gesture.
                onClick={take}
                disabled={phase === "asking"}
                className={cn(
                  BUTTON,
                  "bg-foreground text-background hover:bg-foreground/90",
                  "disabled:opacity-50"
                )}
              >
                {t(locale, "installConfirm")}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={phase === "asking"}
                className={cn(
                  BUTTON,
                  "bg-foreground/[0.06] hover:bg-foreground/10",
                  "disabled:opacity-50"
                )}
              >
                {t(locale, "installNotNow")}
              </button>
            </div>
            <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
              {t(locale, "installPromptNote")}
            </p>
          </>
        ) : (
          <>
            <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
              {t(locale, guide === "in-app" ? "installBodyInApp" : BODY[target])}
            </p>
            <ol className="space-y-1 rounded-2xl bg-foreground/[0.04] p-2">
              {steps.map(([glyph, text], i) => {
                const Icon = GLYPHS[glyph];
                return (
                  <li key={text} className="flex items-center gap-3 px-1.5 py-1.5">
                    <span className="w-3 shrink-0 text-center font-mono text-[11px] text-tertiary-foreground">
                      {i + 1}
                    </span>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.06] text-foreground">
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="text-[14px] leading-snug text-foreground">
                      {t(locale, text)}
                    </span>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={close}
              className={cn(BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
            >
              {t(locale, "installGotIt")}
            </button>
            <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
              {t(locale, "installManualNote")}
            </p>
          </>
        )}
      </div>
    </AdaptiveSurface>
  );
}
