import { toBlogPostSummaries } from "@/lib/content";
import { getLogData } from "@/lib/log-server";
import { getAllBlogPosts } from "@/lib/mdx";
import { enrichLogDataWithPreviews } from "@/lib/og-snapshot";
import { HomeView } from "./home-view";

export default function Home() {
  // The writing widget reads real frontmatter (title / language / date /
  // featured) at build time — same source as /writing — rather than the
  // hand-maintained mirror in lib/data.ts, so the two can't drift apart.
  const posts = toBlogPostSummaries(getAllBlogPosts());
  // Bake OG previews into the log on the server (same path /works uses) so
  // the home grid does not ship log.json + og-snapshot.json in the client
  // module graph.
  const log = enrichLogDataWithPreviews(getLogData());
  return <HomeView posts={posts} log={log} />;
}
