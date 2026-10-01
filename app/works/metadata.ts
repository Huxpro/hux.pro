import type { Metadata } from "next";
import { worksCardOf } from "@/lib/works-card";
import type { WorksReading } from "@/lib/works-readings";

/**
 * What a crawler reads off /works or one of its readings: the card's title
 * and words, at the address people send. The image is the `opengraph-image`
 * route beside the page, which Next adds by itself. Set whole, because a
 * page's `openGraph` replaces the layout's rather than merging with it.
 */
export function worksMetadata(reading: WorksReading | null): Metadata {
  const card = worksCardOf(reading);
  const { title, description } = card.copy.en;
  return {
    title,
    description,
    alternates: { canonical: card.url },
    openGraph: {
      type: "website",
      siteName: "Hux.Pro",
      locale: "en_US",
      url: card.url,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
