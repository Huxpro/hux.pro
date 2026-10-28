---
origin: "AI-translated from the original"
---

# 链接预览（Open Graph）系统

`/works` 如何为它链接到的页面（web.dev、某个会议的议程页、我们自己的一篇文章）绘制卡片：提前抓取、提交进仓库，构建时直接读取，不走网络。我们自己发布的社交图片，也就是为本站页面生成的那些，见 [og-images.md](./og-images.md)。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/og-previews/card-crawled.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上 Ele.me PWA 那条 commit 的 peek：web.dev 的图片、它的域名、页面的 og:title 和 og:description，封面上还有一个 New tab 标签。" />
  <img src="/img/docs/og-previews/card-own-post.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Hux Blog 那条 commit 的 peek：文章的第一张图片、以 /writing 作为域名、标题 Hello 2015，以及文章的第一段。" />
</div>

`/works?view=index` 上的两个 peek（桌面，鼠标悬停在行上）。左边是抓取来的卡片：web.dev 自己的 `og:title`、`og:description` 和 `og:image`，外加一个 `New tab` 标签，因为抓取时读到了 web.dev 拒绝被嵌入 iframe。右边是我们自己的一篇文章：什么都没抓取；标题、第一段和第一张图片都是从文章本身算出来的（`siteCardOf`）。

<img src="/img/docs/og-previews/card-manual-image.png" style={{ width: "calc(50% - 0.5rem)" }} alt="ReasonML 那条 commit 的 peek：图片是 Reason 的 logo，下面是页面抓取来的标题和描述，封面上有一个 Web 标签。" />

一张由两个来源叠成的卡片。标题和描述来自抓取；图片是 `content/log.json` 里手写的 `preview.image`，因为这个页面没有声明 `og:image`。`Web` 标签表示它会在应用内浏览器里打开。

做对了的地方：

- 每张卡片都在第一帧就画出来，数据来自已提交的文件。没有骨架屏，不请求那个页面，也不请求我们自己的服务器。
- peek 一打开就是最终高度：图片的 `[width, height]` 事先已知，所以图片加载时不会跳动。
- 我们自己文章的卡片，内容永远和文章当前的内容一致。不一致时 CI 会失败。
- 屏蔽爬虫的网站依然有卡片，是手写的，而且永远不会表现为时有时无的失败。

## 原理

![快照流水线：content/log.json、magic link 和我们的文章作为输入进入 pnpm og:snapshot，它写出 content/og-snapshot.json 和 content/image-sizes.json；pnpm og:sizes 只写尺寸。分界线以下不联网，这两个文件供 CI 里的 pnpm og:complete 和卡片所用的 enrichLogDataWithPreviews 读取；还没有标题和图片的卡片会去请求 GET /api/og，它只在开发环境中响应。](/img/docs/og-previews/pipeline.svg)

分界线以上是你联网运行的命令。分界线以下是 CI 和构建，它们只读取这两个已提交的文件。虚线框是卡片接触网络的唯一途径，在生产环境中是关闭的。

### 合并：逐字段，作者优先

`enrichLogDataWithPreviews`（`lib/og-enrich.ts`）逐字段（`title`、`description`、`image`、`fit`、`aspect`、`frame`）合并出每张卡片的 `preview`，排在前面的优先：

1. media 项上的**手写 `preview`**，在 `content/log.json` 里。
2. 它的 URL 在 `content/og-snapshot.json` 里对应的**快照条目**。

`urls` 映射里各语言的 URL 有各自的条目，打包进 `previews[locale]`。它在服务端为 `/works` 运行（`app/works/layout.tsx`，经由 `lib/og-snapshot.ts`，后者从磁盘读取文件），也在静态 import 快照的客户端模块里运行（`lib/log-client.ts`、`app/home-view.tsx`）。

