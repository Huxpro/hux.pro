import { getAllBlogPosts } from "@/lib/mdx";
import { BlogPostList } from "./blog-list";

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return <BlogPostList posts={posts} />;
}
