"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import {
  PromptToolbar,
  type KindFacet,
  type TopicFacet,
} from "@/components/prompt/prompt-toolbar";
import {
  matchesView,
  parsePromptView,
  PROMPT_TOPICS,
  serializePromptView,
  toggleKind,
  toggleTopic,
  topicLabel,
  type PromptKind,
  type PromptTopic,
  type PromptViewState,
} from "@/lib/prompt-view";
import type {
  Attribution,
  Conviction,
  Influence,
  Instance,
  PromptsData,
} from "@/lib/prompts";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, useLocale } from "@/services";
import { AnimatePresence, motion } from "motion/react";
import { Presentation } from "lucide-react";
import { useOptionalTheater } from "@/systems/theater";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Every in-page reference — an attribution anchor, a back-link, an item's own
 * `#` mark — travels the same way: put the id in the URL so the link can be
 * shared, then glide there instead of teleporting. `scrollIntoView` follows
 * whichever element actually scrolls, so this keeps working inside the
 * bezel's scroll container as well as the window.
 */
function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}

function goToId(id: string) {
  if (!document.getElementById(id)) return;
  history.pushState(null, "", `#${id}`);
  scrollToId(id);
}

/**
 * How an in-page link travels, and what it points at.
 *
 * `goTo` defaults to the plain scroll above; the page installs one that
 * first lifts the filter when the target is currently filtered out — a
 * reference has to be allowed to win over a reading, or "shaped by: Steve
 * Jobs" is a dead link the moment you tap 行事.
 *
 * `anchorFor` turns a canonical id (what `ref` holds) into the anchor this
 * locale actually prints, since the Chinese page answers to 「#常变」 and the
 * English one to `#flux`.
 */
interface Navigation {
  goTo: (id: string) => void;
  anchorFor: (id: string) => string;
}

const GoToContext = createContext<Navigation>({
  goTo: goToId,
  anchorFor: (id) => id,
});

function useNav() {
  return useContext(GoToContext);
}

/** Click handler for an in-page anchor: keeps the href, drops the jump. */
function handleAnchorClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  id: string,
  goTo: (id: string) => void,
) {
  // Let modified clicks (new tab, etc.) behave natively.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  goTo(id);
}

// Animation variants for expandable content
const expandVariants = {
  initial: {
    height: 0,
    opacity: 0,
  },
  animate: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.2, delay: 0.05 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.1 },
    },
  },
};

// Stagger children animation
const contentVariants = {
  initial: { opacity: 0, y: -8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.1 },
  },
};

interface PromptViewProps {
  dataEn: PromptsData;
  dataZh: PromptsData;
}

// XML-style tag component
function XmlTag({
  children,
  attributes,
  closing = false,
  className,
}: {
  children: string;
  attributes?: Record<string, string>;
  closing?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs text-tertiary-foreground select-none transition-opacity duration-200",
        className,
      )}
    >
      {closing ? "</" : "<"}
      {children}
      {attributes &&
        Object.entries(attributes).map(([key, value]) => (
          <span key={key}>
            {" "}
            <span className="text-quaternary-foreground">{key}</span>=
            <span className="text-tertiary-foreground">
              &quot;{value}&quot;
            </span>
          </span>
        ))}
      {">"}
    </span>
  );
}

// Subtle divider
function Divider() {
  return (
    <div className="my-4 flex items-center">
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
    </div>
  );
}

const linkClass =
  "hover:text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground transition-colors";

/** External links, shared by convictions and influences. */
function LinkRow({
  links,
  className,
}: {
  links: { label: string; url: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {links.map((link, i) => (
        <motion.a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn("text-xs font-mono text-muted-foreground", linkClass)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 + i * 0.05, duration: 0.2 }}
        >
          {link.label}
        </motion.a>
      ))}
    </div>
  );
}

/**
 * An attribution renders as an anchor when it points at an entry in
 * `influences`, and as plain text when it doesn't — most of what shaped a
 * belief never gets an entry of its own.
 */
