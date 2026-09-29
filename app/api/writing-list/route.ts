import { getAllBlogPosts } from "@/lib/mdx";

// The /writing list, as JSON, for the home screen's app overlay
// (components/home/app-overlay.tsx) to fetch on the press that opens it.
// Static — built once, served as a file — so it is no server route; and
// fetched on demand, so the home page's own payload carries none of it.
// Frontmatter is left out: it only feeds the devtool's inspector.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    getAllBlogPosts().map((post) => {
      const { frontmatter, frontmatterZh, ...row } = post as typeof post & {
        frontmatter?: unknown;
        frontmatterZh?: unknown;
      };
      void frontmatter;
      void frontmatterZh;
      return row;
    }),
  );
}
