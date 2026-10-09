---
origin: "AI-translated from the original"
---

# OG 图片系统

为本站**自己的**页面生成 Open Graph / 社交卡片：页面被分享到 X、LinkedIn、iMessage、Slack 等地方时，用来预览它的那张 1200×630 的图。

> 别和 [og-previews.md](./og-previews.md) 搞混：那篇讲的是抓取**别人**网站的 OG 元数据，用来渲染 `/works` 上的链接卡片。本文讲的是**我们**为**自己的**页面发布的图片。

## 长什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/og-images/home.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="首页卡片：左上 λhux，右上 hux.pro，衬线体的 Hux.Pro，一条细线，然后是等宽体的标语，底色是纯色 #1a1a1a。" />
  <img src="/img/docs/og-images/post-en.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="文章 dreamer 的英文卡片：压暗的第一张图上，衬线体的 Software Dreamer，细线下面是 2018 · 3 min。" />
</div>
<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginTop: "1rem" }}>
  <img src="/img/docs/og-images/post-zh.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一篇文章的中文卡片：程序员中的梦想家 用的是无衬线字体，而不是英文标题那样的衬线体；下面是 2018 · 4 分钟。" />
  <img src="/img/docs/og-images/post-zh-offline.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一张中文卡片在访问不到 Google Fonts 时的渲染结果：标题和 分钟 里的每个汉字都是空方框。" />
</div>

