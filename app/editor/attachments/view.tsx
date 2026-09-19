"use client";

// =============================================================================
// Attachments Lab — /editor/attachments
//
// The devtool for the attachments system: the question "what happens when I
// press this?", answered for every kind of thing a commit attaches, on every
// viewport, with the site's own surfaces doing the answering.
//
// Four things on the stage, none of them mocks:
//
//   vocabulary   the chips a cover can wear (media-mark.tsx), at each size,
//                on the log's own covers — the platform on a recording (and
//                on a recording that lives on a page, the one case where a
//                play chip opens the in-app browser), `Slides` on a deck,
//                `New tab` on a page whose press leaves the site; and, in
//                the peek's tier, a chip on every kind.
//   homes        the policy (systems/attachments/lib/policy.ts) as a table —
//                where a tap lands and where the surface's button sends it —
//                for a context you set: phone or not, a theater, a window
//                manager. It reads the real functions, so the table cannot
//                drift from the site.
//   surfaces     the same media rendered by the production components: the
//                contact strip's cover, the link card, the deck cover, the
//                theater's rail thumb, the attachment sheet's page.
//   try it       buttons that go through the real providers. On a phone the
//                attachment sheet comes up; `Visit` stacks the in-app browser
//                over it; the stack readout shows the sheets as they stand.
// =============================================================================

import { Field, Section, Segmented, Toggle } from "@/app/editor/icon/controls";
import { LinkCardFromMedia } from "@/components/log/media/link";
import {
  markFor,
  MediaMark,
  newTabMark,
  type MediaMarkSize,
  type MediaMarkSpec,
} from "@/components/log/media/media-mark";
import { MediaStrip } from "@/components/log/media/media-strip";
import { AttachmentGrid } from "@/components/log/media/attachment-grid";
import { SlidesFromMedia } from "@/components/log/media/slides";
import { ExternalImage } from "@/components/log/media/external-image";
import { cn } from "@/lib/utils";
import {
  getMediaStripItems,
  getMediaThumbnail,
  type ImageMedia,
  type LinkMedia,
  type Media,
  type SlidesMedia,
  type SocialEmbedMedia,
  type VideoMedia,
} from "@/lib/log";
import { useLocale } from "@/services";
import {
  homeFor,
  nativeHomeFor,
  useAttachments,
  type AttachmentHome,
  type AttachmentSet,
  type HomeContext,
} from "@/systems/attachments";
import { AttachmentPage } from "@/systems/attachments/components/attachment-page";
import { useBreakpointValue, useSurfaceStackEntries } from "@/systems/surface";
import { mediaToTrack, TrackThumb, useOptionalTheater } from "@/systems/theater";
import { useOptionalWindows } from "@/systems/windows";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  Layers,
  PanelBottom,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

// -----------------------------------------------------------------------------
// Samples
// -----------------------------------------------------------------------------

/** One of each kind the log has; a kind the log lacks is simply absent. */
export interface LabSamples {
  video?: VideoMedia;
  slides?: SlidesMedia;
  /**
   * A recording that lives on a page — a GitNation talk. The special case:
   * it is a recording (the play chip, the host's name) that opens in the
   * in-app browser rather than on the stage.
   */
  talkPage?: LinkMedia;
  /** An external page that can be framed: the in-app browser's case. */
  web?: LinkMedia;
  /** A page that refuses to be framed: the one case that leaves for a tab. */
  denied?: LinkMedia;
  /** A link to one of this site's own posts. */
  post?: LinkMedia;
  image?: ImageMedia;
  social?: SocialEmbedMedia;
}

const SAMPLE_ORDER: readonly (keyof LabSamples)[] = [
  "video",
  "slides",
  "talkPage",
  "web",
  "denied",
  "post",
  "image",
  "social",
];

const SAMPLE_LABEL: Record<keyof LabSamples, string> = {
  video: "video",
  slides: "slides",
  talkPage: "recording on a page",
  web: "page",
  denied: "page · refuses framing",
  post: "post",
  image: "image",
  social: "social widget",
};

/** The vocabulary, one tile each: the sample that shows it, and what it says. */
const VOCABULARY: readonly { key: keyof LabSamples | "leaves"; title: string; meaning: string }[] = [
  { key: "video", title: "recording", meaning: "the platform it is on; it plays on the stage" },
  { key: "talkPage", title: "recording on a page", meaning: "the same play chip, the host's name — and it opens in the in-app browser, not on the stage. GitNation is the case." },
  { key: "slides", title: "deck", meaning: "Slides; it presents on the stage" },
  { key: "leaves", title: "leaves", meaning: "a page that refuses framing: the press opens a tab, whatever the kind" },
  { key: "web", title: "page", meaning: "Web in the peek; nothing on /works, where the card prints its domain and title" },
  { key: "post", title: "post", meaning: "Writing in the peek; nothing on /works" },
  { key: "image", title: "image", meaning: "Image in the peek; nothing on /works" },
  { key: "social", title: "social widget", meaning: "its platform in the peek; nothing on /works" },
];

