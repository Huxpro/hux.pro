// =============================================================================
// Apple text styles — the widget skin's type roles.
//
// iOS's default ("Large") Dynamic Type sizes, as the HIG tabulates them
// (Typography › Specifications), for the sizes a widget uses. Size, leading
// and weight only: SF's tracking is one rule in globals.css for the whole
// board, fitted to the HIG's table, so a role never carries its own.
//
// Apple skin only — Classic keeps `TYPE` (lib/typography.ts). A widget uses
// these behind `skin-apple:` or inside markup that only the Apple skin draws.
// =============================================================================

export const APPLE = {
  /** Title 3 — 20pt, the largest line a widget sets in running text. */
  title3: "text-[20px] leading-6 font-semibold",
  /** Headline — 17pt semibold: the one large line on a card. */
  headline: "text-[17px] leading-[22px] font-semibold",
  /** Subheadline — 15pt: a list row's title. */
  subheadline: "text-[15px] leading-5",
  /** Subheadline, emphasised — a widget's own title, a row that leads. */
  subheadlineEmph: "text-[15px] leading-5 font-semibold",
  /** Footnote — 13pt: metadata beside or under a title. */
  footnote: "text-[13px] leading-[18px]",
  /** Footnote, emphasised — a condition, a state. */
  footnoteEmph: "text-[13px] leading-[18px] font-semibold",
  /** Caption 1 — 12pt: the name under an icon or a widget. */
  caption1: "text-[12px] leading-4",
  /** Caption 2 — 11pt: the smallest a widget may set (HIG: "11 points or larger"). */
  caption2: "text-[11px] leading-[13px]",
} as const;

export type AppleTextRole = keyof typeof APPLE;
