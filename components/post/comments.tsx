"use client";

import {
  GISCUS,
  GISCUS_LANG,
  GISCUS_ORIGIN,
  commentsEnabled,
  giscusThemeUrl,
} from "@/lib/comments";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale, useTheme } from "@/services";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// Comments — a post's GitHub Discussion, drawn by giscus in an iframe.
//
// This is giscus's `client.js`, kept to what a React page needs, so the frame
// is ours: it mounts and unmounts with the post (the script leaves a global
// `message` listener behind on every navigation), it takes the theme from the
// theme service rather than from the OS, and it waits under our own quiet
// placeholder instead of GitHub's octocat. The protocol it speaks:
//
//   giscus → us   `resizeHeight` (the frame has no scrollbar; we size it),
//                 `signOut` and credential `error`s (drop the session, reload).
//   us → giscus   `setConfig` — the theme, whenever ours changes. Only once
//                 the widget has spoken: a message sent before its listener
//                 exists is lost, and a new `src` would reload the thread.
//
// The session is giscus's own: after "Sign in with GitHub" it redirects back
// here with `?giscus=<session>`, which we move to localStorage under the key
// `client.js` uses, so a visitor signed in anywhere else on the web is still
// signed in here.
// =============================================================================

const SESSION_KEY = "giscus-session";

type GiscusMessage = {
  resizeHeight?: number;
  signOut?: boolean;
  error?: string;
};

/** Take a session handed back in the URL; otherwise the stored one. */
function claimSession(): string {
  const url = new URL(window.location.href);
  const handed = url.searchParams.get("giscus");
  try {
    if (handed) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(handed));
      url.searchParams.delete("giscus");
      window.history.replaceState(window.history.state, "", url);
      return handed;
    }
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as string) : "";
  } catch {
    return handed ?? "";
  }
}

function forgetSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage off: there was nothing to forget.
  }
}

function metaContent(selector: string): string {
  return document.querySelector<HTMLMetaElement>(selector)?.content ?? "";
}

/** The section's id: giscus signs a reader in and sends them back here. */
const ANCHOR = "comments";

function widgetSrc(term: string, lang: string, theme: string, session: string) {
  const origin = new URL(window.location.href);
  origin.searchParams.delete("giscus");
  // Where "Sign in with GitHub" returns to: the thread, not the top of a
  // long post.
  origin.hash = ANCHOR;
  const canonical = document.querySelector<HTMLLinkElement>("link[rel=canonical]")?.href;
  const params = new URLSearchParams({
    origin: origin.toString(),
    session,
    theme,
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "bottom",
    repo: GISCUS.repo,
    repoId: GISCUS.repoId,
    category: GISCUS.category,
    categoryId: GISCUS.categoryId,
    // Match the Discussion by a hash of its title, not GitHub's fuzzy search:
    // `writing/react` must never land in `writing/react-native`.
    strict: "1",
    description: metaContent("meta[property='og:description']"),
    backLink: canonical || origin.toString().replace(/#.*$/, ""),
    term,
  });
  return `${GISCUS_ORIGIN}/${lang}/widget?${params}`;
}

interface CommentsProps {
  /** The Discussion's title — `commentTermFor(slug)`. */
  term: string;
  className?: string;
}

export function Comments({ term, className }: CommentsProps) {
  const { locale, hydrated } = useLocale();
  const { theme } = useTheme();
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Nothing is fetched until the reader is nearly at the end of the post:
  // giscus spends an API call per load. (A frame that starts at zero height
  // cannot use `loading="lazy"` — browsers load a hidden frame eagerly.)
  const [near, setNear] = useState(false);
  // The widget's `src` is built once per thread and language; after that the
  // theme travels by message, so a theme change never reloads the thread.
  const [src, setSrc] = useState<string | null>(null);
  const [height, setHeight] = useState(0);
  const [reloads, setReloads] = useState(0);
  const session = useRef<string | null>(null);
  const live = useRef(false);
  const shownTheme = useRef<string | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const lang = GISCUS_LANG[locale];
  const enabled = commentsEnabled();

  // A session handed back by the sign-in redirect is taken at once, whether
  // or not the reader gets as far as the thread this visit.
  useEffect(() => {
    if (enabled) session.current ??= claimSession();
  }, [enabled]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!enabled || !section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px 1200px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    // The locale settles on hydration; a `src` built before it would load the
    // widget in one language and then again in the other.
    if (!enabled || !hydrated || !near) return;
    const themeUrl = giscusThemeUrl(themeRef.current);
    live.current = false;
    shownTheme.current = themeUrl;
    setHeight(0);
    setSrc(widgetSrc(term, lang, themeUrl, (session.current ??= claimSession())));
  }, [enabled, hydrated, near, term, lang, reloads]);

  // Tell a live widget about a theme it is not showing.
  const syncTheme = () => {
    const frame = frameRef.current?.contentWindow;
    const themeUrl = giscusThemeUrl(themeRef.current);
    if (!frame || !live.current || shownTheme.current === themeUrl) return;
    frame.postMessage({ giscus: { setConfig: { theme: themeUrl } } }, GISCUS_ORIGIN);
    shownTheme.current = themeUrl;
  };

  useEffect(syncTheme, [theme]);

  useEffect(() => {
    if (!src) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== GISCUS_ORIGIN) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = (event.data as { giscus?: GiscusMessage } | null)?.giscus;
      if (!data || typeof data !== "object") return;

      live.current = true;
      syncTheme();

      if (data.resizeHeight) setHeight(data.resizeHeight);
      const staleSession =
        !!data.error &&
        /Bad credentials|Invalid state value|State has expired/.test(data.error);
      // Signed out, or a stale or revoked session: load the thread signed out.
      // Only when there was a session — otherwise the reload would be the
      // same page, and the same error.
      if ((data.signOut || staleSession) && session.current) {
        forgetSession();
        session.current = "";
        setReloads((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src]);

  if (!enabled) return null;

  const ready = height > 0;

  return (
    <section
      id={ANCHOR}
      ref={sectionRef}
      aria-label={t(locale, "comments")}
      className={cn("relative", !ready && "min-h-16", className)}
    >
      {/* Only once the widget is on its way: before hydration the locale is
          the server's guess, and before the reader is near there is nothing
          loading to speak of. The section keeps a line's height regardless,
          for the observer to find. */}
      {src && !ready && (
        <p
          aria-live="polite"
          className={cn(TYPE.meta, "text-tertiary-foreground py-6")}
        >
          {t(locale, "commentsLoading")}
        </p>
      )}
      {src && (
        <iframe
          key={src}
          ref={frameRef}
          src={src}
          title={t(locale, "comments")}
          // giscus sizes its page to its content and reports the height; the
          // frame never scrolls on its own.
          scrolling="no"
          allow="clipboard-write"
          className={cn(
            "block w-full border-0 bg-transparent transition-opacity duration-300",
            ready ? "opacity-100" : "absolute inset-x-0 top-0 h-0 opacity-0",
          )}
          // A frame whose colour scheme differs from its page is painted on an
          // opaque canvas. Ours say the same thing, so the page shows through.
          style={{ height: ready ? height : undefined, colorScheme: theme }}
        />
      )}
    </section>
  );
}
