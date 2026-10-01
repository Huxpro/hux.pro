"use client";

// =============================================================================
// Attachments Lab — /lab/attachments
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

import { Field, Section, Segmented, Toggle, LabShell, useLabStrings } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { LinkCardFromMedia } from "@/components/log/media/link";
import {
  markFor,
  MediaMark,
  newTabMark,
  type MediaMarkSize,
  type MediaMarkSpec,
} from "@/components/log/media/media-mark";
import { Media } from "@/components/log/media/media";
import { MediaRenderer } from "@/components/log/media/media-renderer";
import { MediaStrip } from "@/components/log/media/media-strip";
import { AttachmentGrid } from "@/components/log/media/attachment-grid";
import { mediaPeek } from "@/components/log/media/media-peek";
import { SlidesFromMedia } from "@/components/log/media/slides";
import { VideoFromMedia } from "@/components/log/media/video";
import { ExternalImage } from "@/components/log/media/external-image";
import { cn } from "@/lib/utils";
import {
  getMediaStripItems,
  getMediaThumbnail,
  type ImageMedia,
  type LinkMedia,
  type Media as MediaData,
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
  ZoomIn,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { RENDER_PATHS } from "./paths";
import { ATTACHMENTS_STRINGS } from "./strings";

// -----------------------------------------------------------------------------
// Samples
// -----------------------------------------------------------------------------

/** One of each kind the log has; a kind the log lacks is simply absent. */
export interface LabSamples {
  video?: VideoMedia;
  youtube?: VideoMedia;
  bilibili?: VideoMedia;
  vimeo?: VideoMedia;
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
  twitter?: SocialEmbedMedia;
  instagram?: SocialEmbedMedia;
  tiktok?: SocialEmbedMedia;
}

const SAMPLE_ORDER: readonly (keyof LabSamples)[] = [
  "video",
  "youtube",
  "bilibili",
  "vimeo",
  "slides",
  "talkPage",
  "web",
  "denied",
  "post",
  "image",
  "social",
  "twitter",
  "instagram",
  "tiktok",
];

// Each kind's label is ATTACHMENTS_STRINGS.sample[key].

/** Kinds that open through the attachment set (not platform dupes). */
const SET_KEYS: readonly (keyof LabSamples)[] = [
  "video",
  "slides",
  "talkPage",
  "web",
  "denied",
  "post",
  "image",
  "social",
];

type VocabKey = keyof (typeof ATTACHMENTS_STRINGS)["en"]["vocab"];

/** The vocabulary, one tile each: the sample that shows it (its title and meaning are ATTACHMENTS_STRINGS.vocab[key]). */
const VOCABULARY: readonly VocabKey[] = [
  "video",
  "talkPage",
  "slides",
  "leaves",
  "web",
  "post",
  "image",
  "social",
];

// -----------------------------------------------------------------------------
// Homes
// -----------------------------------------------------------------------------

const HOME_ICON: Record<AttachmentHome, typeof Play> = {
  surface: PanelBottom,
  theater: Play,
  lightbox: ZoomIn,
  window: Globe,
  route: BookOpen,
  tab: ArrowUpRight,
};

// Each home's label is ATTACHMENTS_STRINGS.home[home].

function HomeChip({ home, compact }: { home: AttachmentHome; compact: boolean }) {
  const S = useLabStrings(ATTACHMENTS_STRINGS);
  const Icon = HOME_ICON[home];
  // A sheet on a phone, a panel or a window elsewhere; a window on a phone is a
  // sheet too. Say what the reader will see.
  const label =
    home === "surface" && !compact
      ? S.homeSurfaceWide
      : home === "window" && compact
        ? S.homeWindowCompact
        : S.home[home];
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

/** A stage section's heading — the family's label (see LabSection). */
function Label({ children }: { children: React.ReactNode }) {
  return <h2 className={cn("ink-bare mb-3", TYPE.label)}>{children}</h2>;
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
  const S = useLabStrings(ATTACHMENTS_STRINGS);
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
    () => SET_KEYS.map((key) => samples[key]).filter((m): m is MediaData => !!m),
    [samples],
  );
  const allKindItems = useMemo(
    () => SAMPLE_ORDER.map((key) => samples[key]).filter((m): m is MediaData => !!m),
    [samples],
  );
  const set: AttachmentSet = useMemo(
    () => ({
      id: "lab-attachments",
      title: S.setTitle,
      subtitle: "/lab/attachments",
      items,
    }),
    [items, S.setTitle],
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

  const panel = (
    <>
      <Section title={S.mark}>
        <Field label={S.tier} hint={tier === "peek" ? S.tierPeekHint : S.tierWorksHint}>
          <Segmented
            value={tier}
            onChange={setTier}
            options={[
              { value: "works", label: "/works" },
              { value: "peek", label: S.hoverPeek },
            ]}
          />
        </Field>
        <Field label={S.size}>
          <Segmented
            value={size}
            onChange={setSize}
            options={[
              { value: "compact", label: S.sizeCompact },
              { value: "default", label: S.sizeDefault },
            ]}
          />
        </Field>
        <Toggle value={withImage} onChange={setWithImage} label={S.onCovers} />
      </Section>
      <Section title={S.policyContext}>
        <Field label={S.viewport} hint={override.compact === undefined ? S.live : S.pinned}>
          <Segmented
            value={mounted && ctx.compact ? "phone" : "wide"}
            onChange={(v) => setOverride((o) => ({ ...o, compact: v === "phone" }))}
            options={[
              { value: "phone", label: S.phone },
              { value: "wide", label: S.smAndUp },
            ]}
          />
        </Field>
        <Toggle
          value={ctx.windows}
          onChange={(v) => setOverride((o) => ({ ...o, windows: v }))}
          label={S.windowManager}
        />
        <button
          type="button"
          disabled={!pinned}
          onClick={() => setOverride({})}
          className="self-start font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          {S.backToLive}
        </button>
        <Note>{S.contextNote}</Note>
      </Section>
    </>
  );

  const meta = (
    <>
      {mounted && S.metaLive(live.compact, !!theater?.theaterAvailable, live.windows)}
      {pinned && <span className="ml-2 text-amber-500/90">{S.policyPinned}</span>}
    </>
  );

  return (
    <LabShell lab="attachments" layout="workbench" meta={meta} panel={panel}>
      {/* Vocabulary ------------------------------------------------------ */}
      <section>
        <Label>{S.vocabularyLabel}</Label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {VOCABULARY.map((key) => (
            <div key={key}>
              <CoverTile image={imageFor(key)} mark={markOf(key)} size={size} raised={tier === "peek"} />
              <div className="mt-2 font-mono text-[11px] text-foreground">{S.vocab[key].title}</div>
              <div className="text-[11px] text-muted-foreground">{S.vocab[key].meaning}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Label>{S.stripLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {VOCABULARY.map((key) => (
              <CoverTile key={key} image={imageFor(key)} mark={markOf(key)} size="mini" raised={tier === "peek"} />
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Note>{S.vocabularyNote}</Note>
        </div>
      </section>

      {/* Paths ------------------------------------------------------------ */}
      <section>
        <Label>{S.pathsLabel}</Label>
        <div className="overflow-hidden rounded-xl border border-border/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">{S.colSurface}</th>
                <th className="px-3 py-2 font-normal">{S.colPrints}</th>
                <th className="px-3 py-2 font-normal">{S.colClick}</th>
                <th className="hidden px-3 py-2 font-normal md:table-cell">{S.colFile}</th>
              </tr>
            </thead>
            <tbody>
              {RENDER_PATHS.map((p) => (
                <tr key={p.id} className="border-t border-border/40 align-top">
                  <td className="px-3 py-2 font-mono text-[11px] text-foreground">{p.surface}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.context[locale]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.click[locale]}</td>
                  <td className="hidden px-3 py-2 font-mono text-[10px] text-tertiary-foreground md:table-cell">
                    {p.file}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Note>{S.pathsNote}</Note>
        </div>
      </section>

      {/* Homes ----------------------------------------------------------- */}
      <section>
        <Label>{S.homesLabel}</Label>
        <div className="overflow-hidden rounded-xl border border-border/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-normal">{S.colAttachment}</th>
                <th className="px-3 py-2 font-normal">{S.colMark}</th>
                <th className="px-3 py-2 font-normal">{S.colTap}</th>
                <th className="px-3 py-2 font-normal">{S.colButton}</th>
              </tr>
            </thead>
            <tbody>
              {SET_KEYS.map((key) => {
                const m = samples[key];
                if (!m) return null;
                return (
                  <tr key={key} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <div className="text-foreground">{S.sample[key]}</div>
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
          <Note>{S.homesNote}</Note>
        </div>
      </section>

      {/* Surfaces -------------------------------------------------------- */}
      <section className="space-y-8">
        <div>
          <Label>{S.surfStrip}</Label>
          {mounted && <MediaStrip items={stripItems} set={set} />}
        </div>
        <div>
          <Label>{S.surfGridDesk}</Label>
          {mounted && stripItems.length > 0 && (
            <div className="@container max-w-[632px] space-y-6">
              <AttachmentGrid items={stripItems.slice(0, 2)} set={set} compact={false} />
              <AttachmentGrid items={stripItems.slice(0, 1)} set={set} compact={false} />
            </div>
          )}
        </div>
        <div>
          <Label>{S.surfGridPhone}</Label>
          {mounted && stripItems.length > 0 && (
            <div className="max-w-[390px] overflow-hidden rounded-xl border border-border/50 bg-background p-4">
              <AttachmentGrid items={stripItems.slice(0, 3)} set={set} compact />
            </div>
          )}
        </div>
        <div>
          <Label>{S.surfRenderer}</Label>
          {mounted && allKindItems.length > 0 && (
            <div className="space-y-6">
              <MediaRenderer media={allKindItems.slice(0, 1)} layout="stack" />
              {allKindItems.length >= 2 && (
                <MediaRenderer media={allKindItems.slice(0, 3)} layout="stack" />
              )}
            </div>
          )}
        </div>
        <div>
          <Label>{S.surfPeeks}</Label>
          <div className="flex flex-wrap gap-6">
            {items.map((m) => {
              const spec = mediaPeek(m, locale, {
                leaves: mounted ? nativeHomeFor(m, ctx) === "tab" : false,
              });
              return spec ? (
                <div key={m.url} className="w-[22rem]">
                  {spec.node}
                </div>
              ) : null;
            })}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {samples.web && (
            <div>
              <Label>{S.surfCard}</Label>
              <LinkCardFromMedia media={samples.web} size="default" />
            </div>
          )}
          {samples.slides && (
            <div>
              <Label>{S.surfDeck}</Label>
              <SlidesFromMedia media={samples.slides} />
            </div>
          )}
        </div>
        {(samples.youtube || samples.bilibili || samples.vimeo) && (
          <div>
            <Label>{S.surfPlayers}</Label>
            <div className="grid gap-6 md:grid-cols-3">
              {[samples.youtube, samples.bilibili, samples.vimeo]
                .filter((m): m is VideoMedia => !!m)
                .map((m) => (
                  <div key={m.url}>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
                      {m.platform}
                    </div>
                    <VideoFromMedia media={m} size="compact" />
                  </div>
                ))}
            </div>
          </div>
        )}
        {(samples.video || samples.slides) && (
          <div>
            <Label>{S.surfRail}</Label>
            <div className="flex flex-wrap gap-3">
              {[samples.video, samples.slides]
                .filter((m): m is VideoMedia | SlidesMedia => !!m)
                .map((m) => {
                  const track = mediaToTrack(m, { id: `lab:${m.url}`, title: S.setTitle });
                  return track ? (
                    <TrackThumb key={track.id} track={track} className="w-40" />
                  ) : null;
                })}
            </div>
          </div>
        )}
        <div>
          <Label>{S.surfMdx}</Label>
          <div className="grid gap-6 md:grid-cols-2">
            {samples.web && <Media url={samples.web.url} as="link" present="card" />}
            {/* Prose keeps the inline pill; the log is card-only. */}
            <Media url="https://github.com/Huxpro" as="link" present="pill" title="GitHub" />
          </div>
        </div>
        {(samples.video || samples.slides) && (
          <div>
            <Label>{S.surfWidget}</Label>
            <div className="max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl">
              <div className="px-5 pt-4 text-sm font-medium text-foreground">{S.featuredTalks}</div>
              <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-3 no-scrollbar snap-x snap-mandatory">
                {[samples.video, samples.slides]
                  .filter((m): m is VideoMedia | SlidesMedia => !!m)
                  .map((m) => {
                    const track = mediaToTrack(m, {
                      id: `lab:widget:${m.url}`,
                      title: S.setTitle,
                    });
                    return track ? (
                      <TrackThumb
                        key={track.id}
                        track={track}
                        className="w-56 shrink-0 snap-start"
                      />
                    ) : null;
                  })}
              </div>
            </div>
          </div>
        )}
        <div>
          <Label>{S.surfPages}</Label>
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
        <Label>{S.tryLabel}</Label>
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
                {S.openSample(S.sample[key])}
                {mounted && <HomeChip home={attachments.homeOf(set, i)} compact={live.compact} />}
              </button>
            );
          })}
          {windows && samples.web && (
            <button
              type="button"
              onClick={() => windows.openUrl(samples.web!.url, { title: S.setTitle })}
              className="pressable inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted/30"
            >
              <Globe className="h-3 w-3 text-muted-foreground" />
              {S.openUrl}
            </button>
          )}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <Label>
              <Layers className="mr-1 inline h-3 w-3" />
              {S.stackLabel}
            </Label>
            <ol className="space-y-1 font-mono text-[11px]">
              {stack.length === 0 && <li className="text-tertiary-foreground">{S.nothingOpen}</li>}
              {stack.map((e, i) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="w-4 text-tertiary-foreground">{i}</span>
                  <span className="text-foreground">{e.id}</span>
                  {e.nestedIn && <span className="text-tertiary-foreground">{S.nestedIn(e.nestedIn)}</span>}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <Label>{S.windowsLabel}</Label>
            <ol className="space-y-1 font-mono text-[11px]">
              {!windows?.windows.length && <li className="text-tertiary-foreground">{S.none}</li>}
              {windows?.windows.map((w) => (
                <li key={w.id} className="flex items-center gap-2">
                  <span className="truncate text-foreground">{w.app.title}</span>
                  <span className="text-tertiary-foreground">
                    {w.app.runtime ?? "web"} · {w.mode}
                    {windows.focusedId === w.id && S.focused}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </LabShell>
  );
}