function AttributionText({ attribution }: { attribution: Attribution }) {
  const { goTo, anchorFor } = useNav();
  const name = attribution.ref ? (
    <a
      href={`#${anchorFor(attribution.ref)}`}
      onClick={(e) => handleAnchorClick(e, attribution.ref!, goTo)}
      className={cn("text-muted-foreground", linkClass)}
    >
      {attribution.name}
    </a>
  ) : (
    <span className="text-muted-foreground">{attribution.name}</span>
  );

  return (
    <>
      {name}
      {attribution.source && (
        <>
          <span className="text-tertiary-foreground"> · </span>
          {attribution.url ? (
            <a
              href={attribution.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn("text-tertiary-foreground", linkClass)}
            >
              {attribution.source}
            </a>
          ) : (
            <span className="text-tertiary-foreground">
              {attribution.source}
            </span>
          )}
        </>
      )}
    </>
  );
}

/**
 * Markdown-lite body: "- " lines are a list, anything else is a paragraph,
 * and a body can be both.
 *
 * That shape is the point of this page rather than a convenience. A belief
 * arrives in a dozen phrasings — one for a talk, one for a 3am note, one for
 * an argument — and filing each as its own entry would make the page a pile
 * instead of a system. So each entry keeps the shortest form of the thing as
 * its statement, the reasoning as the paragraph, and every other way it has
 * been said as a line underneath: same belief, different instances.
 */