// -----------------------------------------------------------------------------
// Homes
// -----------------------------------------------------------------------------

const HOME_ICON: Record<AttachmentHome, typeof Play> = {
  surface: PanelBottom,
  theater: Play,
  window: Globe,
  route: BookOpen,
  tab: ArrowUpRight,
};

const HOME_LABEL: Record<AttachmentHome, string> = {
  surface: "sheet",
  theater: "theater",
  window: "window",
  route: "route",
  tab: "tab",
};

function HomeChip({ home, compact }: { home: AttachmentHome; compact: boolean }) {
  const Icon = HOME_ICON[home];
  // A sheet on a phone, a panel or a window elsewhere; a window on a phone is a
  // sheet too. Say what the reader will see.
  const label =
    home === "surface" && !compact
      ? "surface"
      : home === "window" && compact
        ? "window · sheet"
        : HOME_LABEL[home];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 font-mono text-[11px] text-foreground">
      <Icon className={cn("h-3 w-3", home === "tab" ? "text-amber-500/90" : "text-muted-foreground")} />
      {label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Small parts
// -----------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

/** A cover to wear a chip on: the sample's own image, or a plain ground. */
function CoverTile({
  image,
  mark,
  size,
  raised,
  className,
}: {
  image: string | null;
  mark: MediaMarkSpec | null;
  size: MediaMarkSize;
  /** The peek's tier: the chip at full weight from the start. */
  raised?: boolean;
  className?: string;
}) {
  return (
    <div
      data-cover
      className={cn(
        "relative overflow-hidden rounded-md border border-border/50 bg-muted/30",
        size === "mini" ? "h-14 aspect-video" : "aspect-video w-full",
        className,
      )}
    >
      {image ? (
        <ExternalImage src={image} alt="" className="block h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/10" />
      )}
      <MediaMark mark={mark} size={size} raised={raised} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// The lab
// -----------------------------------------------------------------------------

export function AttachmentsLabView({ samples }: { samples: LabSamples }) {
  const { locale } = useLocale();
  const attachments = useAttachments();
  const theater = useOptionalTheater();
  const windows = useOptionalWindows();
  const stack = useSurfaceStackEntries();
  const liveCompact = useBreakpointValue({ base: true, sm: false });
  // The live context is the viewport's, which the server does not have: the
  // readouts that print it wait for the client so the first paint matches.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // The vocabulary's knobs.
  const [size, setSize] = useState<Exclude<MediaMarkSize, "mini">>("default");
  const [tier, setTier] = useState<"works" | "peek">("works");
  const [withImage, setWithImage] = useState(true);

  // The policy's context: starts live, and can be taken anywhere.
  const live: HomeContext = useMemo(
    () => ({ compact: liveCompact, windows: !!windows }),
    [liveCompact, windows],
  );
  const [override, setOverride] = useState<Partial<HomeContext>>({});
  const ctx: HomeContext = { ...live, ...override };
  const pinned = Object.keys(override).length > 0;

  const items = useMemo(
    () => SAMPLE_ORDER.map((key) => samples[key]).filter((m): m is Media => !!m),
    [samples],
  );
  const set: AttachmentSet = useMemo(
    () => ({
      id: "editor-attachments",
      title: "Attachments Lab",
      subtitle: "/editor/attachments",
      items,
    }),
    [items],
  );
  const stripItems = useMemo(() => getMediaStripItems(items, locale), [items, locale]);
  const imageFor = (key: keyof LabSamples | "leaves"): string | null => {
    const m = samples[key === "leaves" ? "denied" : key] ?? samples.web;
    return withImage && m ? getMediaThumbnail(m) : null;
  };
  /** The chip a tile's cover wears in the chosen tier, read off the log's own sample. */
  const markOf = (key: keyof LabSamples | "leaves"): MediaMarkSpec | null => {
    if (key === "leaves") return newTabMark(locale);
    const m = samples[key];
    return m ? markFor(m, locale, { all: tier === "peek" }) : null;
  };

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 pb-40 pt-8 lg:flex-row lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Stage                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="min-w-0 flex-1 space-y-10">
        <header className="ink-bare flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <Link href="/" className="font-mono text-xs tracking-wide text-muted-foreground hover:text-foreground">
              λhux
            </Link>
            <h1 className="mt-1 font-serif text-2xl tracking-tight text-foreground">Attachments Lab</h1>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {mounted && (
              <>
                {live.compact ? "phone" : "sm+"} · stage {theater?.theaterAvailable ? "theater" : "pip"} ·
                windows {live.windows ? "on" : "off"}
              </>
            )}
            {pinned && <span className="ml-2 text-amber-500/90">· policy pinned</span>}
          </div>
        </header>

        {/* Vocabulary ------------------------------------------------------ */}
        <section>
          <Label>Vocabulary — what a cover says before it is pressed</Label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {VOCABULARY.map((v) => (
              <div key={v.key}>
                <CoverTile image={imageFor(v.key)} mark={markOf(v.key)} size={size} raised={tier === "peek"} />
                <div className="mt-2 font-mono text-[11px] text-foreground">{v.title}</div>
                <div className="text-[11px] text-muted-foreground">{v.meaning}</div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Label>The contact strip: 56px covers, and the chip keeps its glyph</Label>
            <div className="flex flex-wrap gap-2">
              {VOCABULARY.map((v) => (
                <CoverTile key={v.key} image={imageFor(v.key)} mark={markOf(v.key)} size="mini" raised={tier === "peek"} />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Note>
              One chip, drawn by one component, the same chip a wallpaper tile wears for Live / Preset. Who
              wears one is the surface&rsquo;s call, in three tiers. On `/works`, the strip and the expanded
              body: a recording (its platform, so a talk says where it was recorded), a deck (`Slides`) and a
              page whose press leaves the site (`New tab`) — a card is its own hint. In the hover peek: every
              kind, because a peek is a glance and the chip is its caption — and there the chip is raised from the
              start, where a cover in the page wears it light until hovered. On the attachment sheet&rsquo;s
              page, the home widgets&rsquo; covers and the theater&rsquo;s rail: none, because each already
              says what the thing is beside the cover. The chip says
              what the thing is; the policy below says where it opens — which is how a GitNation recording
              wears a play chip and opens in the in-app browser.
            </Note>
          </div>
        </section>

        {/* Homes ----------------------------------------------------------- */}
        <section>
          <Label>Homes — where a tap lands, and where the sheet&rsquo;s button sends it</Label>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">attachment</th>
                  <th className="px-3 py-2 font-normal">mark</th>
                  <th className="px-3 py-2 font-normal">tap</th>
                  <th className="px-3 py-2 font-normal">button</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ORDER.map((key) => {
                  const m = samples[key];
                  if (!m) return null;
                  return (
                    <tr key={key} className="border-t border-border/40">
                      <td className="px-3 py-2">
                        <div className="text-foreground">{SAMPLE_LABEL[key]}</div>
                        <div className="max-w-[28ch] truncate font-mono text-[10px] text-tertiary-foreground">{m.url}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {markFor(m, locale, { leaves: nativeHomeFor(m, ctx) === "tab" })?.label ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {mounted && <HomeChip home={homeFor(m, ctx)} compact={ctx.compact} />}
                      </td>
                      <td className="px-3 py-2">
                        {mounted && <HomeChip home={nativeHomeFor(m, ctx)} compact={ctx.compact} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Note>
              Read live from `homeFor` and `nativeHomeFor`. On a phone every tap opens the attachment sheet and
              the button sends the item on: a recording or a deck to the stage (a PiP there), a page to the
              in-app browser — a window is a sheet on a phone, and it stacks on the attachment sheet — and only
              a page that refuses to be framed leaves for a tab, which its chip says before the button is pressed.
            </Note>
          </div>
        </section>

        {/* Surfaces -------------------------------------------------------- */}
        <section className="space-y-8">
          <div>
            <Label>The contact strip — MediaStrip, `brief` and `covers`</Label>
            {/* The strip and the pages read the policy, which reads the
                viewport; they render once the client has one. */}
            {mounted && (
              <div className="space-y-4">
                <MediaStrip items={stripItems} set={set} size="thumbs" />
                <MediaStrip items={stripItems} set={set} size="covers" />
              </div>
            )}
          </div>
          <div>
            <Label>The attachment object in the `feed` — AttachmentGrid</Label>
            {/* Half-column tiles whatever the count on a desk: a pair with
                captions under each, then a lone one. On a phone, the stack.
                The column is /works' (632px), so the tiles are the row's
                size. */}
            {mounted && stripItems.length > 0 && (
              <div className="@container max-w-[632px] space-y-6">
                <AttachmentGrid items={stripItems.slice(0, 2)} set={set} />
                <AttachmentGrid items={stripItems.slice(0, 1)} set={set} />
              </div>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {samples.web && (
              <div>
                <Label>The card — LinkCard</Label>
                <LinkCardFromMedia media={samples.web} size="default" />
              </div>
            )}
            {samples.slides && (
              <div>
                <Label>The deck cover — Slides</Label>
                <SlidesFromMedia media={samples.slides} />
              </div>
            )}
          </div>
          {(samples.video || samples.slides) && (
            <div>
              <Label>The theater&rsquo;s rail — TrackThumb</Label>
              <div className="flex flex-wrap gap-3">
                {[samples.video, samples.slides]
                  .filter((m): m is VideoMedia | SlidesMedia => !!m)
                  .map((m) => {
                    const track = mediaToTrack(m, { id: `lab:${m.url}`, title: "Attachments Lab" });
                    return track ? (
                      <TrackThumb key={track.id} track={track} className="w-40" />
                    ) : null;
                  })}
              </div>
            </div>
          )}
          <div>
            <Label>The attachment sheet&rsquo;s pages — AttachmentPage</Label>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {mounted &&
                items.map((m, i) => (
                  <div
                    key={`${m.url}-${i}`}
                    className="rounded-2xl border border-border/50 bg-glass-sheet p-4 shadow-overlay backdrop-blur-xl"
                  >
                    <AttachmentPage set={set} index={i} />
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* Try it ---------------------------------------------------------- */}
        <section>
          <Label>Try it — through the real providers</Label>
          <div className="flex flex-wrap gap-2">
            {items.map((m, i) => {
              const key = SAMPLE_ORDER.find((k) => samples[k] === m) ?? "web";
              return (
                <button
                  key={`${m.url}-${i}`}
                  type="button"
                  onClick={() => attachments.open(set, i)}
                  className="pressable inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted/30"
                >
                  open {SAMPLE_LABEL[key]}
                  {mounted && <HomeChip home={attachments.homeOf(set, i)} compact={live.compact} />}
                </button>
              );
            })}
            {windows && samples.web && (
              <button
                type="button"
                onClick={() => windows.openUrl(samples.web!.url, { title: "Attachments Lab" })}
                className="pressable inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted/30"
              >
                <Globe className="h-3 w-3 text-muted-foreground" />
                openUrl — the in-app browser
              </button>
            )}
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <Label>
                <Layers className="mr-1 inline h-3 w-3" />
                Surface stack — bottom first
              </Label>
              <ol className="space-y-1 font-mono text-[11px]">
                {stack.length === 0 && <li className="text-tertiary-foreground">— nothing open —</li>}
                {stack.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="w-4 text-tertiary-foreground">{i}</span>
                    <span className="text-foreground">{e.id}</span>
                    {e.nestedIn && <span className="text-tertiary-foreground">nested in {e.nestedIn}</span>}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Label>Windows</Label>
              <ol className="space-y-1 font-mono text-[11px]">
                {!windows?.windows.length && <li className="text-tertiary-foreground">— none —</li>}
                {windows?.windows.map((w) => (
                  <li key={w.id} className="flex items-center gap-2">
                    <span className="truncate text-foreground">{w.app.title}</span>
                    <span className="text-tertiary-foreground">
                      {w.app.runtime ?? "web"} · {w.mode}
                      {windows.focusedId === w.id && " · focused"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Panel                                                                */}
      {/* ------------------------------------------------------------------ */}
      <aside className="ink-flat w-full shrink-0 self-start rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:w-[340px] lg:overflow-y-auto">
        <Section title="Mark">
          <Field label="Tier" hint={tier === "peek" ? "every kind · raised" : "recording · deck · leaves · at rest"}>
            <Segmented
              value={tier}
              onChange={setTier}
              options={[
                { value: "works", label: "/works" },
                { value: "peek", label: "hover peek" },
              ]}
            />
          </Field>
          <Field label="Size">
            <Segmented
              value={size}
              onChange={setSize}
              options={[
                { value: "compact", label: "compact" },
                { value: "default", label: "default" },
              ]}
            />
          </Field>
          <Toggle value={withImage} onChange={setWithImage} label="On the log's covers" />
        </Section>
        <Section title="Policy context">
          <Field label="Viewport" hint={override.compact === undefined ? "live" : "pinned"}>
            <Segmented
              value={mounted && ctx.compact ? "phone" : "wide"}
              onChange={(v) => setOverride((o) => ({ ...o, compact: v === "phone" }))}
              options={[
                { value: "phone", label: "phone" },
                { value: "wide", label: "sm and up" },
              ]}
            />
          </Field>
          <Toggle
            value={ctx.windows}
            onChange={(v) => setOverride((o) => ({ ...o, windows: v }))}
            label="A window manager is mounted"
          />
          <button
            type="button"
            disabled={!pinned}
            onClick={() => setOverride({})}
            className="self-start font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            back to live
          </button>
          <Note>
            The table reads the policy for this context; the buttons on the stage always use the live one.
          </Note>
        </Section>
      </aside>
    </main>
  );
}
