import { toBlogPostSummaries } from "@/lib/content";
import { getAllBlogPosts } from "@/lib/mdx";
import { HomeView } from "./home-view";

export default function Home() {
  // The writing widget reads real frontmatter (title / language / date /
  // featured) at build time — same source as /writing — rather than the
  // hand-maintained mirror in lib/data.ts, so the two can't drift apart.
  const posts = toBlogPostSummaries(getAllBlogPosts());
  return <HomeView posts={posts} />;
}