`LinkCard`（`components/log/media/link.tsx`）在合并后的 preview 同时有标题和图片时立即绘制。否则它会求助于实时抓取，`fetchOGData` → `GET /api/og`，而这只在 `pnpm dev` 中响应（见[实时抓取](#实时抓取)）。一分钟前刚写的链接，正是这样在还没人运行 `og:snapshot` 之前就有了卡片。

### 本站自己的页面

本站文章的卡片（`url` 或某个 `urls` 条目是 `/writing/<slug>/<lang>` 的 `link`）走的是同一条流水线：快照以它的 URL 记录它。但记录的内容不是抓取来的，而是由 `siteCardOf`（`lib/site-card.ts`）根据 `postCardOf`（`lib/content.ts`）算出来的，文章页面发布自己的 Open Graph 用的也是这个函数。所以爬虫从我们页面上读到的标题和文字，与我们为它绘制的，是同一个答案：文章的标题和完整的第一段。图片是文章的第一张图片；没有图片时，用烘焙好的 `/writing/<slug>/<lang>/opengraph-image`；这两种样子在 [og-images.md](./og-images.md) 里有说明。

`og:complete` 会重新计算每一张这样的卡片，文章在快照之后改过就会失败，所以两者不会走样。

### 抓取

`pnpm og:snapshot`（`scripts/og-snapshot.ts`）收集所有目标，用 `fetchOG`（`lib/og-core.ts`，实时路由用的也是这个函数）每次五个地抓取需要抓取的那些，然后写出：

- **确定性的输出。** 键排序、字段顺序固定（`title`、`description`、`image`、`siteName`、`frame`）、没有时间戳。只有内容变了，文件才会变。
- **失败的抓取永远不会覆盖好的条目。** 成功但没带回图片的抓取也不会：之前记录的图片会保留下来。
- **条目必须有图片才算数。** 只有标题的抓取结果用不了。
- **既没有可用的条目，也没有完整的手写 preview：退出码 1**，并给出那个 URL。这个 URL 不会写进文件；好的条目照样写入。
- **完整的手写 `preview`（有标题和图片）会跳过**那张卡片自身 URL 的抓取：你已经接管了它，所以它永远不会显示为漂移。它 `urls` 映射里各语言的 URL 仍然会被抓取。
- **视频封面**：Bilibili 和 Vimeo（`platform`）的封面来自它们的 API，除非该项有 `thumbnail`。YouTube 的封面在运行时根据 ID 推导，不进快照。

### 嵌入策略

抓取时还会读取每个页面的 `X-Frame-Options` 和 `Content-Security-Policy: frame-ancestors`，也就是窗口系统把页面放进 iframe 时（桌面上的应用内浏览器；见 [system-attachments.md](./system-attachments.md)）浏览器会遵守的那两个响应头。拒绝被嵌入的页面在条目上记为 `frame: "deny"`；允许被嵌入的页面什么都不记，这样这个字段读起来就是它本来的身份：例外。失败的请求里只信任明确的拒绝：一道对嵌入只字不提的反爬墙，不会被当成许可。有完整手写 `preview` 的卡片仍会做一次只看响应头的检查；保留了旧条目的失败抓取，仍会更新它的 `frame`（Medium 的 403 带着 `SAMEORIGIN`）。Enrichment 会把这个结论带到 `preview.frame`；抓取够不着的页面，可以手写 `preview: { frame: "deny" }` 告诉它。

### 封面尺寸

卡片的图片默认完整显示（`CardFace` 的 `fit` 是 `"natural"`），所以它的位置和图片一样高，而浏览器要等字节到了才知道这个高度。每一张封面在构建时都是已知的，所以它的尺寸也是：`content/image-sizes.json` 以 URL 为键，记录站点上每一张可以完整显示的图片的 `[width, height]`（enrichment 之后卡片的图片、magic link 或 badge 指向页面的图片、静帧、每篇文章的第一张图片）。`PeekCover`（`components/log/media/peek-cover.tsx`）通过 `imageSizeOf`（`lib/image-sizes.ts`）读取它，在图片取回之前就给位置设好宽高比。站点自己生成的卡片（`/…/opengraph-image`）是 1200×630，不需要条目。

- `pnpm og:snapshot` 记录它刚刚快照的那些封面的尺寸，读自每个文件的文件头（远程图片只读到文件头为止；支持 PNG、JPEG、GIF、WebP、AVIF、SVG，见 `lib/image-dimensions.ts`）。
- `pnpm og:sizes` 只记录尺寸，不抓取任何页面。
- `pnpm og:complete` 在封面没有记录尺寸、或本地文件的尺寸在记录之后变了时失败。

探测失败永远不会丢掉已经记录的尺寸。

## 规则

| 规则 | 原因 | 打破之后 |
|---|---|---|
| 构建和页面永远不抓取。封面来自 `content/og-snapshot.json`、手写的 `preview` 或 `thumbnail` | 站点发布时不带 API 路由；`/api/og` 在生产环境中是 404。有些网站（Medium）本来就拒绝服务端请求 | 需要抓取的卡片在生产环境中只显示一个光秃秃的域名 |
| 添加或修改了链接卡片，或编辑了某张卡片展示的文章：运行 `pnpm og:snapshot`，把两个 JSON 文件和改动一起提交 | CI 只读取已提交的文件 | `og:complete` 失败：没有图片、我们文章的卡片过期，或者没有尺寸 |
| 新增指向别人页面的 `<MagicLink href>` 或 `<Badge href>`：同样运行 `pnpm og:snapshot` | 它的 peek 就是那个页面的卡片（`components/magic-link/resolve.ts` 读取快照） | CI 不检查这些：在生产环境中 peek 只显示一个光秃秃的域名 |
| 永远不要为我们自己的文章写 `preview`。去改文章 | 它的卡片是 `postCardOf` 给出的答案，每个 PR 都会拿它和文章比对 | 卡片说的是一回事，页面的 `og:*` 说的是另一回事 |
| 想取代抓取的手写 `preview` 要同时有 `title` 和 `image` | `mediaNeedsLiveCrawl` 只跳过完整的那种 | 抓取照样运行，遇到屏蔽爬虫的网站就失败 |
| 每张卡片都要能解析出图片 | 没有图片的卡片会画成一块空白，在 /works 和附件页面里都是 | `og:complete` 失败 |
| 不要手改 `og-snapshot.json` 里抓取来的条目 | 下一次 `og:snapshot` 会根据页面重写它们 | 你的修改在某个无关 PR 的 diff 里消失。请用手写 `preview` |
| `frame` 是学来的，不是写出来的；例外是给抓取够不着的页面写 `preview: { frame: "deny" }` | 窗口系统会把允许嵌入的页面放进 iframe 打开 | 拒绝被嵌入的页面在窗口里打开后只看到一个拒绝 |

可以自由选择的：给一张你不喜欢其抓取标题或图片的卡片写手写 `preview`（没写的字段仍来自抓取）；用 `preview.fit: "cover"` 和 `preview.aspect` 把图片裁进固定的位置，而不是完整显示；对没有东西可抓取的 `<Badge>` 或 `<MagicLink>` 页面，在 `content/badges.json` 的 `previews` 里手写一张卡片。

## 做法

**添加一张链接卡片。** 在 `content/log.json` 里给对应 commit 添加 media 项（`"kind": "link"`、`"present": "card"`、`url`），在 `pnpm dev` 里检查一下（实时抓取会把它画出来），然后：

```bash
pnpm og:snapshot   # crawl → content/og-snapshot.json, content/image-sizes.json
pnpm og:complete   # what CI runs: no network
```

检查 diff，把两个文件和内容一起提交。

**某个网站抓取不了。** `og:snapshot` 退出码为 1 并给出那个 URL。给那个 media 项加上手写 preview：

```jsonc
{
  "kind": "link",
  "present": "card",
  "url": "https://medium.com/…",
  "preview": {
    "title": "…",
    "description": "…",
    "image": "https://…"   // loaded by the visitor's browser, not crawled
  }
}
```

然后运行 `pnpm og:sizes` 记录这张图片的尺寸。

**添加了手写的 `preview.image`，或替换了某张卡片展示的 `public/` 下的文件。** 运行 `pnpm og:sizes`，提交 `content/image-sizes.json`。

**某个图片服务器拒绝尺寸探测**（The Verge 对 Node 的 fetch 返回 403）。手动在 `content/image-sizes.json` 里加上 `"<url>": [width, height]`。探测失败时它会被保留。

**编辑了某张卡片展示的文章。** 运行 `pnpm og:snapshot`；`content/og-snapshot.json` 里那篇文章的条目会变。

**快照过期了吗？** `pnpm og:check` 先检查完整性，再重新抓取，如果有任何内容会变就失败，但不写入文件。在开发环境中，`NEXT_PUBLIC_OG_REVALIDATE=1` 让每张卡片在绘制后重新抓取，标题、描述或图片不同时 `console.warn`。两者都是可选的；都不在 CI 中运行。

## 参考

### 命令

| 命令 | 网络 | 作用 |
|---|---|---|
| `pnpm og:snapshot` | 是 | 抓取所有目标，写出 `content/og-snapshot.json` 和 `content/image-sizes.json` |
| `pnpm og:sizes` | 仅图片 | 为已提交的快照记录封面尺寸；不抓取页面 |
| `pnpm og:complete` | 否 | CI 的关卡（`.github/workflows/ci.yml`，与 `pnpm badges:check` 并列） |
| `pnpm og:check` | 是 | 先 `og:complete`，再重新抓取，有漂移就失败；不写入任何东西 |

四个命令都是 `scripts/og-snapshot.ts`（`--sizes`、`--complete`、`--check`）。

`og:complete` 加载 `log.json`，按 `/works` 的方式做 enrichment，只要有任何会绘制封面的 media 附件在运行时没有图片就失败：

- **链接卡片**：合并后的 `preview.image`，`urls` 映射里的每个语言 URL 也一样。
- **视频**：手写的 `thumbnail`、快照里的封面（Bilibili / Vimeo），或 YouTube 推导出的封面。
- **幻灯片 / 图片**：手写的 `thumbnail` / `url`；站内的 `/img/…` 路径必须在 `public/` 下存在。
- **社交组件**自己绘制自己，跳过。

我们自己文章的卡片过期、封面尺寸缺失或过期时，它也会失败。它不抓取：封面缺失是内容 bug，而不是第三方偶发的故障。

### 哪些内容会被快照

- `content/log.json` 里每个 `present: "card"` 的 `link` media 项（如今所有链接都是卡片），以及它 `urls` 映射里的每个 URL。
- 没有 `thumbnail` 的 Bilibili 和 Vimeo `video` 项，为了它们的封面。
- `content/` 和 `docs/` 下的 MDX 里，每个 `<MagicLink>` 或 `<Badge>` 指向的外部 `href`（`scripts/magic-link-tags.ts`），在 `content/badges.json` 的 `previews` 里已有卡片的页面除外。它的 peek 就是那个页面的卡片。
- 演讲的 `conference.url`，以及 commit 的 `description`、`commentary` 或 `details` 里以行内方式链接的每个外部页面，两种语言都算：时间线会把这些渲染成 magic link。

录像、幻灯片、图片和社交帖子（由 `detectMediaKind` 判断）有它们自己的 peek，跳过。原生社交嵌入（X、Instagram、TikTok）用它们自己的组件。

### 正文里的链接

MDX 的 `a` 是 `ServerProseLink`（`components/magic-link/server.tsx`）。指向本站自己东西的链接会变成 magic link，带着它在其他地方一样的 peek 和手机上的抽屉：

| 链接指向 | 它的 peek（以及在手机上打开的样子） |
|---|---|
| 一篇文章（`/writing/…`，或它的完整 URL、旧博客 URL） | 这篇文章 |
| 一个板块（`/works`、`/works?type=talk` 等） | 该板块的卡片 |
| `log.json` 里某个 commit 附带的 URL | 那个附件，即它在 /works 上的封面 |
| 其他任何东西 | 普通链接 |

别人的页面不会自动升级成卡片：指向站外的链接，离它要去的地方只差一次点击，所以普通的正文链接不会被抓取。想要卡片的作者写 `<MagicLink href>`，它的卡片会被快照记录。

### 实时抓取

`GET /api/og?url=…`（`app/api/og/route.ts`）抓取的是访客浏览器交给它的 URL，所以它有防护（`assertPublicUrl`，`lib/og-guard.ts`）：

- 只允许默认端口上的 `http(s)`，URL 里不能带凭据；
- 主机以及每一次重定向的主机都必须只解析到公网地址（不能是 localhost、私有网段、链路本地地址或云厂商的元数据地址）；
- 最多八秒、五次重定向，且只读到页面的 `<head>` 为止（上限 1 MB）。

它是 GET，这样 CDN 可以缓存：卡片缓存一天，未命中缓存一小时。本站自己的页面由 `siteCardOf` 回答，不发请求。

在生产环境中它返回 404，除非 `NEXT_PUBLIC_OG_RUNTIME=1`。站点发布时不带 API 路由，而且它展示的每个链接都写在仓库里，所以快照能装下所有卡片；实时抓取的作用，是在 `pnpm dev` 里给一分钟前刚写的链接画出卡片。

### 文件

| 文件 | 作用 |
|------|------|
| `scripts/og-snapshot.ts` | `pnpm og:snapshot` / `og:sizes` / `og:complete` / `og:check`。 |
| `scripts/magic-link-tags.ts` | MDX 里的每个 `<MagicLink>` / `<Badge>`，用来收集目标。 |
| `lib/og-core.ts` | 与框架无关的抓取、解析、嵌入策略、目标判定。路由和脚本共用。 |
| `lib/og-enrich.ts` | `enrichLogDataWithPreviews`，纯函数：把手写内容和快照合并进 log 数据。 |
| `lib/og-snapshot.ts` | Node 加载器：从磁盘读取快照，调用纯函数 enrichment。 |
| `lib/site-card.ts` | `siteCardOf`：把本站文章变成卡片，不抓取。 |
| `lib/og.ts` | `fetchOGData`：浏览器对 `/api/og` 的调用。 |
| `app/api/og/route.ts` | 实时抓取：本站页面来自 `siteCardOf`，其他人的页面经过防护。可缓存的 GET。 |
| `lib/og-guard.ts` | `assertPublicUrl`：实时抓取只请求公网网页。 |
| `lib/image-dimensions.ts` | 从图片的文件头读取尺寸。 |
| `lib/image-sizes.ts` | `imageSizeOf`：客户端读取封面记录的尺寸。 |
| `components/log/media/link.tsx` | `LinkCard` / `CardFace`：绘制卡片；实时兜底和可选的重新校验。 |
| `components/log/media/peek-cover.tsx` | `PeekCover`：封面的位置，尺寸来自 `imageSizeOf`。 |
| `content/og-snapshot.json` | 已提交：每个 URL 的卡片。 |
| `content/image-sizes.json` | 已提交：每张封面的 `[width, height]`。 |

### 为什么用快照

请求时抓取，依赖第三方网站既能访问，**又**允许从服务器 IP 抓取，而有些网站（Medium）不管 User-Agent 是什么都拒绝服务端请求。快照把抓取挪到作者的机器上，并提交结果，这样既去掉了运行时依赖，又让站点保持兼容静态导出：预览不需要任何按请求执行的服务端工作。
