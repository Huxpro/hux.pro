import { toBlogPostSummaries } from "@/lib/content";
import { getAllBlogPosts } from "@/lib/mdx";
import { LegibilityLabView } from "./view";

export const metadata = {
  title: "Legibility Lab | Hux.Pro",
  description:
    "Every wallpaper, both materials, all the typography — with every knob a slider.",
  robots: { index: false, follow: false },
};

export default function LegibilityLabPage() {
  // The real writing widget, fed the way the home screen feeds it.
  const posts = toBlogPostSummaries(getAllBlogPosts());
  return <LegibilityLabView posts={posts} />;
}
