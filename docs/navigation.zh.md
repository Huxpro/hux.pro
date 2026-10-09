---
origin: "AI-translated from the original"
---

# 导航

访客怎样在页面之间移动。站内没有导航栏。悬浮按钮和 ⌘K 在任何地方都能到达每一个栏目。内容页顶部的返回链接向上走一级。其余的去处都靠内容里的链接。每一次页面之间的移动都是一次 View Transition：页面交叉淡入淡出，`λhux` 标识滑到它的新位置。命令面板和悬浮按钮属于 [Command System](./system-command.md)；这一页讲的是它们周围的一切。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/navigation/home-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上的首页：小小的 λhux 标识居中，位于问候语上方，下面是小组件网格，底部居中是搜索栏，Ask 球在它右侧。" />
  <img src="/img/docs/navigation/writing-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上的 Writing 页：λhux 标识在栏的左上角、Writing 标题上方，下面是文章列表，右下角是圆形的 Ask 球和 ⌘ K 胶囊。" />
</div>

1280×860，首页和 `/writing`。同一个 `λhux` 在首页居中，在内容页则位于栏的左上角。它是两页之间唯一会移动的元素；其他一切都是交叉淡入淡出。在内容页上它也是返回的路（悬停时显示 `cd ..`）。搜索栏变成角落里的 ⌘ K 胶囊，Ask 球从它的右侧滑到左侧。

## 原理

### 路由

| 路由 | 页面 | 外壳 | 返回链接 |
|-------|------|-------|-----------|
| `/` | 首页：问候语、小组件网格 | `HomeView` | 无 |
| `/about` | 首页上打开 About（[system-about.md](./system-about.md)） | `HomeView` + `AboutRoute` | 无 |
| `/writing` | 文章列表 | `PageLayout page="writing"` | `λhux` → `/` |
| `/writing/<slug>/<lang>` | 文章 | `PostContent`（`PageLayout variant="reader"`） | `/writing` |
| `/works` | 日志；`?type=talk` 等是筛选，每个都有自己的 Open Graph 卡片 | `PageLayout page="works"` | `λhux` |
| `/prompt` | Prompts | `PageLayout page="prompts"` | `λhux` |
| `/docs`, `/docs/<slug>/<lang>` | 文档列表、单篇文档 | `PageLayout title=…`, `PostContent` | `λhux`, `/docs` |
| `/lab`, `/lab/<id>` | Lab 索引、单个 lab | `PageLayout page="lab"`, `LabShell`（[system-lab.md](./system-lab.md)） | `λhux`、该 lab 自己的 |

会变动的地址，除另有说明外都在 `next.config.ts`：

- `/writing/<slug>` 和 `/docs/<slug>` 以 307 跳到 `/<slug>/<lang>`，语言读自 `locale` cookie（默认 `en`）。这一步在 `middleware.ts`。
- `/works/<type>` 重定向到 `/works?type=<type>`。一条 rewrite 让那个页面来提供这个查询形式，这样爬虫读到的就是该筛选的卡片。
- `/editor/*` 重定向到 `/lab/*`，`/bezel/*` 重定向到 `/vitre/*`。`/vitre` 在桌面上会把访客送到 `/lab/vitre`。
- 旧的 Jekyll 地址（`/YYYY/MM/DD/slug`）由 `lib/jekyll-redirects` 处理，再加一条兜底规则指向 GitHub Pages 上的存档。

### 移动的方式

1. **命令面板。** 每个栏目都有一行和一个斜杠字母（Docs 只有字母）。它可以从每个页面的悬浮按钮打开，也可以用 ⌘K，或在输入框之外按 `/`。这些行、字母和按钮见 [Command System](./system-command.md)。
2. **返回链接**（`SystemNav`，`components/ui/system-nav.tsx`），位于每个 `PageLayout` 页面的左上角。它去往上一级，而不是历史记录里的上一页：文章 → 它所在的列表 → 首页。它显示自己要去哪里（`λhux`、`/writing`、`/docs`），悬停时乱码变换成 `cd ..`。它的点击区域至少 44px，用负 margin 撑开，文字位置保持不动。
3. **内容。** 文章行、小组件的表面和页面里的链接。带 `href` 的小组件用 transition router 推入；在它空白的表面上 ⌘/Ctrl 点击或中键点击则改为打开新标签页（`components/ui/widget.tsx`）。在首页上，`λhux` 标识本身在名字被揭示之后会打开 `/about`：桌面上靠悬停，触屏上靠长按（`components/home/scramble-identifier.tsx`）。
4. **浏览器的后退和前进。** 就是普通的历史记录。`ViewTransitions` 监听 `popstate`，所以它们也有动画。

