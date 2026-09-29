"use client";

import { buildCommitPreview } from "@/components/log/commit-embed";
import { mediaPeek, type MediaPeekSpec } from "@/components/log/media/media-peek";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { t } from "@/lib/i18n";
import type { Media, MediaKind } from "@/lib/log";
import { cn } from "@/lib/utils";
import { useInputCapability, useLocale } from "@/services";
import { useOptionalAttachments } from "@/systems/attachments";
import {
  IDENTITY_PEEK_PANEL,
  IdentityPeek,
  useOptionalIdentityCard,
} from "@/systems/identity";
import { useOptionalWindows } from "@/systems/windows";
import {
  AppWindow,
  AtSign,
  BookOpen,
  Building2,
  CornerDownRight,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import {
  createContext,
  useContext,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  resolveMagicLink,
  type BadgeIcon,
  type MagicLinkKind,
  type MagicLinkTarget,
} from "./resolve";

// =============================================================================
// MagicLink — a word that summons something.
//
//   I <MagicLink post="dreamer">dream</MagicLink> of making …
//   … web apps for <Badge role="alitrip-engineer">Alibaba</Badge> …
//   … architecting <Badge commit="lynx-framework">Lynx</Badge>.
//
// One link, two dresses. Plain, it is the prose link's underline — a word
// that points somewhere. As a badge (`badge`, MDX `<Badge>`) it is a pill
// wearing the thing's official icon — a company, a project, an app — the
// icon its site declares for a home screen, snapshotted by
// `pnpm badges:snapshot` (lib/badge-site.ts says which site), and CI
// (`pnpm badges:check`) keeps a badge from shipping without one.
//
// Either way it behaves the same, and it behaves the way the thing it names
// behaves everywhere else on the site (resolve.ts names what can be named):
//
//                  with a pointer                 on a phone
//   a post         the /writing row's peek        the drawer: the same peek,
//                                                 and Read
//   a media item   the /works cover's peek        the attachment drawer
//   a role         the /works role row's peek:    the identity card
//                  the identity's profile
//   a page         its card                       the drawer: the card, Visit
//
// A press goes where the thing lives: a post or a path by the router, a
// recording or a deck to the stage, a page to the in-app browser (a tab if it
// refuses to be framed), a role to its row on /works, an app to a window. It
// goes through the attachments' policy exactly as a /works cover does
// (`open`): on a phone the drawer first — the thing, its title and its way
// in, a thumb's reach from where you are — never a jump into a player or a
// page from a word. The peek follows the input, as every peek on the site
// does (`magneticPreviewEnabled`): a touch tablet has no pointer to rest, so
// a tap there opens a role's card as a popover and a media item its home.
//
// It keeps a real `href`, so ⌘-click, middle-click and a page without
// JavaScript still work.
//
// A magic link is a word in a sentence, so it copies as one: a badge's icon
// is not selectable (a monogram's letter would otherwise copy as "H Hux
// Blog"), and a drag across it selects text rather than dragging the link
// away.
//
// A surface that hosts magic links and should step aside when one opens
// something — the About, which floats over everything — wraps them in
// <MagicLinkHost onLaunch={…}>. Not for a drawer or a card: those float over
// their host (the About raises them, OVER_ABOUT_Z), so a link that opens one
// leaves the host where it is.
// =============================================================================

interface MagicLinkHostValue {
  onLaunch: () => void;
  layer?: number;
}

const MagicLinkHostContext = createContext<MagicLinkHostValue | null>(null);

/**
 * A surface hosting magic links. `onLaunch` is called just before a link
 * inside it takes the reader elsewhere — anywhere but a drawer or a card,
 * which float over the host. `layer` is the host's paint layer when it sits
 * above the page's (the About, z 10020): the peeks come up over it.
 */
export function MagicLinkHost({
  onLaunch,
  layer,
  children,
}: MagicLinkHostValue & { children: ReactNode }) {
  const value = useMemo(() => ({ onLaunch, layer }), [onLaunch, layer]);
  return (
    <MagicLinkHostContext.Provider value={value}>
      {children}
    </MagicLinkHostContext.Provider>
  );
}

export interface MagicLinkProps {
  /** A commit id in content/log.json — one of its media, as a /works cover. */
  commit?: string;
  /** Which of the commit's media. Defaults to its first. */
  item?: number;
  /** A role — a range id under `identities` in content/log.json. */
  role?: string;
  /** An identity id, as a whole. */
  identity?: string;
  /** Resolved on the server (server.tsx): a post with its peek, a section
   *  of the site. MDX names a post by `post=` there; here it is `media`,
   *  or `href` for a client that renders a MagicLink directly. */
  media?: Media;
  /** An app id in content/apps.json — opens in a window. */
  app?: string;
  /** Any URL: a page, a recording, a deck, an image, a social post, a path. */
  href?: string;
  /** Force the kind of `href` (read off the URL otherwise). */
  as?: MediaKind;
  /** An icon image (`/app-icons/…`, a URL) or an app id whose icon to wear. */
  icon?: string;
  /** The label, when there are no children; the drawer's or stage's title. */
  title?: string;
  /** Dress it as a badge: the pill and the thing's icon (MDX `<Badge>`). */
  badge?: boolean;
  className?: string;
  children?: ReactNode;
}

const GLYPHS: Record<MagicLinkKind, LucideIcon> = {
  identity: Building2,
  app: AppWindow,
  web: Globe,
  writing: BookOpen,
  route: CornerDownRight,
  video: Play,
  slides: Presentation,
  image: ImageIcon,
  social: AtSign,
};

/** A plain magic link: the running-text link (`.prose-link`, globals.css —
 *  the same rule as an article's links), nothing else. `.not-prose` keeps
 *  the article's other rules off it. */
const PLAIN =
  "not-prose prose-link " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The pill. Sized in `em` so it sits in a sentence at whatever size. */
const BADGE =
  "not-prose badge-link group/badge inline whitespace-nowrap rounded-[0.4em] " +
  "bg-muted px-[0.38em] py-[0.1em] box-decoration-clone " +
  "text-[0.94em] font-normal text-foreground no-underline " +
  "transition-[background-color,opacity] duration-200 hover:bg-accent " +
  "active:opacity-60 active:duration-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const ICON_BOX =
  "mr-[0.34em] inline-block size-[1.08em] shrink-0 rounded-[0.26em] align-[-0.2em] select-none";

/**
 * A badge's icon, on its own. Sized in `em` like the pill, so a host that
 * wants it larger sets a font size around it rather than a second recipe:
 * /works prints each project beside the icon its badge wears, and the two
 * must never differ (the plate under a favicon, the fill of a home-screen
 * icon, the rounding, the monogram).
 */
export function BadgeMark({ icon, kind }: { icon: BadgeIcon; kind: MagicLinkKind }) {
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

/** What a target shows under the pointer, or null when it has nothing. */
function peekOf(
  target: MagicLinkTarget | null,
  locale: "en" | "zh",
  leaves: boolean,
): MediaPeekSpec | null {
  if (!target) return null;
  if (target.type === "identity") {
    return {
      node: <IdentityPeek identityId={target.identityId} roleId={target.roleId} />,
      panelClassName: IDENTITY_PEEK_PANEL,
    };
  }
  if (target.type === "media") {
    // A whole commit peeks as its /works row does.
    if (target.commit) {
      const row = buildCommitPreview(target.commit, locale);
      return row ? { node: row.node, panelClassName: row.panelClassName ?? "" } : null;
    }
    const media = target.media;
    // A page nobody has a card for yet has nothing to show but its name,
    // which the link already prints.
    if (media.kind === "link") {
      const preview = media.previews?.[locale] ?? media.preview;
      if (!media.internal?.peek && !preview?.title && !preview?.image) return null;
    }
    return mediaPeek(media, locale, { leaves });
  }
  return null;
}

export function MagicLink({
  commit,
  item,
  role,
  identity,
  media,
  app,
  href,
  as,
  icon,
  title,
  badge: dressed = false,
  className,
  children,
}: MagicLinkProps) {
  const { locale } = useLocale();
  const { magneticPreviewEnabled } = useInputCapability();
  const attachments = useOptionalAttachments();
  const identityCard = useOptionalIdentityCard();
  const windows = useOptionalWindows();
  const router = useTransitionRouter();
  const host = useContext(MagicLinkHostContext);
  const onLaunch = host?.onLaunch;

  const link = useMemo(
    () =>
      resolveMagicLink(
        {
          commit,
          item,
          role,
          identity,
          media,
          app,
          href,
          as,
          icon,
          title,
        },
        locale,
      ),
    [commit, item, role, identity, media, app, href, as, icon, title, locale],
  );

  if (!link) {
    // A link pointing at nothing still reads as the word it was.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[MagicLink] nothing resolves for", { commit, role, app, href });
    }
    return <span className={className}>{children ?? title}</span>;
  }

  const { target } = link;
  const home =
    target?.type === "media" && attachments
      ? attachments.homeOf(target.set, 0)
      : target?.type === "app"
        ? "window"
        : "route";
  const external = /^https?:/.test(link.href);
  // Whether it has a peek is the thing's, not the input's: the input is
  // only known in the browser, so the markup cannot depend on it or a phone
  // hydrates a different tree from the one the server sent.
  // MagneticPreview shows the peek only to a pointer, once hydrated.
  const peek = peekOf(target, locale, home === "tab");
  // With a peek the thing has already said what it is; without, the
  // tooltip names it (and says when it will leave for a tab).
  const tooltip = peek
    ? undefined
    : home === "tab"
      ? `${link.title} · ${t(locale, "linkOpensInTab")}`
      : link.title;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modified and middle clicks are the browser's: a new tab, a download.
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Nothing to open but its fallback page: the browser follows the link,
    // and the host steps aside for it — unless it leaves for a tab, which
    // takes nothing from the host.
    if (!target) {
      if (!external) onLaunch?.();
      return;
    }
    if (target.type === "app") {
      if (!windows) return;
      e.preventDefault();
      onLaunch?.();
      windows.openApp(target.app);
      return;
    }
    if (target.type === "identity") {
      e.preventDefault();
      // A finger has no peek: the card is the peek, over the host (a sheet
      // on a phone, a popover off the word on a touch tablet). With a
      // pointer the peek has said it; a press goes to the role's row.
      if (!magneticPreviewEnabled && identityCard) {
        identityCard.open({
          identityId: target.identityId,
          roleId: target.roleId,
          anchor: e.currentTarget,
        });
        return;
      }
      onLaunch?.();
      router.push(link.href);
      return;
    }
    if (!attachments) return;
    e.preventDefault();
    // A whole commit off a phone goes to its row on /works: the row is the
    // commit, as a role's row is the role.
    if (target.commit && home !== "surface") {
      onLaunch?.();
      router.push(link.href);
      return;
    }
    // The attachments' policy, as a /works cover: the drawer on a phone,
    // the thing's own home on a desk. The drawer floats over whatever hosts
    // the link; a host that should step aside for anything else hears it
    // from the attachments themselves (`onSend`), as the About does.
    attachments.open(target.set, 0);
  };

  const anchor = (
    <a
      href={link.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      title={tooltip}
      data-magic-link={link.kind}
      // A drag across a word selects it; the link is still a click away.
      draggable={false}
      onClick={onClick}
      className={cn(dressed ? BADGE : PLAIN, className)}
    >
      {dressed && <BadgeMark icon={link.icon} kind={link.kind} />}
      {children ?? link.label}
    </a>
  );

  if (!peek) return anchor;
  return (
    <MagneticPreview
      as="span"
      preview={peek.node}
      panelClassName={peek.panelClassName}
      zIndex={host?.layer}
    >
      {anchor}
    </MagneticPreview>
  );
}

