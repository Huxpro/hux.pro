"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { LanguageFilter, PostList } from "@/components/post";
import { formatPostDate, type BlogPost } from "@/lib/content";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

interface BlogPostListProps {
  posts: BlogPost[];
}

export function BlogPostList({ posts }: BlogPostListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const includeOther = searchParams.get("lang") === "all";

  const setIncludeOther = useCallback(
    (value: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("lang", "all");
      } else {
        params.delete("lang");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname]
  );

  return (
    <PageLayout
      page="writing"
      headerActions={
        <LanguageFilter
          includeOther={includeOther}
          setIncludeOther={setIncludeOther}
        />
      }
    >
      <PostList
        posts={posts}
        basePath="/writing"
        includeOther={includeOther}
        renderMeta={(post) => <time>{formatPostDate(post.date)}</time>}
      />
    </PageLayout>
  );
}