### 内容页：`PageLayout`

`components/ui/page-layout.tsx`，每个列表页都用它，每篇文章和文档也通过 `PostContent` 用它。一个居中的栏（`max-w-[var(--page-col)]`，680px，`px-[var(--page-gutter)]`），带 `pt-16 sm:pt-24 pb-32 sm:pb-40`。两种变体：

- **`poetic`**（列表）：一个固定高度（`h-44 sm:h-48`）的 `HeaderZone`，让内容总是从同一个位置开始。里面依次是返回链接和标题；给了 `page` 时，标题悬停会乱码变换（`TextScramble`，i18n 键为 `${page}Title` / `${page}TitleHover`）。页面滚动时，它按 hero 退场方式离开（`components/ui/hero-exit.ts`）：默认是 `fade`，粘在顶部并在内容下面淡出；`scroll` 则随文档流向上滚走。DevTool 可以在当前会话中固定其中一种。`headerActions` 挂在标题下面（语言筛选）。`pinnedActions` 是一条工具栏，它会固定在顶部，而不是随 hero 淡出（`/works`、`/prompt`）。
- **`reader`**（文章、文档）：没有 hero 区。一个 `reader-masthead` 装着返回链接、标题和 `headerActions`，它的尺寸跟随阅读字号（见下文）。

### 页面过渡

`app/layout.tsx` 用 `next-view-transitions` 的 `<ViewTransitions>` 包住整个应用。它的 `Link` 和 `useTransitionRouter().push` 会在 `document.startViewTransition()` 里发起导航。浏览器没有 `startViewTransition` 时，这个库直接导航，不带过渡。样式在 `app/globals.css` 的 "View Transition API Styles" 一节：

| 名称 | 由谁设置 | 动画 |
|------|--------|-----------|
| `root` | 浏览器 | 旧页面淡出，新页面淡入，200ms ease-out |
| `site-identifier` | 首页 `ScrambleIdentifier` 和 `SystemNav` 上的 `data-view-transition="site-identifier"` | group 在位置和大小上形变，300ms `cubic-bezier(0.4, 0, 0.2, 1)`；快照在 200ms 内交叉淡入淡出 |
| `ask-ball` | `[data-ask-ball]`（`systems/command/fab.tsx`），仅在 `:root:active-view-transition` 下 | 用同一条曲线滑动 300ms；没有交叉淡入淡出（旧快照被隐藏）；group 会模糊它下面的东西（`backdrop-filter: blur(24px)`） |

在 `prefers-reduced-motion: reduce` 下，所有 `::view-transition-*` 动画都关闭，导航瞬间完成。

### 阅读设置（"Aa"）

文章页（`PostContent` 带 `toc` 渲染的任何页面，目前就是 writing 里的文章）的 meta 行末尾、语言切换之后，有一个 `Aa` 小标签。它打开的设置在此之前只有 devtool 能碰到（`components/post/reading-settings.ts` 和 `ruler-settings.ts`）：字体、字号、栏宽、宽幅媒体、专注模式、标尺。这个小标签和它的面板是 `components/post/reading-sheet.tsx` 里的 `ReadingSettings`。

它相当于 Books 的 "Aa" 菜单，采用 surface 系统的锚定呈现方式：手机上是一个内容高度的 sheet，从 `sm` 起是一个从小标签前缘垂下的 popover（`ANCHORED_PRESENTATION`，[Secondary Surfaces](./system-surface.md)）。两者都不是 modal：文章在后面保持可交互，所以改动就落在你能看着的地方。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/navigation/reading-phone.png" style={{ width: "calc(40% - 0.5rem)", margin: 0 }} alt="手机上的一篇文章，阅读 sheet 已升起：Typeface、Size、Focus mode 和 Ruler；文章在它上方仍然可见。" />
  <img src="/img/docs/navigation/reading-desk.png" style={{ width: "calc(60% - 0.5rem)", margin: 0 }} alt="同一篇文章在桌面上，popover 垂在 Aa 小标签下方：Typeface、Size、Column、Wide media、Focus mode 和 Ruler。" />
</div>

左边是 iPhone 15 Pro 视口：四行，因为在这个宽度下 Column 和 Wide media 什么都切换不了。右边是 1280×860：全部六行。两者都让文章在后面保持可交互。

这些设置用的是读者的语言，而不是 devtool 的等宽字体，而且每一项只在它有作用的地方出现：