上排：`/opengraph-image`（一张栏目卡片）和 `/writing/dreamer/en/opengraph-image`（一张叠在文章第一张图上的文章卡片），两张完全用 `lib/og-fonts/` 里烘焙好的字体渲染。下排：这篇文章的中文卡片在 `pnpm dev` 下的样子，以及访问不到 Google Fonts 时的样子。这些汉字并不是烘焙好的 Noto Serif SC：它们是渲染卡片时临时拉取的 Noto Sans，拉取失败就成了方框（见[中文字形的现状](#中文字形的现状)）。

## 模型

三种卡片，一个渲染器（`lib/og-image.tsx` 里的 `renderOgImage`）：

| 种类 | 是什么 | 卡片 |
|------|------|------|
| **栏目（Section）** | 首页和每个主栏目，各一张共用的卡片 | `λhux` · 路径 · 衬线体栏目标题 · 等宽体标语 |
| **文章（Post）** | 每篇文章、每种语言，各有自己的卡片 | 文章的第一张图（压暗）· 衬线体标题 · `year · reading time` |
| **视图（Reading）** | 别人会转发的某个栏目的筛选视图，例如 `/works?type=talk` | 栏目卡片，路径换成这个查询，再加一个计数 |

没有自己 `opengraph-image` 的路由，显示离它最近的上层那张：文档页（`/docs/<slug>/<lang>`）显示 `/docs` 的卡片，`/lab` 显示首页卡片。

一篇文章有两副面孔。**被分享出去时**，它就是它的卡片，由它的 `opengraph-image` 路由烘焙：第一张图（`cover`/`coverZh`，在 `lib/mdx.ts` 里提取）压暗，标题和年份叠在上面；没有图的文章则用纯排版的卡片。信息流里可能只显示图片本身，所以标题要由图片带着。**在站内**，文章的卡片显示图片本身，把标题放在图旁边。

页面的 Open Graph 来自 `lib/content.ts` 里的 `postCardOf(post, lang)`，卡片路由读的是同一个标题（`getLocalizedTitle`，不带浏览器标签页上那个 `| Hux.Pro`）。页面把文章的第一段完整地（`extractLead`）作为 `og:description` 发布；导语（frontmatter 的 `description`）是预览用的字段，只在正文没有段落时才用。卡片按语言区分，所以双语文章会有各自的 EN/ZH 卡片。

## 视图：给查询字符串一张卡片

`/works?type=talk` 是筛选过的 /works，不是一个页面：查询字符串就是视图状态（`lib/log-view.ts`）。但它是大家会转发的链接（About 里的魔法链接、首页的小组件），而爬虫展开链接时，读的是它拿到的那份 HTML 里的 Open Graph。静态页面只有一份，所以每个值得一张卡片的视图（`lib/works-readings.ts` 里的 `WORKS_READINGS`：`talk`、`project`）都有自己的页面 `app/works/[type]`，预渲染时带上它的标题、文案和烘焙好的卡片，此外什么也不渲染。

- **视图归布局所有**（`app/works/layout.tsx`）。`/works` 和 `/works/<type>` 都是它下面的空页面，所以点一下筛选标签在两者之间切换时，视图不会被卸载。
- **地址仍然是查询字符串。** `next.config.ts` 把 `/works?type=<type>` 重写到 `/works/<type>`（放在 `beforeFiles`，否则普通的 `/works` 页面会先响应），并把直接访问的 `/works/<type>` 重定向回查询形式。只有恰好指定一个视图的查询才会被重写（`?type=talk&view=feed` 会；`?type=talk,project` 就是 /works）。
- **一张卡片，三处读取。** `worksCardOf`（`lib/works-card.ts`）既是页面的 Open Graph（`app/works/metadata.ts`），也是它的图片（`/works/<type>/opengraph-image`），还是魔法链接的卡片（`components/magic-link/server.tsx`）。计数从日志里算出来，所以永远不会过时。顺带的好处是，标签页标题也会跟着视图变。

新增一个视图：把它的 type 加进 `WORKS_READINGS`，把它的文案加进 `lib/works-card.ts` 里的 `READINGS`。

## 原理

基于 Next.js 的 [`opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) 文件约定加上 `next/og`（`ImageResponse`，底层跑的是 Satori）。图片**在构建时预渲染**：7 个 `opengraph-image.tsx` 文件，大约 50 张卡片（每个栏目、两个视图、通过 `generateStaticParams` 生成的每篇文章的每种语言），所以请求时不做任何渲染。

`metadataBase`、`openGraph` 和 `summary_large_image` 类型的 Twitter 卡片在 `app/layout.tsx` 里统一设置一次。自己设置 `openGraph` 的页面（文章、/works）要设置完整，因为它会整个替换掉布局的设置，而不是合并。文件约定生成的图片会自动填进 `og:image` 和 `twitter:image`。

字体**烘焙进仓库**（`lib/og-fonts/`，由 `pnpm og:fonts` = `scripts/og-fonts.mjs` 写入），由 `loadFonts()` 从磁盘读取。拉丁字体覆盖完整的可打印字符范围，所以任何英文标题都不用重新烘焙就能渲染；CJK 字体则子集化为所有文章（两种语言）的 `title` 和 `description` 用到的字形，外加一批常用汉字作为余量。三个文件总共约 310 KB。

![pnpm og:fonts 把三款 Google 字体子集化到 lib/og-fonts/；next build 的 opengraph-image 路由调用 renderOgImage，其中 loadFonts 读取这些字体并交给 ImageResponse；元素字体族里有的字形从烘焙文件中绘制，其他字形经由 next/og 的 loadDynamicAsset 去 Google Fonts 拉取，联网时得到一个无衬线字形，离线时得到一个方框。](/img/docs/og-images/font-path.svg)

从左到右：需要联网的烘焙，本不该联网的构建，以及每个字形从哪里来。红色那条路径，就是今天每个汉字走的路。

文章的第一张图从 `public/` 读取，以 data URI 内联。远程的第一张图（有三篇知乎时期的文章以一张 `zhimg.com` 的图片开头）会在构建时拉取；拉取失败，卡片就退回纯排版的那种。

### 中文字形的现状

本意是让汉字标题用烘焙文件里的 Noto Serif SC。实际情况是：

- `loadFonts()` 把 Newsreader 和 Noto Serif SC 注册在同一个字体族名 `OgSerif` 下。Satori 从字体族的第一个字体里取字形，不会再去试同名、同字重、同样式的第二个字体，所以烘焙好的 CJK 字体被加载了，却从来没被用上。
- 元素字体族里没有任何字体包含的字形，会交给 next/og 的 `loadDynamicAsset`，它为这个字形去 Google Fonts 拉取 Noto Sans JP / SC。联网时，标题就用这款无衬线字体显示（上面左下）。不联网时显示成方框，构建照样成功（右下）。
- 元信息那一行用的是 `OgMono`，里面没有汉字，所以中文阅读时长里的 `分钟` 在每一张中文卡片上都走同一条路。

所以在 CJK 字体真正能被用到之前（给它一个自己的字体族名，标题里排在 `OgSerif` 之后、元信息里排在 `OgMono` 之后），`pnpm og:fonts` 对中文卡片没有任何可见的效果。即便如此，中文标题出现新字形后还是要照常运行它，这样等字体能用上的时候它是完整的：`pl-chart` 的中文标题里已经有两个字（`偏`、`编`）不在烘焙结果里。

## 约束

| 约束 | 原因 | 打破之后 |
|---|---|---|
| `next build` 时不为字体联网：从 `lib/og-fonts/` 读取 | 每张卡片都去拉字体，意味着一次构建要发几百个 Google Fonts 请求；曾经有一次拉取被限流而抛错，导致 Vercel 构建失败 | 当时是部署失败；现在 next/og 的兜底会接住错误，改为输出方框 |
| `loadFonts()` 里一个字体族名只对应一个字体 | Satori 不会在同名的字体之间回退 | 第二个字体成了累赘（目前的 CJK 字体就是） |
| 卡片上印出的每个字符都在烘焙结果里：拉丁字符、卡片文案、每篇文章的标题 | 不在里面的字形要么在构建时拉取，要么是方框 | 衬线体标题里混进无衬线字形或方框 |
| 1200×630，每个路由的 `size` 都用 `OG_SIZE` | 这是爬虫对 `summary_large_image` 预期的尺寸 | 预览被裁切或出现黑边 |
| 卡片里用 `<img>`，不用 `next/image` | Satori 渲染的是原始元素 | 封面图渲染不出来 |

可以自由选择的：颜色（照搬 `app/globals.css` 里的暗色模式 token）、标题字号的档位（`titleSize`）、封面上那层渐变遮罩、每个栏目的标语。

## 设计

忠实于暗色模式的设计 token（`app/globals.css`）和 "Personal Operating System" 的设计语言：

- **底色** `#1a1a1a`（`--background`），文字 `#e8e8e8`，弱化文字 `#a0a0a0`
- **`λhux`** 等宽体的品牌标识，左上角（和首页是同一个标识）
- **路径**（`/writing`、`hux.pro`）等宽体，右上角
- **标题** 衬线体 Newsreader；按长度取 92 / 80 / 70 / 64px（一个汉字算两个字符），最多约三行
- **元信息** 细线下方一行等宽体的系统信息
- 没有渐变、色块或插画装饰；封面图是唯一的图像

## 新增 / 修改

- **新栏目** → 添加 `app/<section>/opengraph-image.tsx`（复制一个现有的，设置 `title` / `eyebrow` / `meta`）。没有的话，它显示离它最近的上层卡片。
- **新文章** → 卡片这边什么都不用做；每篇文章的路由会通过 `generateStaticParams` 自动带上它。如果它的标题是中文且有新字形，运行 `pnpm og:fonts` 并提交 `lib/og-fonts/`。
- **调整外观** → 改 `lib/og-image.tsx`（一处样式管所有卡片）。

在 `pnpm dev` 里打开卡片的路由就能预览，例如 `/writing/<slug>/<lang>/opengraph-image`、`/works/talk/opengraph-image`。在那里，中文卡片同样会去 Google Fonts 拉取字形。`pnpm build` 之后，烘焙好的图片就是 `.next/server/app/**/opengraph-image.body` 这些文件（PNG）。

## 文件

| 文件 | 作用 |
|------|------|
| `lib/og-image.tsx` | 共用的渲染器：配色、`loadFonts()`、封面加载、标题字号、`renderOgImage()` |
| `scripts/og-fonts.mjs`（`pnpm og:fonts`） | 从 Google Fonts 把三款字体子集化到 `lib/og-fonts/` |
| `lib/og-fonts/` | 烘焙好的字体：`newsreader-400.ttf`、`jetbrains-mono-400.ttf`、`noto-serif-sc-400.ttf` |
| `app/opengraph-image.tsx` | 首页卡片，也是所有没有自己卡片的路由的卡片 |
| `app/{writing,works,docs,prompt}/opengraph-image.tsx` | 各栏目的卡片 |
| `app/works/[type]/{page,opengraph-image}.tsx` | 一个视图的 Open Graph 和卡片（`/works?type=talk` 被重写到这里） |
| `lib/works-readings.ts`、`lib/works-card.ts` | 哪些视图有卡片；卡片本身（文案、计数、图片） |
| `app/writing/[slug]/[lang]/page.tsx` | 文章的 Open Graph（`generateMetadata`，来自 `postCardOf`） |
| `app/writing/[slug]/[lang]/opengraph-image.tsx` | 每篇文章被分享时的卡片（它的 `og:image`） |
| `app/layout.tsx` | `metadataBase` + 基础的 `openGraph` / `twitter` 元数据 |
