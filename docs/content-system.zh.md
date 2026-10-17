---
origin: "AI-translated from the original"
---

# 内容系统

`content/blog/` 里的一篇文章和 `docs/` 里的一页文档，怎样变成 `/writing` 和 `/docs` 下的静态页面：文件名、语言、frontmatter、MDX 管线，以及构建时还有谁在读这些文件。

## 做好了是什么样

- 一篇文章每种语言一个文件，语言写在文件名里：`dreamer.en.mdx` + `dreamer.zh.mdx` 是一篇双语文章，单独一个 `miui6.zh.mdx` 就是一篇中文文章。没有哪个 frontmatter 字段来说明这一点。
- 每种语言各是一个静态页面，`/writing/<slug>/<lang>`，两种语言都有时带上 `hreflang` 互指。裸的 `/writing/<slug>` 会被重定向到某一种语言。
- 一篇文档是 `docs/<slug>.md`，英文；中文版是旁边的 `docs/<slug>.zh.md`。标题是它的第一个 `#` 标题，列表里的描述是标题之后的第一段正文。
- 有对应 skill 的文档在 frontmatter 里写明：页面末尾附上指向该 skill 的链接，`/docs` 列表里这一行标上 `skill`。
- 正文按 MDX 编译，文档和文章一样。图片放在 `public/` 下，用绝对路径引用，所以在 `/docs/<slug>/en` 和文章里都能加载。
- CI（`pnpm og:complete`、`pnpm badges:check`）能通过，而且不用谁去记为什么：文章牵动的快照已经随文章一起刷新了。

## 原理

![内容管线。content/blog/ 和 docs/ 里的文件由 lib/mdx.ts 读取（slug、由存在哪些文件决定的语言、frontmatter、派生出的摘要、封面和阅读时长）。路由页面为每种语言生成一个静态页面，取出该语言的正文，交给 MDXRenderer；MDXRenderer 就是带着 lib/mdx-processor.ts 的 mdxOptions 和 mdxComponents 的 MDXRemote。下方是构建时的读取者：og:fonts 和 badge 扫描直接读文件；ask:index、og:sizes / og:snapshot 和 opengraph-image 路由经过 lib/mdx.ts。](/img/docs/content-system/pipeline.svg)

上面一行是一次页面请求，在构建时完成。下面一行是其他所有读同一批文件的东西：每个都是一条命令（或一个路由），有自己的产物，左边那几个绕过 `lib/mdx.ts`。

