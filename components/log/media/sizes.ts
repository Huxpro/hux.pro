/**
 * One width scale for every content media card — link card, image, video,
 * and social embed. The `compact | default | large` vocabulary used to map to
 * a *different* width in each family (link/image: sm/lg/2xl; video:
 * md/full/4xl; tweet: 325/400/500), so a "default" card's width depended on
 * its kind. These are the single source of truth now: a `default` card is the
 * same width whether it's a link, an image, a video, or a tweet.
 */
export const MEDIA_MAX_W = {
  compact: "max-w-sm", // 24rem · 384px
  default: "max-w-lg", // 32rem · 512px
  large: "max-w-2xl", //  42rem · 672px
} as const;

export type MediaSize = keyof typeof MEDIA_MAX_W;
