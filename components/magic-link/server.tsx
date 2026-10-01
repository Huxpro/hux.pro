import {
  postCardOf,
  postPeekOf,
  type PostPeekSource,
} from "@/lib/content";
import { locales, type Locale } from "@/lib/i18n";
import type { LinkMedia, LocaleUrls, MediaPreview } from "@/lib/log";
import { LOG } from "@/lib/log-client";
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/mdx";
import { cache } from "react";
import { SmartLink } from "@/components/mdx-components";
import { jekyllRedirects } from "@/lib/jekyll-redirects";
import { worksCardOf, worksReadingOf } from "@/lib/works-card";
import type { ComponentPropsWithoutRef } from "react";
import { MagicLink, type MagicLinkProps } from "./magic-link";

// =============================================================================
// Magic links, resolved on the server: what only the server can read.
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

// Read once per render, however many links name a post or /writing: the
// root layout renders both languages' copy on every page, and each read is
// every post parsed from disk.
const readPost = cache(getBlogPostBySlug);
const readAllPosts = cache(getAllBlogPosts);

/** `/writing/<slug>` or `/writing/<slug>/<lang>` → the slug. */
function postSlugOf(href: string | undefined): string | null {
  const m = href?.match(/^\/writing\/([^/?#]+)(?:\/(?:en|zh))?\/?$/);
  return m ? m[1] : null;
}

/** A post as a writing link carrying its peek. See InternalLinkMeta. */
function postMedia(slug: string): LinkMedia | null {
  const full = readPost(slug);
  if (!full) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, contentZh, ...post } = full;
  const languages: Locale[] =
    post.language === "both" ? [...locales] : [post.language as Locale];
  const urls: LocaleUrls = {};
  for (const l of languages) urls[l] = `/writing/${slug}/${l}`;
  const peek: Partial<Record<Locale, ReturnType<typeof postPeekOf>>> = {};
  const previews: Partial<Record<Locale, MediaPreview>> = {};
  for (const l of locales) {
    peek[l] = postPeekOf(post as PostPeekSource, l);
    // The post's card, as its page publishes it (a locale the post is not
    // written in reads the one it is). The peek is what a post's peek and
    // drawer show; the card is what a tile of it shows.
    const card = postCardOf(post, languages.includes(l) ? l : languages[0]);
    previews[l] = { title: card.title, description: card.description, image: card.image };
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
  if (path === "/writing") {
    const posts = readAllPosts();
    const since = posts.at(-1)?.date.slice(0, 4) ?? "";
    return {
      en: { title: "Writing", description: `${posts.length} posts, since ${since}.` },
      zh: { title: "文章", description: `${posts.length} 篇文章，始于 ${since} 年。` },
    };
  }
  if (path === "/works") return worksCardOf(worksReadingOf(query)).copy;
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
  // A reading of /works with a card of its own wears that card.
  const image =
    url.pathname === "/works"
      ? worksCardOf(worksReadingOf(url.searchParams)).image
      : `${url.pathname}/opengraph-image`;
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
/** What MDX may write: a MagicLink's props, and a post by its slug. */
type ServerMagicLinkProps = MagicLinkProps & { post?: string };

function resolveOnServer({ post, href, ...props }: ServerMagicLinkProps): MagicLinkProps {
  // One media item of a commit that is a post on this site is the post.
  if (props.commit && props.item !== undefined) {
    const item = LOG.commits.find((c) => c.id === props.commit)?.media?.[props.item];
    const slug =
      item?.kind === "link" ? (item.internal?.slug ?? postSlugOf(item.url)) : undefined;
    const media = slug ? postMedia(slug) : null;
    if (media) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { commit, item: _item, ...rest } = props;
      return { ...rest, media };
    }
  }
  const slug = post ?? postSlugOf(href);
  const media =
    (slug && postMedia(slug)) ||
    (href?.startsWith("/") ? sectionMedia(href) : null);
  // Nothing to resolve (a post not found): the link is still its address.
  return media
    ? { ...props, media }
    : { ...props, href: href ?? (post ? `/writing/${post}` : undefined) };
}

/** MDX `<MagicLink>`, on the server. */
export function ServerMagicLink(props: ServerMagicLinkProps) {
  return <MagicLink {...resolveOnServer(props)} />;
}

/** MDX `<Badge>`, on the server. */
export function ServerBadge(props: Omit<ServerMagicLinkProps, "badge">) {
  return <MagicLink {...resolveOnServer(props)} badge />;
}

// =============================================================================
// ServerProseLink: an ordinary link in prose, as a magic link when it can be.
//
// MDX's `a`, in a post, a doc and the About. A link needs no markup to peek
// when it points at something of this site's own; it then behaves as that
// thing does everywhere else.
//
//   /writing/<slug>          the post (its peek, its drawer)
//   a section (/works, …)    the section's card
//   a URL a commit attaches  that attachment, as its /works cover: a talk's
//                            recording, a deck, a page the log presents
//   anything else            a plain link (a way out, with its arrow)
//
// Someone else's page is not summoned from prose on its own card: a link
// out stays one press away from where it goes. <MagicLink href> still
// summons one where an author asks for it. An in-page anchor, a mail link
// and the like are plain links.
// =============================================================================

/** Every URL a commit attaches (a `urls` variant too) → the commit and item. */
let attached: Map<string, { commit: string; item: number }> | undefined;
function attachmentAt(url: string) {
  if (!attached) {
    attached = new Map();
    for (const commit of LOG.commits) {
      (commit.media ?? []).forEach((m, item) => {
        const urls = [m.url, ...Object.values((m as LinkMedia).urls ?? {})];
        for (const u of urls) if (u && !attached!.has(u)) attached!.set(u, { commit: commit.id, item });
      });
    }
  }
  return attached.get(url);
}

/** The hosts this site's posts have lived at. */
const OWN_HOSTS = new Set(["hux.pro", "www.hux.pro", "huangxuan.me", "huxpro.github.io"]);
const OLD_PERMALINKS = new Map(jekyllRedirects.map((r) => [r.source, r.destination]));

/**
 * A link to one of this site's posts written as a full URL, at its address
 * today or at an old blog's permalink (`huangxuan.me/2015/05/11/see-u-ali/`):
 * the post's path, or null.
 */
function ownPostPath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!OWN_HOSTS.has(url.hostname)) return null;
  const path = url.pathname.replace(/\/(index\.html)?$/, "");
  const post = OLD_PERMALINKS.get(path) ?? path;
  return postSlugOf(post) ? post : null;
}

export function ServerProseLink({ href, children, className, ...rest }: ComponentPropsWithoutRef<"a">) {
  const plain = () => (
    <SmartLink href={href} className={className} {...rest}>
      {children}
    </SmartLink>
  );
  if (!href) return plain();

  // One of this site's pages: a post (at any address it has had) or a
  // section.
  const own = /^https?:\/\//.test(href) ? ownPostPath(href) : href;
  if (own?.startsWith("/") && !own.startsWith("//")) {
    const slug = postSlugOf(own);
    const media = slug ? postMedia(slug) : sectionMedia(own);
    return media ? (
      <MagicLink media={media} className={className}>
        {children}
      </MagicLink>
    ) : (
      plain()
    );
  }
  if (!/^https?:\/\//.test(href)) return plain();

  // Something a commit attaches: the attachment, as its cover on /works.
  const at = attachmentAt(href);
  if (at) {
    return (
      <MagicLink {...resolveOnServer({ commit: at.commit, item: at.item })} className={className}>
        {children}
      </MagicLink>
    );
  }
  return plain();
}