1. **文件。** 文章：`content/blog/<slug>.<lang>.mdx`，或者文件夹形式 `content/blog/<slug>/index.<lang>.mdx`（只有 `upgrading-eleme-to-pwa` 这么用）。`<lang>` 是 `en` 或 `zh`。文档：`docs/<slug>.md`（英文）、`docs/<slug>.zh.md`（中文）；`.en.md`、`.en.mdx` 和 `.zh.mdx` 也会被读取。
2. **`lib/mdx.ts`** 负责列出和读取它们。`getBlogSlugs()` 匹配 `/^(.+)\.(en|zh)\.mdx$/` 以及含有 index 文件的文件夹；`getBlogPostBySlug()` 用 `gray-matter` 读取两个语言的文件，返回 `BlogPostWithContent`：`language`（`"en" | "zh" | "both"`，由存在哪些文件决定）、合并后的 frontmatter、`content` / `contentZh`，以及每种语言派生出的 `excerpt`、`cover` 和 `readingTime`。`getBlogLangManifest()` 是卡片管线用的 slug → 语言映射。`getDocSlugs()` / `getDocBySlug()` / `getAllDocs()` 对 `docs/` 做同样的事。
3. **路由页面。** `app/writing/[slug]/[lang]/page.tsx` 为存在的每种语言生成一个页面（`dynamicParams = false`），`zh` 取 `contentZh`，其余取 `content`，并设置 `generateMetadata`（canonical、双语文章的 `hreflang` 互指、来自 `postCardOf` 的 Open Graph）。`app/docs/[...slug]/page.tsx` 从最后一段路径读出语言，去掉 `# ` 标题行（标题由页头显示），在页面末尾加上题记（见[文档](#文档)），并允许未预先生成的参数（`dynamicParams = true`）。
4. **`MDXRenderer`**（`components/mdx-renderer.tsx`）就是 `next-mdx-remote/rsc` 的 `<MDXRemote>`，带 `options={mdxOptions}` 和 `components={mdxComponents}`。编译在服务端、在 `next build` 期间进行；MDX 出错会让那个页面构建失败。
5. **构建时的读取者。** `pnpm ask:index`（`lib/ask-corpus.ts`）为 Ask 索引文章（不含文档），在 `predev` 和 `build` 中自动运行。`scripts/og-snapshot.ts` 记录每篇文章的封面尺寸，以及指向某篇文章的卡片。`pnpm og:fonts` 读取文章标题和描述，生成 CJK 字形子集。`scripts/magic-link-tags.ts` 找出 `content/` 和 `docs/` 中所有的 `<Badge>` 和 `<MagicLink>`。哪条命令刷新哪个文件，见 skill `content-snapshots`。

About 的文案（`content/about/<locale>.mdx`）也是 MDX，但它在 `systems/about/components/about-copy.tsx` 里有自己的 `MDXRemote`；见 [system-about.md](./system-about.md)。

### 语言

| 文件 | `language` | 页面 |
|---|---|---|
| `slug.en.mdx` | `"en"` | `/writing/slug/en` |
| `slug.zh.mdx` | `"zh"` | `/writing/slug/zh` |
| 两者都有 | `"both"` | `/writing/slug/en` 和 `/writing/slug/zh` |

- **裸 URL。** `middleware.ts`（matcher 为 `/writing/:path+`、`/docs/:path+`）把最后一段不是 `en` / `zh`（也不是 `opengraph-image` 这类 metadata 路由）的路径用 307 发往 `/{locale cookie}`，没有 cookie 时回落到 `en`。这个 cookie 由 `services/locale.tsx` 写入。`app/writing/[slug]/page.tsx` 作为兜底，重定向到 `defaultLocale`。两者都不知道一篇文章有哪些语言：一个指向纯中文文章的裸链接，对 cookie 为 `en` 或没有 cookie 的读者，会落到 `/writing/<slug>/en`，一个 404（hux.pro 上现在就有：`/writing/hello-2015`）。指向文章的链接要写明语言。
- **链接。** 站内链接用 `getPostHref(post, locale, basePath)`（`lib/content.ts`）：双语文章用读者的语言，其他文章用文章自己的语言。手写的指向单语文章的链接要写明它的语言。
- **用另一种语言读双语文章。** 页头的 `中文版` / `English` 操作（`usePostLanguage`，`components/post/use-post-language.tsx`）跳到另一条路由，并在屏幕顶部弹出一条 Dock 通知："Reading in Chinese · Preference unchanged"（`lib/i18n.ts` 里的 `languageReadingIn`、`languageNote`；新语言就是读者自己的语言时不弹）。见 [system-dock.md](./system-dock.md#notices)。
- **用另一种语言分享来的链接。** 当双语页面的语言与读者的不同（在 `hydrated` 之后），`LanguageSharedSheet`（`components/post/language-sheet.tsx`）从底部升起，问读者要读哪一种。它是非模态的 sheet，会等 About 的遮罩退去，关掉它就保持分享时的页面。一个 `sessionStorage` 键（`language-switch-intentional`）在读者主动切换之后不再询问。
- **列表。** `/writing` 和 `/docs` 显示读者语言的条目和双语条目；`EN` / `中文` 与 `All` 切换（`LanguageFilter`）把其余的加进来，每条标出它的语言（`shouldShowPost`）。在 `/writing` 上这个选择是 `?lang=all`；在 `/docs` 上是本地状态。

用按语言分开的路由，而不是 `?lang=` 查询参数：每种语言都是爬虫能读的完整静态 HTML，MDX 出错会让构建失败而不是藏在 Suspense 后面，每个页面只渲染一份正文，`hreflang` 互指来自 `generateMetadata`。

### 博客的 frontmatter

| 字段 | 用途 | 从哪里读 |
|---|---|---|
| `title` | 文章标题（缺省时用 slug） | `en` 文件；`zh` 文件的是 `titleZh` |
| `date` | `"YYYY-MM-DD"`，用于列表排序 | `en` 文件，否则 `zh` |
| `description` | 导语；`zh` 文件的是 `descriptionZh` | 各自的文件 |
| `tags` | 标签；`译` 和 `知乎` 只在中文下显示（`tagLocaleVisibility`） | `en` 文件，否则 `zh` |
| `origin` | 文章上的一行出处说明；`[text](url)` 链接会被渲染 | 各自的文件（`origin` / `originZh`） |
| `featured` | `true` 让它出现在首页的 writing widget 上 | 任一文件 |
| `coverFit` | `"cover"`（默认）或 `"natural"`，用于预览封面 | `en` 文件，否则 `zh` |
| `coverAspect` | `"cover"` 槽位的 CSS `aspect-ratio`，默认 `16 / 9` | `en` 文件，否则 `zh` |

没有 `language` 字段；写了也会被忽略。派生的、不用写的：`excerpt`（第一段正文，`extractLead`）、`cover`（正文里第一个 `<Figure url>`、`<img src>` 或 `![](…)`）和 `readingTime`（"4 min" / "4 分钟"）。每个文件原样的 frontmatter 会交给 devtool 的检查器。

### 文档

`getDocBySlug` 从第一个 `# ` 标题取标题，从其后的第一段正文取描述（`/docs` 列表、页面的 meta description），整段的所有行（PR #492）。标题、引用块、图片、JSX 块或代码块会被跳过；文字截断在 200 个字符。所以 H1 下面的那一段要说清这一页是什么。

frontmatter 是可选的：

| 字段 | 用途 | 从哪里读 |
|---|---|---|
| `skills` | `[name, …]`，本页是其详细版本的 `.claude/skills/<name>`。页面末尾附一条脚注，链接到每个 skill 的 `SKILL.md`，`/docs` 列表里这一行标上 `skill` | 英文文件，否则中文文件 |
| `origin` | 出处，和文章一样。中文版的是 `"AI-translated from the original"` | 各自的文件（`origin` / `originZh`） |

`skill` 标签由 `skills` 派生；不要写进 `tags`。它和 `译` / `知乎` 一样是行上的装饰标签（`lib/content.ts` 里的 `decoratorTags`），两种语言下都显示。那条脚注就是文章的 `origin` 用来收尾的题记（`app/docs/[...slug]/page.tsx` 里的 `colophon`）：先是 origin，然后是 "The checklist form of this page is the Claude Code skill …"（中文页上是中文），用一个点连接。文档不在 H1 下面指向自己的 skill。

一个 slug 读哪个文件：

| 语言 | 先找到的优先 |
|---|---|
| 英文 | `slug.en.mdx`、`slug.en.md`、`slug.md` |
| 中文 | `slug.zh.mdx`、`slug.zh.md` |

两者都有时，`language` 为 `"both"`：`/docs/slug/en` 和 `/docs/slug/zh`，带 `hreflang` 互指。旁边加上 `slug.zh.md` 之后，普通的 `slug.md` 仍是英文页，这样指向这篇文档的代码、skill 和其他文档，路径都不用变。不带语言后缀的 `.mdx` 永远不会被读取：`getDocSlugs` 会列出它，但它单独存在时是 404，和 `slug.md` 并存时永远不会被渲染（`docs/navigation.mdx`，PR #472）。

**中文版**是 `docs/<slug>.zh.md`，frontmatter 为 `origin: "AI-translated from the original"`（就是这串英文，和翻译的文章一样），不写 `skills`，它们从英文文件读取。中文页上的页内链接（`#anchor`）指向*翻译后*标题的 id。`HeadingWithLink` 用 `headingId`（`lib/heading-id.ts`）从标题渲染出的文字生成 id：转小写，保留字母、数字、`_`、`-` 和中文字符（U+4E00 到 U+9FFF），其余一律去掉，包括中文标点，空格变成连字符。`## 原理` 的 id 是 `#原理`。

**指向另一篇文档的链接**写成 `./other.md` 或 `./other.md#anchor`，这样在 GitHub 上也能用；页面会把它指向 `/docs/other/<lang>`（`lib/doc-links.ts`）。从中文页出发的链接留在中文，除非那篇文档没有中文版，或者锚点是只有英文页才有的标题，所以译文可以沿用英文标题的 id。

文档在 `/docs` 下按标题排序列出，和文章用同一个 `PostContent` 渲染（`app/docs/[...slug]/content.tsx`）。

### MDX 组件与图片

`components/mdx-components.tsx` 把元素映射到组件，并加上自定义组件。它不带任何视觉样式：正文排版在 `app/globals.css` 的 `.prose-article` 下，嵌入内容用 `.not-prose`（`withNotProse`）包起来以避开它。

| MDX 里写的 | 由谁渲染 |
|---|---|
| `![alt](src)` | `MdxImage`（`components/mdx-image.tsx`） |
| 代码块 | `CodeBlock`：语言标记、复制按钮 |
| `[text](href)` | `ServerProseLink`：指向站点认识的东西的链接，会以它的形式预览；`http…` 在新标签页打开 |
| `#` `##` `###` | `HeadingWithLink`（可复制的锚点） |
| 表格 | `.prose-table-wrapper`（横向滚动） |
| `<Figure>` `<Media>` `<Video>` `<SocialEmbed>` `<Link>` `<LinkCard>` `<MediaRenderer>` | `components/log` |
| `<Badge>` `<MagicLink>` | `components/magic-link`（[system-about.md](./system-about.md)） |
| `<PLChart>` `<LanguageNotes>` | `components/languages`（PL chart 那篇文章） |
| `<Commit>` `<HStackWidget>` `<VStackWidget>` `<Widget…>` `<Playground>` | 同名组件 |

**出血。** `MdxImage` 在构建时从 `public/` 读出本地图片的尺寸，当它宽至少 1024px、且宽高比至少 1.3 时，让它突出 680px 的正文栏（`shouldBleedImage`，`lib/image-meta.ts`）。可以用片段覆盖：`![](/img/x.png#bleed)`、`#no-bleed`（或 `#nobleed`）。CSS 从 900px（`--breakpoint-bleed`）起生效，宽度为 `min(60rem, 100vw - 14rem)`。只有 markdown 图片经过 `MdxImage`：MDX 里的 JSX `<img>` 是普通元素，没有出血，也不解析片段。

**代码。** `rehype-pretty-code` 加 Shiki，主题 `one-light` / `one-dark-pro`，`defaultLang: "plaintext"`。` ```js {1,3-5} ` 加上 `line--highlighted`，` ```js /word/ ` 加上 `word--highlighted`。

**插件**（`lib/mdx-processor.ts`）：`remark-gfm`（表格、删除线、任务列表、裸 URL 自动链接）和 `remark-math`。没有 KaTeX：`$…$` 变成 `<code class="language-math math-inline">`，`$$` 块变成 `math-display` 代码块，按代码显示。`blockJS: false` 保留 JSX 属性表达式（`commit={{…}}`、`defaultExpanded={true}`）：next-mdx-remote v6 默认会把它们去掉，组件拿到的就是 `undefined`。这里所有的 MDX 都是自己写的。

## 规则

| 规则 | 原因 | 违反会怎样 |
|---|---|---|
| 文章文件是 `<slug>.en.mdx` / `<slug>.zh.mdx`（或 `<slug>/index.<lang>.mdx`），两种语言用同一个 slug | 语言和配对都来自文件名 | 其他名字会被悄悄跳过：没有页面，也没有报错。`validateBlogContent()` 能发现，但没有地方调用它 |
| 文档英文是 `<slug>.md`，中文是 `<slug>.zh.md`；不要用不带后缀的 `.mdx` | `getDocBySlug` 只读这些（以及 `.en.md(x)` / `.zh.mdx`），同一语言 `.mdx` 优先于 `.md` | 另一个文件永远不会被渲染（`navigation.mdx`），或者文档 404 |
| 文档 `#` 标题后的第一段是说明这页是什么的正文 | 它是文档在 `/docs` 上和 meta 标签里的描述 | 列表里显示的是一句指引，或者碰巧排在最前的那一段 |
| 文档的 skill 写在 frontmatter 的 `skills: [name]` 里，而不是标题下的一行 | 脚注和 `skill` 标签都来自它 | 没有指向 skill 的链接，也没有标签 |
| 中文页上的页内链接用翻译后标题的 id（`lib/heading-id.ts`） | id 由标题文字生成 | 链接指向不存在的位置 |
| 正文里不要出现裸的、后面紧跟字母或 `/` 的 `<`，也不要出现裸的 `{`；放进反引号或代码块 | MDX 把 `<x` 当作标签，把 `{` 当作 JS 表达式 | `Expected a closing tag`、`Could not parse expression with acorn`：页面构建失败。两边有空格的 `a < b` 没问题 |
| `<https://…>` 自动链接和 `<!-- -->` 注释不是 MDX | 同一个解析器 | 编译错误。写成 `[text](url)` 和 `{/* note */}` |
| 一段里成对的 `$` 是数学公式 | `remark-math` | "costs $5 and $10" 会把 `5 and ` 渲染成代码 |
| JSX 属性是 JavaScript：`style={{ display: "flex" }}`、`width={2}`、`className` | 这是 JSX，不是 HTML | `style="display: flex"` 能编译，但 React 遇到字符串 style 会抛错 |
| 图片放在 `public/`，用绝对路径引用：文章放在 `/img/in-post/<post>/` 下（头图 `/img/post-bg-*.jpg`），文档放在 `/img/docs/<slug>/` 下 | `content/` 和 `docs/` 里的东西都不对外提供，相对路径会相对于 `/docs/<slug>/<lang>` 解析 | 图片 404；没有出血（尺寸是从 `public/` 读的） |
| 正文有图片的文章要跑 `pnpm og:sizes` | 第一张图是它的封面，`og:complete` 检查每个封面的尺寸 | CI 失败："cover size not recorded" |
| 指向文章的站内链接走 `getPostHref`，或写明文章自己的语言 | 单语文章只有那一个页面 | 另一种语言 404 |

## 可自由选择的

- 文章用单文件还是文件夹。文件夹形式只是把各语言文件归到一起；它的图片仍然放在 `public/`。
- 翻不翻译一篇文章或文档。单语也是正式成员。
- 用 `#bleed` / `#no-bleed` 覆盖出血。
- 文档里并排的图片：一个 flex `<div>` 包着几个 JSX `<img>`，带 `style={{ width: "calc(50% - 0.5rem)", margin: 0 }}`（`docs/keyboard-input.md` 里有一个）。

## 做法

**新文章。** 写 `content/blog/<slug>.<lang>.mdx`（以及同一 slug 的另一种语言），带 `title`、`date`、`description`、`tags`。图片放到 `public/img/in-post/<slug>/`。有图片就跑 `pnpm og:sizes`，中文标题或描述带来新字形就跑 `pnpm og:fonts`，`<Badge>` 指向新站点就跑 `pnpm badges:snapshot`。每种语言都打开 `/writing/<slug>/<lang>` 看一下。

**新文档。** 写 `docs/<slug>.md`：如果有 skill 作为它的清单，就写 frontmatter `skills: [name]`，然后是 `# Title`，接着一段说明这页是什么，然后是正文。图片放在 `public/img/docs/<slug>/`，引用为 `/img/docs/<slug>/<name>.png`。在 `AGENT.md` 的索引里加上它。打开 `/docs/<slug>/en`，或者用 `@mdx-js/mdx` 的 `compile` 加 `remark-gfm` + `remark-math` 单独编译它。中文版是 `docs/<slug>.zh.md`（[见上文](#文档)）。

## 关键文件

| 文件 | 用途 |
|---|---|
| `lib/mdx.ts` | slug、语言配对、frontmatter、派生字段、文档 |
| `lib/content.ts` | `BlogPost` / `Doc` 类型、`getPostHref`、`shouldShowPost`、`postCardOf`、`decoratorTags` |
| `lib/heading-id.ts` | 标题的 id，用于页内链接 |
| `lib/mdx-processor.ts` | `mdxOptions`：插件、Shiki、`blockJS: false` |
| `components/mdx-renderer.tsx` | `MDXRenderer`，文章和文档唯一的编译处 |
| `components/mdx-components.tsx` | `mdxComponents` |
| `components/mdx-image.tsx`、`lib/image-meta.ts` | `MdxImage`、出血的判断规则和片段 |
| `app/writing/[slug]/[lang]/page.tsx` | 按语言分开的文章页面、metadata |
| `app/writing/[slug]/page.tsx` | 裸文章 URL 的兜底重定向 |
| `app/docs/[...slug]/page.tsx` | 文档页面，语言取自最后一段路径，题记 |
| `middleware.ts` | 裸 URL → `/{locale cookie}`（307） |
| `components/post/use-post-language.tsx`、`language-sheet.tsx` | 切换语言时的通知，以及分享链接时的 sheet |

## 为什么不用 Fumadocs

基于 `next-mdx-remote` 和标准 remark / rehype 插件的自建方案，让每个组件都是自己的，升级路径也短；版本化文档和 API 参考生成都用不上。如果 `/docs` 超过 50 页左右，或需要版本，再重新考虑。
