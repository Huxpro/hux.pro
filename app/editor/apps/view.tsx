"use client";

// =============================================================================
// Apps Lab — /editor/apps
//
// The devtool for the built-in apps system: the question "what happens when
// I press this?", answered for every kind of thing a commit attaches, on every
// viewport, with the site's own surfaces doing the answering.
//
// Four things on the stage, none of them mocks:
//
//   vocabulary   the mark each kind of cover wears (media-mark.tsx), at each
//                size and tone, on the log's own covers.
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
  MEDIA_KINDS,
  MediaMark,
  mediaKindOf,
  type MediaKind,
  type MediaMarkSize,
  type MediaMarkTone,
} from "@/components/log/media/media-mark";
import { MediaStrip } from "@/components/log/media/media-strip";
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
  "web",
  "denied",
  "post",
  "image",
  "social",
];

const SAMPLE_LABEL: Record<keyof LabSamples, string> = {
  video: "video",
  slides: "slides",
  web: "page",
  denied: "page · refuses framing",
  post: "post",
  image: "image",
  social: "social widget",
};

/** What each mark means, in a line. */
const KIND_MEANING: Record<MediaKind, string> = {
  video: "plays, on the stage",
  slides: "presents, on the stage",
  web: "a page — the card is the hint",
  post: "a page of this site",
  image: "what you see is the thing",
  social: "a live widget",
};

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

/** A cover to wear a mark on: the sample's own image, or a plain ground. */
function CoverTile({
  image,
  kind,
  size,
  tone,
  className,
}: {
  image: string | null;
  kind: MediaKind;
  size: MediaMarkSize;
  tone: MediaMarkTone;
  className?: string;
}) {
  return (
    <div
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
      <MediaMark kind={kind} size={size} tone={tone} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// The lab
// -----------------------------------------------------------------------------

export function AppsLabView({ samples }: { samples: LabSamples }) {
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
  const [size, setSize] = useState<MediaMarkSize>("default");
  const [tone, setTone] = useState<MediaMarkTone>("dark");
  const [withImage, setWithImage] = useState(true);

  // The policy's context: starts live, and can be taken anywhere.
  const live: HomeContext = useMemo(
    () => ({
      compact: liveCompact,
      theaterAvailable: theater?.theaterAvailable ?? false,
      windows: !!windows,
      locale,
    }),
    [liveCompact, theater?.theaterAvailable, windows, locale],
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
      id: "editor-apps",
      title: "Apps Lab",
      subtitle: "/editor/apps",
      items,
    }),
    [items],
  );
  const stripItems = useMemo(() => getMediaStripItems(items, locale), [items, locale]);
  const imageFor = (kind: MediaKind): string | null => {
    const key = (
      { video: "video", slides: "slides", web: "web", post: "post", image: "image", social: "social" } as const
    )[kind];
    const m = samples[key];
    return withImage && m ? getMediaThumbnail(m) : null;
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
            <h1 className="mt-1 font-serif text-2xl tracking-tight text-foreground">Apps Lab</h1>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {mounted && (
              <>
                {live.compact ? "phone" : "sm+"} · theater {live.theaterAvailable ? "on" : "off"} · windows{" "}
                {live.windows ? "on" : "off"}
              </>
            )}
            {pinned && <span className="ml-2 text-amber-500/90">· policy pinned</span>}
          </div>
        </header>

        {/* Vocabulary ------------------------------------------------------ */}
        <section>
          <Label>Vocabulary — what a cover says before it is pressed</Label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {MEDIA_KINDS.map((kind) => (
              <div key={kind}>
                <CoverTile image={imageFor(kind)} kind={kind} size={size === "mini" ? "default" : size} tone={tone} />
                <div className="mt-2 font-mono text-[11px] text-foreground">{kind}</div>
                <div className="text-[11px] text-muted-foreground">{KIND_MEANING[kind]}</div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Label>The contact strip: 56px covers, and the chip keeps its glyph</Label>
            <div className="flex flex-wrap gap-2">
              {MEDIA_KINDS.map((kind) => (
                <CoverTile key={kind} image={imageFor(kind)} kind={kind} size="mini" tone={tone} />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Note>
              One vocabulary, drawn by one component. A video wears the play disc, centred; a deck wears the
              `Slides` chip at the bottom left and no disc, because a deck is not watched. A page wears nothing:
              its card — domain, title — is the hint, and its button says `Visit`. The mark never says where
              the thing opens; the policy below does.
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
                  const kind = mediaKindOf(m);
                  return (
                    <tr key={key} className="border-t border-border/40">
                      <td className="px-3 py-2">
                        <div className="text-foreground">{SAMPLE_LABEL[key]}</div>
                        <div className="max-w-[28ch] truncate font-mono text-[10px] text-tertiary-foreground">{m.url}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {kind === "video" ? "play disc" : kind === "slides" ? "Slides chip" : "—"}
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
              the button sends the item on: a video to the theater (a PiP there), a page to the in-app browser —
              a window is a sheet on a phone, and it stacks on the attachment sheet — and only a page that refuses
              to be framed leaves for a tab, which the page says in a line before the button is pressed.
            </Note>
          </div>
        </section>

        {/* Surfaces -------------------------------------------------------- */}
        <section className="space-y-8">
          <div>
            <Label>The contact strip — MediaStrip</Label>
            {/* The strip and the pages read the policy, which reads the
                viewport; they render once the client has one. */}
            {mounted && <MediaStrip items={stripItems} set={set} />}
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
                    const track = mediaToTrack(m, { id: `lab:${m.url}`, title: "Apps Lab" });
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
                onClick={() => windows.openUrl(samples.web!.url, { title: "Apps Lab" })}
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
          <Field label="Size">
            <Segmented
              value={size}
              onChange={setSize}
              options={[
                { value: "mini", label: "mini" },
                { value: "compact", label: "compact" },
                { value: "default", label: "default" },
              ]}
            />
          </Field>
          <Field label="Tone" hint={tone === "glass" ? "the stage's" : "the log's"}>
            <Segmented
              value={tone}
              onChange={setTone}
              options={[
                { value: "dark", label: "dark" },
                { value: "glass", label: "glass" },
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
            value={mounted && ctx.theaterAvailable}
            onChange={(v) => setOverride((o) => ({ ...o, theaterAvailable: v }))}
            label="A theater can put up its stage"
          />
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
