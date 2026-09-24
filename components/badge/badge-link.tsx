"use client";

import { t } from "@/lib/i18n";
import type { MediaKind } from "@/lib/log";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalAttachments } from "@/systems/attachments";
import { useOptionalWindows } from "@/systems/windows";
import {
  AppWindow,
  AtSign,
  BookOpen,
  CornerDownRight,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import { resolveBadge, type BadgeIcon, type BadgeKind } from "./resolve";

// =============================================================================
// BadgeLink — a thing I made, named inline, one press from where it lives.
//
//   Working on <Badge commit="lynx-framework">Lynx</Badge> at ByteDance.
//   Play <Badge app="lynx-flappy-bird" />, or watch
//   <Badge href="https://youtu.be/lGEMwh32soc">React without memo</Badge>.
//
// A badge is a word in a sentence that wears its official icon: an app's
// home-screen icon, or the icon the thing's site declares for a home screen,
// snapshotted by `pnpm badges:snapshot` (lib/badge-site.ts says which site).
// A path on this site wears this site's icon, an image wears itself. Only a
// badge nobody has snapshotted yet falls back — a commit to a monogram in its
// era's colour, anything else to the glyph of what it is, the same glyphs a
// cover's chip wears (components/log/media/media-mark.tsx) — and CI
// (`pnpm badges:check`) keeps that from shipping.
//
// Pressing it opens the thing in the site's own home for it, never a tab the
// site could have avoided (resolve.ts names the three ways to point at one):
//
//   a page             the in-app browser (a window; a sheet on a phone), or
//                      a tab when the page refuses to be framed
//   a recording, deck  the stage — the theater, a PiP on a phone
//   a post, a path     the router
//   an app             a window, on its own runtime
//   an image, a post   the attachment surface, which is their only in-site
//   on X / Instagram   home on every viewport
//
// A page, a recording and a deck go straight to their native home even on a
// phone (`act`), skipping the attachment sheet a /works cover opens: a badge
// is one thing, with no set to page through. The badge keeps a real `href`,
// so ⌘-click, middle-click and a page without JavaScript still work.
//
// A surface that hosts badges and should step aside when one opens something
// — the About, which floats over everything — wraps them in
// <BadgeLaunchProvider onLaunch={…}>.
// =============================================================================

const BadgeLaunchContext = createContext<(() => void) | null>(null);

/** Called just before a badge inside it opens its thing. */
export function BadgeLaunchProvider({
  onLaunch,
  children,
}: {
  onLaunch: () => void;
  children: ReactNode;
}) {
  return (
    <BadgeLaunchContext.Provider value={onLaunch}>
      {children}
    </BadgeLaunchContext.Provider>
  );
}

export interface BadgeLinkProps {
  /** A commit id in content/log.json — a project, a talk, a post. */
  commit?: string;
  /** Which of the commit's media to open. Defaults to its first. */
  item?: number;
  /** An app id in content/apps.json — opens in a window. */
  app?: string;
  /** Any URL: a page, a recording, a deck, an image, a social post, a path. */
  href?: string;
  /** Force the kind of `href` (read off the URL otherwise). */
  as?: MediaKind;
  /** An icon image (`/app-icons/…`, a URL) or an app id whose icon to wear. */
  icon?: string;
  /** The label, when there are no children; the window's or stage's title. */
  title?: string;
  className?: string;
  children?: ReactNode;
}

const GLYPHS: Record<BadgeKind, LucideIcon> = {
  app: AppWindow,
  web: Globe,
  writing: BookOpen,
  route: CornerDownRight,
  video: Play,
  slides: Presentation,
  image: ImageIcon,
  social: AtSign,
};

/** The pill. Sized in `em` so it sits in a sentence at whatever size. */
const BADGE =
  "not-prose badge-link group/badge inline whitespace-nowrap rounded-[0.4em] " +
  "bg-muted px-[0.38em] py-[0.1em] box-decoration-clone " +
  "text-[0.94em] font-normal text-foreground no-underline " +
  "transition-[background-color,opacity] duration-200 hover:bg-accent " +
  "active:opacity-60 active:duration-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const ICON_BOX =
  "mr-[0.34em] inline-block size-[1.08em] shrink-0 rounded-[0.26em] align-[-0.2em]";

function BadgeMark({ icon, kind }: { icon: BadgeIcon; kind: BadgeKind }) {
  if (icon.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a 1em glyph; next/image would only add a wrapper
      <img
        src={icon.src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          ICON_BOX,
          icon.fill ? "object-cover" : "bg-white object-contain p-[0.1em]",
        )}
      />
    );
  }
  if (icon.type === "monogram") {
    return (
      <span
        aria-hidden
        className={cn(ICON_BOX, "relative", !icon.color && "bg-foreground/60")}
        style={icon.color ? { backgroundColor: icon.color } : undefined}
      >
        <span className="absolute inset-0 grid place-items-center font-mono text-[0.62em] font-semibold leading-none text-white">
          {icon.letter}
        </span>
      </span>
    );
  }
  const Glyph = GLYPHS[kind];
  return (
    <Glyph
      aria-hidden
      strokeWidth={2.25}
      className={cn(
        ICON_BOX,
        "size-[0.95em] align-[-0.14em] text-muted-foreground transition-colors group-hover/badge:text-foreground",
      )}
    />
  );
}

export function BadgeLink({
  commit,
  item,
  app,
  href,
  as,
  icon,
  title,
  className,
  children,
}: BadgeLinkProps) {
  const { locale } = useLocale();
  const attachments = useOptionalAttachments();
  const windows = useOptionalWindows();
  const onLaunch = useContext(BadgeLaunchContext);

  const badge = useMemo(
    () => resolveBadge({ commit, item, app, href, as, icon, title }, locale),
    [commit, item, app, href, as, icon, title, locale],
  );

  if (!badge) {
    // A badge pointing at nothing still reads as the word it was.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[BadgeLink] nothing resolves for", { commit, app, href });
    }
    return <span className={className}>{children ?? title}</span>;
  }

  const { target } = badge;
  const home =
    target?.type === "media" && attachments
      ? attachments.nativeHomeOf(target.set, 0)
      : target?.type === "app"
        ? "window"
        : "route";
  const external = /^https?:/.test(badge.href);
  const tooltip =
    home === "tab" ? `${badge.title} · ${t(locale, "linkOpensInTab")}` : badge.title;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modified and middle clicks are the browser's: a new tab, a download.
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!target) return;
    if (target.type === "app") {
      if (!windows) return;
      e.preventDefault();
      onLaunch?.();
      windows.openApp(target.app);
      return;
    }
    if (!attachments) return;
    e.preventDefault();
    onLaunch?.();
    const { media, set } = target;
    // An image and a social post have no home but the surface; everything
    // else goes straight where it lives.
    if (media.kind === "image" || media.kind === "social-embed") {
      attachments.open(set, 0);
    } else {
      attachments.act(set, 0);
    }
  };

  return (
    <a
      href={badge.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      title={tooltip}
      data-badge={badge.kind}
      onClick={onClick}
      className={cn(BADGE, className)}
    >
      <BadgeMark icon={badge.icon} kind={badge.kind} />
      {children ?? badge.label}
    </a>
  );
}