**Size** 的影响最大：`--reading-size` 是文章里每一个 `em` 所依据的那个数，改了它，整个排版一起缩放。标题保持层级，图注和代码保持与它们所注释的段落之间的关系。这就是文章的字号体系用相对值而不用绝对值的原因；正文变大而标题不动，层级一步就会塌掉。

除了两项，其他都在任何宽度下提供。**Column** 和 **Wide media** 是例外，原因是技术性的：它们各自切换的规则完全活在自己的断点里（`app/globals.css` 中的 `--breakpoint-measure`，760px，和 `--breakpoint-bleed`，900px），所以在那个宽度以下，这个控件什么都连不上。每一行用同一个 token 的 `measure:` 或 `bleed:` 变体隐藏自己，于是控件和它驱动的规则读的是同一个数，不会彼此错开。

窄屏下没有别的东西被隐藏，即使在那里用处没那么大。这些设置是单一的、全局的、持久化的：如果在手机上隐藏专注模式，一个在桌面上打开了它的读者，揣着手机时就没办法关掉它，而 devtool 不是读者会去开的门。

devtool 保留它的 Reading 模块。两个界面写的是同一个持久化存储，所以面板和读者的菜单总是一致。

## 约束

| 约束 | 原因 | 打破之后 |
|------|-----|-------------|
| 页面之间的移动使用 `next-view-transitions` 的 `Link` 或 `useTransitionRouter` | 只有它们会发起 view transition | 页面直接切换，没有交叉淡入淡出，`λhux` 跳过去 |
| 更新页面自身的查询（`?type=`、语言筛选）使用 `next/navigation` 的 router（`app/works/view.tsx`、`app/prompt/view.tsx`、`app/writing/blog-list.tsx`） | 筛选不是一个新页面 | 点一下筛选，整页交叉淡入淡出 |
| 每页只有一个 `site-identifier` | `view-transition-name` 在文档中必须唯一 | 浏览器跳过这次过渡 |
| `ask-ball` 只在 `:root:active-view-transition` 下命名 | 有名字的元素是一个 backdrop root，球自己的磨砂只能看到它自己 | 静止时只剩一个光秃秃的着色球 |
| `root` 规则保持全局 | `systems/ambient/components/solar-theme.tsx` 也通过 `startViewTransition` 提交主题切换 | 改了页面的交叉淡入淡出，主题切换也跟着变 |
| 只在某个宽度以上才起作用的阅读设置，用那个宽度的变体隐藏 | 控件和它的规则读同一个 token | 一个什么都切换不了的控件 |
| 返回链接去往上一级，而不是 `router.back()` | 它标明了自己要去哪里；历史记录可能通往站外 | 一个标着 `/writing` 的链接去了别的地方 |

## 可以自由选择的

- 页面的 `backHref` / `backLabel`、它的 `variant`，以及标题是乱码变换（`page`）还是静态（`title`）。
- 默认的 hero 退场方式：只改 `components/ui/hero-exit.ts` 里的 `defaultHeroExit`。
- 过渡的时长和曲线，连同 reduced-motion 规则一起。
- 有哪些阅读设置，只要每一项只在它不起作用的地方隐藏。

## 添加一个栏目

1. `app/<route>/page.tsx`，以及一个渲染 `PageLayout` 的视图（`page=` 配合 `lib/i18n` 里的 `<page>Title` / `<page>TitleHover` 键，或者 `title=`）。
2. 为它加一条命令面板命令（`navigate`，section 为 `navigation`，一个空闲的字母）：[Command System, "Adding a command"](./system-command.md)。
3. 指向它的链接使用 `next-view-transitions`。首页小组件加上 `href`。
4. 在上面的路由表里加一行。

## 参考：`PageLayout` 的 props

| Prop | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `page` | `ScramblePage` | - | 由 `${page}Title` / `${page}TitleHover` 生成的乱码变换标题。与 `title` 二选一 |
| `title` | `string` | - | 静态标题。与 `page` 二选一 |
| `backHref` | `string` | `"/"` | 返回链接去往哪里 |
| `backLabel` | `string` | `"λhux"` | 它显示什么 |
| `headerActions` | `ReactNode` | - | 标题下方：meta 行、筛选 |
| `pinnedActions` | `ReactNode` | - | 固定在顶部的工具栏；仅 `poetic`，替代 `headerActions` |
| `variant` | `"poetic" \| "reader"` | `"poetic"` | hero 区，或阅读 masthead |
| `className` | `string` | - | 加到 `main` 上 |
| `children` | `ReactNode` | 必填 | 页面内容 |
