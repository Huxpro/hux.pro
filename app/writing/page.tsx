import { getAllBlogPosts } from "@/lib/mdx";
import { BlogPostList } from "./blog-list";
import { Suspense } from "react";

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <Suspense>
      <BlogPostList posts={posts} />
    </Suspense>
  );
}