function Body({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  // Group consecutive lines so a list stays one <ul> rather than several.
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const list = line.startsWith("- ");
    const last = blocks[blocks.length - 1];
    if (last && last.list === list) last.lines.push(line);
    else blocks.push({ list, lines: [line] });
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, b) =>
        block.list ? (
          <ul key={b} className="space-y-1">
            {block.lines.map((line, i) => (
              <motion.li
                key={i}
                className="text-sm text-muted-foreground flex items-start gap-2"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <span className="text-quaternary-foreground">·</span>
                <span>{line.slice(2)}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div key={b} className="space-y-2">
            {block.lines.map((line, i) => (
              <p
                key={i}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {line}
              </p>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

/**
 * The faces of a belief, revealed on expand.
 *
 * Each line is the same conviction showing up somewhere specific, so it is
 * set quieter than the reasoning above it and can carry two kinds of
 * pointer: whose words or example it is (`from`), and which other entry on
 * this page it is also filed under (`ref`). The second is what lets a big
 * belief own its small ones without deleting them — the page groups by
 * linking, not by swallowing.
 */
function Instances({
  instances,
  labelOf,
}: {
  instances: Instance[];
  labelOf: (id: string) => string | undefined;
}) {
  const { goTo, anchorFor } = useNav();
  return (
    <ul className="space-y-1.5">
      {instances.map((instance, i) => {
        const label = instance.ref ? labelOf(instance.ref) : undefined;
        // When the instance IS the other entry's sentence, the arrow alone
        // carries the link — printing the label would say it twice.
        const echo =
          label !== undefined &&
          instance.text.includes(label.replace(/…$/, "").trim());
        return (
          <motion.li
            key={i}
            className="text-sm text-muted-foreground flex items-start gap-2"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          >
            <span className="text-quaternary-foreground">·</span>
            <span>
              {/* The name this face goes by, when it has one — a quote's own
                  words, a discipline, a chapter of a career. */}
              {instance.title && (
                <span className="text-foreground">
                  {instance.title}
                  <span className="text-quaternary-foreground">{" — "}</span>
                </span>
              )}
              {instance.text}
              {instance.from && (
                <span className="text-tertiary-foreground">
                  {" — "}
                  <AttributionText attribution={instance.from} />
                </span>
              )}
              {instance.ref && label && (
                <>
                  {" "}
                  <a
                    href={`#${anchorFor(instance.ref)}`}
                    onClick={(e) => handleAnchorClick(e, instance.ref!, goTo)}
                    className={cn(
                      "font-mono text-xs text-tertiary-foreground",
                      linkClass,
                    )}
                  >
                    {echo ? "↗" : `↗ ${label}`}
                  </a>
                </>
              )}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/**
 * What an entry's id is worth printing for: it is this belief's outline word
 * — the one word it would be filed under — and it is also the anchor. So the
 * two are the same control at two sizes. At rest the row prints `#flux`,
 * quietly, which is the only line of chrome this page shows by default; on
 * hover it gives way to the full tag, where the same click lives on the `id`
 * value itself.
 */
function useCopyLink(id: string) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      goToId(id);
      // `location.href` percent-encodes a Chinese anchor into 27 characters
      // of noise; what goes on the clipboard should be the link as it reads.
      navigator.clipboard?.writeText(decodeURI(window.location.href)).then(
        () => setCopied(true),
        () => {}, // clipboard denied — the URL is updated either way
      );
    },
    [id],
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  return { copied, copyLink };
}

/**
 * The row above an entry, and the only chrome this page keeps on screen at
 * rest.
 *
 * Folded, it is a watermark: `#变异` at the quaternary rung — the entry's
 * outline word and its anchor, which are the same string. Open (hovered,
 * focused, or expanded) the rest of the tag grows around that same word:
 * the `#` becomes `<conviction id="`, and `on=…` arrives behind it.
 *
 * The word is never redrawn, only moved, which is the whole point of doing
 * it this way. The first version cross-faded two complete strings in one
 * position, so for the length of the fade the row printed `#变异` on top of
 * `<conviction id="变异"` — two legible things at once, which reads as a
 * bug rather than as a transition.
 */
function EntryTag({
  tag,
  attributes,
  anchor,
  open,
  copied,
  onIdClick,
}: {
  tag: string;
  attributes?: Record<string, string>;
  anchor: string;
  open: boolean;
  copied: boolean;
  onIdClick: (e: React.MouseEvent) => void;
}) {
  // `id` is rendered by hand below — it is the one attribute that is also a
  // control, and the one that survives into the folded state.
  const rest = Object.entries(attributes ?? {}).filter(([key]) => key !== "id");

  return (
    <span className="flex items-baseline font-mono text-xs select-none whitespace-pre">
      {open ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={TAG_FADE}
          className="text-tertiary-foreground"
        >
          {`<${tag} `}
          <span className="text-quaternary-foreground">id</span>=&quot;
        </motion.span>
      ) : (
        <span className="text-quaternary-foreground">#</span>
      )}

      {/* The word itself: the same element in both states, so it is never
          drawn twice — the whole reason this is not a crossfade. */}
      <button
        type="button"
        onClick={onIdClick}
        aria-label={`Link to ${anchor}`}
        className={cn(
          "underline-offset-2 decoration-muted-foreground/40",
          "transition-colors duration-200 hover:text-foreground hover:underline",
          copied
            ? "text-muted-foreground"
            : open
              ? "text-tertiary-foreground"
              : "text-quaternary-foreground",
        )}
      >
        {anchor}
        {copied && " ✓"}
      </button>

      {open && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={TAG_FADE}
          className="text-tertiary-foreground"
        >
          &quot;
          {rest.map(([key, value]) => (
            <span key={key}>
              {" "}
              <span className="text-quaternary-foreground">{key}</span>
              {`="${value}"`}
            </span>
          ))}
          {">"}
        </motion.span>
      )}
    </span>
  );
}

// A fast fade in, and nothing on the way out. Two earlier passes animated
// the word's position as the tag grew around it — first snappy and staged,
// then slow and soft — and both drew the eye to a row whose whole job is to
// be ignorable until it is wanted. Sliding a word 100px is a big gesture
// however gently it is timed. So the word lands where it belongs, the text
// around it fades in, and on the way out it is simply gone: nobody watches
// chrome leave, and an exit animation is one more thing that can stay
// mounted after it is done.
const TAG_FADE = { duration: 0.12, ease: "easeOut" as const };

/** Shared shell: the hover-revealed open/close tags around expandable content. */
function PromptItem({
  tag,
  attributes,
  anchorId,
  expandable,
  children,
  detail,
}: {
  tag: string;
  attributes?: Record<string, string>;
  anchorId: string;
  expandable: boolean;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Pointer and keyboard both open the tag, so it is state rather than
  // `group-hover`: the morph below needs to know, and a tab stop should get
  // the same row a mouse does.
  const [active, setActive] = useState(false);
  // Clicking the anchor focuses it, and a focused button used to hold the
  // row open until something else took the focus away. Only keyboard focus
  // should open it, which is what `:focus-visible` means.
  const [focused, setFocused] = useState(false);
  const open = active || focused || isExpanded;
  const { copied, copyLink } = useCopyLink(anchorId);

  // `mouseenter`/`mouseleave` only fire when the pointer moves, so anything
  // that moves the page under a still pointer — collapsing this entry,
  // scrolling — leaves the row open on an entry the pointer is no longer
  // on, until the next click. `:hover` is the browser's own answer to the
  // same question and it survives layout, so re-ask it whenever the layout
  // is what changed.
  const ref = useRef<HTMLDivElement>(null);
  const syncHover = useCallback(
    () => setActive(ref.current?.matches(":hover") ?? false),
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(syncHover);
    return () => cancelAnimationFrame(frame);
  }, [isExpanded, syncHover]);

  useEffect(() => {
    // Only the entry the pointer is actually on pays for this.
    if (!active) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncHover);
    };
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [active, syncHover]);

  return (
    <div
      id={anchorId}
      ref={ref}
      className={cn(
        "prompt-item group py-3 cursor-pointer transition-colors duration-200",
        "hover:bg-foreground/[0.02] -mx-4 px-4 rounded-lg scroll-mt-24",
      )}
      {...(isExpanded ? { "data-expanded": "" } : {})}
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <div className="flex items-center gap-2">
        <EntryTag
          tag={tag}
          attributes={attributes}
          anchor={anchorId}
          open={open}
          copied={copied}
          onIdClick={copyLink}
        />
        {expandable && (
          <motion.span
            className={cn(
              "text-quaternary-foreground text-xs select-none opacity-0 transition-opacity duration-200",
              open && "opacity-100",
            )}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            ›
          </motion.span>
        )}
      </div>

      <div className="mt-2 mb-2">
        {children}

        <AnimatePresence>
          {isExpanded && expandable && (
            <motion.div
              variants={expandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-hidden"
            >
              <motion.div variants={contentVariants}>
                <Divider />
                {detail}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <XmlTag closing className={cn("opacity-0", open && "opacity-100")}>
        {tag}
      </XmlTag>
    </div>
  );
}

/**
 * A conviction. `quotedFrom` decides the typography: borrowed words are set
 * as a quote with their attribution on the surface; my own words are set as
 * a statement. Provenance is the only thing that varies — the belief is
 * mine either way, so both are `<conviction>`.
 */
function ConvictionItem({
  conviction,
  topics,
  shapedByLabel,
  labelOf,
}: {
  conviction: Conviction;
  /** The topics' names in the reader's language. */
  topics: string[];
  shapedByLabel: string;
  /** Short label for an id an instance points at. */
  labelOf: (id: string) => string | undefined;
}) {
  const quoted = conviction.quotedFrom;
  // `id` first, the way it would be in the markup this row is imitating.
  // The id is the entry's outline word — the one word this belief would be
  // filed under — which is why it is worth showing rather than hiding: in
  // 修身 and 行事 that word is already the statement (成为, 演示), and in
  // 天行 the statements are sentences the culture handed me, so the id is
  // the only place my own name for them appears. It is also the hash, so
  // the row doubles as "what you get when you click the #".
  // `on` is space-separated, the way a `class` attribute holds several.
  const attributes: Record<string, string> = {
    id: conviction.anchor,
    on: topics.join(" "),
  };
  if (quoted) attributes.from = quoted.name;

  return (
    <PromptItem
      tag="conviction"
      attributes={attributes}
      anchorId={conviction.anchor}
      expandable={Boolean(
        conviction.body ||
        conviction.shapedBy ||
        conviction.links ||
        conviction.instances?.length,
      )}
      detail={
        <>
          {conviction.shapedBy && conviction.shapedBy.length > 0 && (
            <p className="text-xs font-mono text-tertiary-foreground mb-3">
              {shapedByLabel}:{" "}
              {conviction.shapedBy.map((attribution, i) => (
                <span key={attribution.name}>
                  {i > 0 && ", "}
                  <AttributionText attribution={attribution} />
                </span>
              ))}
            </p>
          )}
          {conviction.body && <Body text={conviction.body} />}
          {conviction.instances && conviction.instances.length > 0 && (
            <div className={cn(conviction.body && "mt-3")}>
              <Instances instances={conviction.instances} labelOf={labelOf} />
            </div>
          )}
          {conviction.links && conviction.links.length > 0 && (
            <LinkRow
              links={conviction.links}
              className={cn(
                (conviction.shapedBy ||
                  conviction.body ||
                  conviction.instances?.length) &&
                  "mt-4",
              )}
            />
          )}
        </>
      }
    >
      {quoted ? (
        <>
          <blockquote className="font-serif text-xl sm:text-2xl text-foreground leading-relaxed italic">
            &ldquo;{conviction.statement}&rdquo;
          </blockquote>
          <p className="mt-3 text-sm">
            <AttributionText attribution={quoted} />
          </p>
        </>
      ) : (
        <p className="font-serif text-xl sm:text-2xl text-foreground leading-relaxed">
          {conviction.statement}
        </p>
      )}

      {/* My own way of saying it — the aside voice /works uses for a note in
          the margin, so a proverb and the line I actually say can share a
          row without competing. */}
      {conviction.commentary && (
        <p className={cn(TYPE.aside, "mt-2")}>
          &ldquo;{conviction.commentary}&rdquo;
        </p>
      )}
    </PromptItem>
  );
}

/**
 * A deck this entry is carrying. Tapping it opens the Theater stage — the
 * same library the log's decks live in, so this one lands beside them and
 * can be sent to PiP and read while you keep scrolling.
 */
function SlidesPill({
  media,
  entryId,
  entryName,
  label,
}: {
  media: NonNullable<Influence["media"]>;
  entryId: string;
  entryName: string;
  label: string;
}) {
  const theater = useOptionalTheater();
  if (!theater) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        theater.openMedia(
          { kind: "slides", url: media.url, thumbnail: media.thumbnail },
          {
            id: `prompt-${entryId}`,
            title: media.title ?? entryName,
            subtitle: entryName,
          },
        );
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-1",
        "font-mono text-xs text-muted-foreground transition-colors duration-200",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <Presentation className="h-3 w-3" />
      {media.title ?? label}
    </button>
  );
}

/** A person, team, book or paper that trained the convictions above. */
function InfluenceItem({
  influence,
  shapedLabel,
  slidesLabel,
  convictions,
}: {
  influence: Influence;
  shapedLabel: string;
  slidesLabel: string;
  convictions: Conviction[];
}) {
  const { goTo, anchorFor } = useNav();
  // Back-links are computed, never authored — the same relation read from
  // the other end.
  const shaped = convictions.filter(
    (c) =>
      c.quotedFrom?.ref === influence.id ||
      c.shapedBy?.some((s) => s.ref === influence.id),
  );

  // `id` then `kind`. An influence sits on no shelf (`lib/prompts`), and the
  // row below — what they shaped — is the truer answer to what they are "on".
  const attributes: Record<string, string> = {
    id: influence.anchor,
    kind: influence.kind,
  };

  return (
    <PromptItem
      tag="influence"
      attributes={attributes}
      anchorId={influence.anchor}
      expandable={Boolean(influence.body || influence.links || shaped.length)}
      detail={
        <>
          {influence.body && <Body text={influence.body} />}
          {shaped.length > 0 && (
            <p
              className={cn(
                "text-xs font-mono text-tertiary-foreground",
                influence.body && "mt-4",
              )}
            >
              {shapedLabel}:{" "}
              {shaped.map((conviction, i) => (
                // Statements end in a period, so a comma would read as ".,"
                <span key={conviction.id}>
                  {i > 0 && " · "}
                  <a
                    href={`#${anchorFor(conviction.id)}`}
                    onClick={(e) => handleAnchorClick(e, conviction.id, goTo)}
                    className={cn("text-muted-foreground", linkClass)}
                  >
                    {conviction.statement}
                  </a>
                </span>
              ))}
            </p>
          )}
          {influence.media && (
            <div className={cn((influence.body || shaped.length) && "mt-4")}>
              <SlidesPill
                media={influence.media}
                entryId={influence.id}
                entryName={influence.name}
                label={slidesLabel}
              />
            </div>
          )}
          {influence.links && influence.links.length > 0 && (
            <LinkRow
              links={influence.links}
              className={cn(
                (influence.body || shaped.length || influence.media) && "mt-4",
              )}
            />
          )}
        </>
      }
    >
      <p className="font-serif text-xl sm:text-2xl text-foreground">
        {influence.name}
      </p>
      {influence.context && (
        <p className="mt-1 text-sm text-muted-foreground">
          {influence.context}
        </p>
      )}
    </PromptItem>
  );
}

// Footer meta component
interface FooterLabels {
  tokens: string;
  lastUpdated: string;
  model: string;
}

function PromptFooter({
  meta,
  labels,
}: {
  meta: PromptsData["meta"];
  labels: FooterLabels;
}) {
  return (
    <div className="mt-20 py-4 px-4 rounded-lg border border-dashed border-muted-foreground/20">
      <div className="font-mono text-xs text-tertiary-foreground space-y-1">
        <div>
          {labels.tokens}:{" "}
          <span className="text-tertiary-foreground">{meta.tokenCount}</span>
        </div>
        <div>
          {labels.lastUpdated}:{" "}
          <span className="text-tertiary-foreground">{meta.lastUpdated}</span>
        </div>
        <div>
          {labels.model}:{" "}
          <span className="text-tertiary-foreground">{meta.model}</span>
        </div>
      </div>
    </div>
  );
}

export function PromptView({ dataEn, dataZh }: PromptViewProps) {
  const { locale } = useLocale();
  const data = locale === "zh" ? dataZh : dataEn;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Canonical id → the anchor this locale prints. Every `ref` in the data is
  // canonical, so all in-page links pass through here on their way out.
  const anchorOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of [...data.convictions, ...data.influences])
      map.set(e.id, e.anchor);
    return map;
  }, [data]);

  // …and every anchor this page prints in *either* language, back to the
  // canonical id. A link shared off the Chinese page has to land when it is
  // opened in English, so an incoming hash is read as an alias first.
  const canonicalOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const set of [dataEn, dataZh])
      for (const e of [...set.convictions, ...set.influences]) {
        map.set(e.id, e.id);
        map.set(e.anchor, e.id);
      }
    return map;
  }, [dataEn, dataZh]);

  const anchorFor = useCallback(
    (raw: string) => {
      const canonical = canonicalOf.get(raw) ?? raw;
      return anchorOf.get(canonical) ?? canonical;
    },
    [canonicalOf, anchorOf],
  );

  // A reading of this page ("just the convictions, just on open source") is a
  // link someone can send, and the back button undoes a filter — same
  // contract as /works, same codec shape (lib/prompt-view).
  const urlView = useMemo(
    () => parsePromptView(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const urlKey = serializePromptView(urlView);

  // …but local state is what paints, because `router.replace` re-runs the
  // route and a chip you tap three times in a row must not wait for that.
  const [view, setView] = useState(urlView);
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey);
    if (urlKey !== serializePromptView(view)) setView(urlView);
  }

  const commit = useCallback(
    (next: Partial<PromptViewState>, hash?: string) => {
      const merged = { ...view, ...next };
      setView(merged);
      const query = serializePromptView(
        merged,
        new URLSearchParams(searchParams.toString()),
      );
      // One write, hash included: a jump that lifts the filter changes both
      // halves of the URL, and doing it in two calls leaves whichever lands
      // second holding a stale copy of the other.
      const mark = hash ? `#${hash}` : "";
      // `replace`, not `push`: finding a reading should not cost a tap of
      // the back button per chip.
      router.replace(
        query ? `${pathname}?${query}${mark}` : `${pathname}${mark}`,
        { scroll: false },
      );
    },
    [view, searchParams, router, pathname],
  );

  // A shared link lands mid-page before the wallpaper and fonts settle, so
  // re-seat the target once after mount rather than trusting the browser's
  // initial jump.
  useEffect(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const id = anchorFor(decodeURIComponent(raw));
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (!element) return;
      // Arrived under the other language's name: say so in the address bar
      // rather than leaving a link that only half works.
      if (id !== decodeURIComponent(raw))
        history.replaceState(null, "", `#${id}`);
      element.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
    // Once, on mount — a later locale switch must not yank the page around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Counts are of the UNFILTERED page, so a chip's number never moves as you
  // select: it answers "how much of this is there?", which is the question a
  // chip is asked, not "how much survived?", which the entries answer.
  const kindFacets = useMemo<KindFacet[]>(
    () =>
      (
        [
          ["conviction", data.convictions.length],
          ["influence", data.influences.length],
        ] as const
      )
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => ({ kind: kind as PromptKind, count })),
    [data],
  );

  const topicFacets = useMemo<TopicFacet[]>(() => {
    // Convictions only — the influences carry no topic. A belief on two
    // shelves is counted on both: the chip answers "how much is filed
    // here?", and both answers are true.
    const counts = new Map<PromptTopic, number>();
    for (const entry of data.convictions) {
      for (const topic of entry.topics) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
    }
    return PROMPT_TOPICS.filter((topic) => counts.has(topic)).map((topic) => ({
      topic,
      count: counts.get(topic)!,
    }));
  }, [data]);

  const convictions = data.convictions.filter((c) =>
    matchesView(view, { kind: "conviction", topics: c.topics }),
  );
  // With no topics of their own, the influences answer to the kind chips and
  // step aside whenever a shelf is picked.
  const influences = data.influences.filter(() =>
    matchesView(view, { kind: "influence" }),
  );
  const hasMatches = convictions.length > 0 || influences.length > 0;

  // A reference outranks a reading: following one into something the filter
  // is currently hiding clears the filter and then goes there, rather than
  // silently doing nothing. Two renders — the entry has to exist before it
  // can be scrolled to — so the id waits in state for one pass.
  const pendingId = useRef<string | null>(null);

  const goTo = useCallback(
    (raw: string) => {
      const id = anchorFor(raw);
      if (document.getElementById(id)) {
        goToId(id);
        return;
      }
      pendingId.current = id;
      commit({ kinds: [], topics: [] }, id);
    },
    [commit, anchorFor],
  );

  const nav = useMemo<Navigation>(
    () => ({ goTo, anchorFor }),
    [goTo, anchorFor],
  );

  useEffect(() => {
    const id = pendingId.current;
    if (!id) return;
    pendingId.current = null;
    // The URL was written by `commit` — this only travels.
    scrollToId(id);
  }, [view]);

  // What an instance's pointer is called, from either collection.
  const labelOf = useCallback(
    (id: string) => {
      const label =
        data.convictions.find((c) => c.id === id)?.statement ??
        data.influences.find((i) => i.id === id)?.name;
      // A pointer is a signpost, not a second copy of the sentence.
      return label && label.length > 36
        ? `${label.slice(0, 34).trimEnd()}…`
        : label;
    },
    [data],
  );

  const shapedByLabel = t(locale, "promptShapedBy");
  const shapedLabel = t(locale, "promptShaped");
  const slidesLabel = t(locale, "logSlides");
  const footerLabels: FooterLabels = {
    tokens: t(locale, "promptTokens"),
    lastUpdated: t(locale, "promptLastUpdated"),
    model: t(locale, "promptModel"),
  };

  return (
    <GoToContext.Provider value={nav}>
      <PageLayout
        page="prompts"
        pinnedActions={
          <PromptToolbar
            locale={locale}
            kindFacets={kindFacets}
            topicFacets={topicFacets}
            activeKinds={view.kinds}
            activeTopics={view.topics}
            onToggleKind={(kind) =>
              commit({ kinds: toggleKind(view.kinds, kind) })
            }
            onToggleTopic={(topic) =>
              commit({ topics: toggleTopic(view.topics, topic) })
            }
            onClear={() => commit({ kinds: [], topics: [] })}
          />
        }
      >
        <div className="relative -mt-4">
          <div className="pb-4 space-y-2">
            {/* What I hold */}
            {convictions.map((conviction) => (
              <ConvictionItem
                key={conviction.id}
                conviction={conviction}
                topics={conviction.topics.map((t) => topicLabel(t, locale))}
                shapedByLabel={shapedByLabel}
                labelOf={labelOf}
              />
            ))}

            {/* Who trained it */}
            {influences.map((influence) => (
              <InfluenceItem
                key={influence.id}
                influence={influence}
                shapedLabel={shapedLabel}
                slidesLabel={slidesLabel}
                convictions={data.convictions}
              />
            ))}
          </div>

          {/* A filter that matched nothing says so in the page's own voice,
            rather than leaving it to end in silence. */}
          {!hasMatches && (
            <p className="py-4 font-mono text-xs text-tertiary-foreground">
              {t(locale, "promptNoMatches")}
            </p>
          )}

          <XmlTag closing>system</XmlTag>
        </div>

        <PromptFooter meta={data.meta} labels={footerLabels} />
      </PageLayout>
    </GoToContext.Provider>
  );
}
