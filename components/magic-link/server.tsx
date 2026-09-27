import {
  getLocalizedTitle,
  postPeekOf,
  type PostPeekSource,
} from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { LinkMedia, LocaleUrls, MediaPreview } from "@/lib/log";
import { LOG } from "@/lib/log-client";
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/mdx";
import { MagicLink, type MagicLinkProps } from "./magic-link";

// =============================================================================
// Magic links, resolved on the server — what only the server can read.
//
// A post's peek is made of its body (the excerpt, the cover), which lives on
// disk; a section of this site is summarised by counting what is in it. So an
// MDX map rendered on the server (the About's copy, a post, a doc) uses these
// in place of the client component: they read what the link names and hand
// it over as `media`, and from there it is an ordinary MagicLink.
//
//   <MagicLink post="dreamer">dream</MagicLink>
//   <MagicLink href="/writing/dreamer/en">dream</MagicLink>   (the same)
//   <MagicLink href="/works?type=talk">talks</MagicLink>      (a section)
//
// Not exported from the index: it reads the file system, and the index is
// imported by client code.
// =============================================================================

const LOCALES: Locale[] = ["en", "zh"];

/** `/writing/<slug>` or `/writing/<slug>/<lang>` → the slug. */
function postSlugOf(href: string | undefined): string | null {
  const m = href?.match(/^\/writing\/([^/?#]+)(?:\/(?:en|zh))?\/?$/);
  return m ? m[1] : null;
}

/** A post as a writing link carrying its peek — see InternalLinkMeta. */
function postMedia(slug: string): LinkMedia | null {
  const full = getBlogPostBySlug(slug);
  if (!full) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, contentZh, ...post } = full;
  const languages: Locale[] =
    post.language === "both" ? LOCALES : [post.language as Locale];
  const urls: LocaleUrls = {};
  for (const l of languages) urls[l] = `/writing/${slug}/${l}`;
  const peek: Partial<Record<Locale, ReturnType<typeof postPeekOf>>> = {};
  const previews: Partial<Record<Locale, MediaPreview>> = {};
  for (const l of LOCALES) {
    const p = postPeekOf(post as PostPeekSource, l);
    peek[l] = p;
    previews[l] = {
      title: getLocalizedTitle(post, l),
      description: p.description,
      image: p.cover,
    };
  }
  return {
    kind: "link",
    url: urls[languages[0]]!,
    urls,
    present: "card",
    previews,
    internal: { kind: "writing", slug, urls, peek },
  };
}

type SectionCopy = Record<Locale, { title: string; description: string }>;

/**
 * The site's own sections, as cards: their name, what is in them, and the
 * image the section shows when it is shared (its `opengraph-image` route).
 * Counted, not written down, so a card never goes stale.
 */
function sectionCopy(path: string, query: URLSearchParams): SectionCopy | null {
  const count = (type: string) => LOG.commits.filter((c) => c.type === type).length;
  if (path === "/writing") {
    const posts = getAllBlogPosts();
    const since = posts.at(-1)?.date.slice(0, 4) ?? "";
    return {
      en: { title: "Writing", description: `${posts.length} posts, since ${since}.` },
      zh: { title: "文章", description: `${posts.length} 篇文章，始于 ${since} 年。` },
    };
  }
  if (path === "/works") {
    const type = query.get("type");
    if (type === "talk") {
      return {
        en: { title: "Talks", description: `${count("talk")} talks I've given — recordings and decks, in the commit log.` },
        zh: { title: "演讲", description: `${count("talk")} 场演讲——录像与幻灯片，收在提交记录里。` },
      };
    }
    if (type === "project") {
      return {
        en: { title: "Projects", description: `${count("project")} projects I've built, in the commit log.` },
        zh: { title: "项目", description: `${count("project")} 个做过的项目，收在提交记录里。` },
      };
    }
    return {
      en: { title: "Works", description: "Commit history — professional work as git log." },
      zh: { title: "作品", description: "提交记录——把职业生涯写成 git log。" },
    };
  }
  if (path === "/prompt") {
    return {
      en: { title: "System Prompts", description: "Quotes, principles, people, and books that shape my thinking." },
      zh: { title: "系统提示词", description: "塑造我思考方式的句子、原则、人与书。" },
    };
  }
  return null;
}

function sectionMedia(href: string): LinkMedia | null {
  const url = new URL(href, "https://hux.pro");
  const copy = sectionCopy(url.pathname, url.searchParams);
  if (!copy) return null;
  const image = `${url.pathname}/opengraph-image`;
  return {
    kind: "link",
    url: href,
    present: "card",
    previews: {
      en: { ...copy.en, image },
      zh: { ...copy.zh, image },
    },
  };
}

/** The props a server-rendered MagicLink hands the client one. */
function resolveOnServer({ post, href, ...props }: MagicLinkProps): MagicLinkProps {
  const slug = post ?? postSlugOf(href);
  const media =
    (slug && postMedia(slug)) ||
    (href?.startsWith("/") ? sectionMedia(href) : null);
  return media ? { ...props, media } : { ...props, post, href };
}

/** MDX `<MagicLink>`, on the server. */
export function ServerMagicLink(props: MagicLinkProps) {
  return <MagicLink {...resolveOnServer(props)} />;
}

/** MDX `<Badge>`, on the server. */
export function ServerBadge(props: Omit<MagicLinkProps, "badge">) {
  return <MagicLink {...resolveOnServer(props)} badge />;
}
