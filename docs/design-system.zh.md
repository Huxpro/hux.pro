---
origin: "AI-translated from the original"
---

# 设计系统

站点的视觉语言：两种声音（Prose 和 System）、三个字体家族以及由它们组成的文字角色、一套灰阶调色板、页面栏宽，以及手指按下时的反馈。从这里读起。其中两部分有单独的页面，下文只做概述：文字颜色阶梯及其在壁纸上的表现（[Legibility](./system-legibility.md)），以及浮层表面所用的材质（[Glass](./system-glass.md)）。站点为什么看起来像一个操作系统，见 [Design Philosophy](./design-philosophy.md)；动效见 [Motion](./motion.md)。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/design-system/prose-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的一篇文章：mono 的返回链接、sans 的标题、mono 的元信息行，然后是 sans 正文，其中一个演讲标题用 serif 斜体，全部直接排在退后的壁纸上，没有卡片。" />
  <img src="/img/docs/design-system/system-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的主屏幕：mono 的标识、大号 serif 问候语、App 图标，然后是玻璃小组件卡片，带 mono 标签和 sans 的文章列表。" />
</div>

同一台手机，左边是一篇文章（`/writing/avoiding-success-at-all-cost`），右边是主屏幕。文章是一份文档：没有框，结构用 sans，serif 只出现在被强调的作品标题上，mono 只用于机器那一行（`/writing`、`sep 2018 · 6 min`）。主屏幕属于 System：问候语用 serif、按标题来排，每张卡片都是玻璃，每个标签都是小写 mono。两边都是灰阶；颜色来自壁纸。（无头 Chromium；天气小组件的数据是桩数据。）

## 两种声音

每一块 UI 要么是文档，要么是操作系统的一部分。这个选择决定了它的表面、字体，以及它如何回应按压。

| | Prose | System |
|---|---|---|
| 是什么 | 用来读的东西：文章、文档、`/writing` 列表、`/works` 的行 | 用来操作的东西：主屏幕网格、⌘K、Dock、sheet、窗口、小组件 |
| 表面 | 没有。文字直接放在页面上（离开 `/` 时放在退后的壁纸上） | 玻璃（`bg-glass…`），边框 `border-border/50`，`shadow-raised` / `shadow-overlay` |
| 字体 | `.prose-article`，或 `reading-foreground` 这一档上的某个角色；serif 只用于强调 | `TYPE` 角色；serif 用于诗意标题（`TITLE_POETIC`），mono 用于标签和元信息 |
| 选择 | 可选中；长按链接会预览 | `.system-chrome`、`.system-surface` 或 `.system-voice`（见 [Touch](./design-system.md#touch)） |
| 标题 | `TITLE_READER`，可选中 | `TITLE_POETIC`，不可选中 |

一个页面可以两者都有：索引页（`PageLayout` 的 `poetic` 变体）上面是 System 的页头（返回链接、放在 `.system-voice` 里的诗意标题），下面是 Prose 的列表。

## 字体排印

### 字体

在 `app/layout.tsx` 里用 `next/font/google` 加载，暴露为 CSS 变量，并在 `app/globals.css` 里映射到 Tailwind 的字体家族：

| 家族 | 字体 | 用于 |
|---|---|---|
| `font-sans`（`--font-sans`） | Inter，正体和斜体 | 结构：标题、列表行、正文、prose 标题。`body` 的默认字体 |
| `font-serif`（`--font-serif-latin`、`--font-serif-cjk`、`serif`） | Newsreader（正体和斜体），其次是 Noto Serif SC（400 / 700） | 强调与语气：诗意标题、问候语、`em`、引用块、文章的导语、`TYPE.voice` / `aside` |
| `font-mono`（`--font-mono`） | JetBrains Mono，正体和斜体 | 机器层：标签、日期、tag、导航、kbd、代码 |

斜体是加载的，不是合成的：拉丁文的作品标题（`*The Gay Science*`）即使在 mono 的行里也是斜体，而倾斜的 Inter 只是被错切的正体，并不是 Inter Italic。中文没有斜体：Noto Serif SC 加载时不带斜体，中文的强调是直立的 serif（`.prose-article[lang="zh"] em`、`TYPE.dek` 的 `[&:lang(zh)]:not-italic`）。Newsreader 的 x 高度比 Inter 小，所以和 sans 并排的拉丁 serif 会放大 6.25 %（`em` 和引用块上是 `1.0625em`，`TYPE.voice` 是 15px）；中文不做这个修正。

**结构用 sans，强调用 serif，机器用 mono。** 这就是三个家族之间的全部约定：serif 是某个人的思考，sans 和 mono 是系统在谈论它。

### 角色

反复出现的文字配方在 `lib/typography.ts`（`TYPE`）里统一命名：一个字号、一个家族、一个字距和墨色阶梯上的一档，合成一串 class。组件把角色和自己的布局 class 组合起来用；Legibility Lab 把同一串 class 组合进它的样张，所以两者不会走样。

![一张网格：五档文字作为行（foreground、reading-foreground、muted-foreground、tertiary-foreground、quaternary-foreground），三个家族作为列。每个格子列出这一档、这个家族上的 TYPE 角色及其字号：foreground sans 上是 rowTitle、rowHeading、mediaTitle、TITLE_READER 和 prose 标题；foreground serif 上是 TITLE_POETIC 和 dek；reading sans 上是 reading 和 .prose-article；reading serif 上是 voice 和 prose em；secondary sans 上是 body、message、caption、appLabel；secondary mono 上是 label、meta、identifier、nav、kbd；tertiary 上是 captionQuiet、aside、rowMeta、labelSm；quaternary mono 上只有 hash。](/img/docs/design-system/type-roles.svg)

每个角色，按档位（行）和家族（列）摆放。mono 从不高于 secondary，quaternary 上只有 `hash`；serif 从不用来当标签。mono 的元信息按同一条规则落在两档上：跟在标题旁边做注解时（`rowMeta`，tertiary），单独出现、本身就是信息时（`meta`，secondary）。

- 有合适的角色就用角色。没有的话就直接写 class；当这个配方反复出现时，再把它提升进 `TYPE`，而不是反过来。
- 标签按原样写，用小写 mono（`writing`、`jul 2020`、`retry`），绝不用 `uppercase tracking-wider`。专有名词保留大小写。
- mono 的 UI 一律是 `text-xs`（`labelSm`，10px，是图注条和 tag 行这种密集场景的例外）。闲置时在自己的档位上，悬停时变为 `text-foreground`。家族本身已经标明了层级；层内不再有字号或字重的层级。
- 一段文字取哪一档，以及按角色列出的"用在哪里"表格：[Legibility, Typography roles](./system-legibility.md)。

### 标题

`components/ui/header-zone.tsx` 里的两个常量，一种声音一个。调用方再加上 `text-foreground`。

| 常量 | Class | 用在哪里 |
|---|---|---|
| `TITLE_POETIC` | `font-serif text-3xl sm:text-4xl tracking-tight system-voice cursor-default` | 问候语、每个索引页的标题（Writing、Docs……）。System 的声音：不可选中。下面不放副标题 |
| `TITLE_READER` | `font-sans text-xl sm:text-2xl font-medium leading-tight` | 文章的标题。属于内容：可选中。在 `.reader-masthead` 里随读者的字号缩放（1.25× / 1.5× `--reading-size`） |

### Prose

`.prose-article`（`app/globals.css`）负责排 MDX 内容，参照 [paco.me](https://paco.me) 和 [ibelick.com](https://ibelick.com)：通篇 sans，标题靠减轻字重而不是放大来区分，serif 只用于强调。

![桌面上的排印测试文档：mono 的返回链接和元信息行、中等字重的 sans 标题、sans 正文、中等字重的 sans h2、更小的 sans h3，以及 sans 句子里一个用 Newsreader 斜体的短语。](/img/docs/design-system/type-specimen.png)

`/docs/typography-test/en`，浅色主题。各级标题的家族和字重都一样，只比正文大一级；把它们托起来的是墨色（正文 85 %，标题 100 %）。屏幕上唯一的 serif 就是那个斜体短语。

| 元素 | 规格 |
|---|---|
| 正文 | `--reading-size`（16px；在 `<html>` 上设置 `data-reading-size="small"` / `"large"` 时为 15px / 18px），行高 1.75，`text-reading-foreground` |
| `h1` / `h2` / `h3` | sans medium，`text-foreground`，1.25em / 1.125em / 1em。不大写 |
| `em` | serif 斜体；拉丁文为 1.0625em；中文为直立 |
| `strong` | Inter semibold |
| 引用块 | serif 斜体，`text-foreground/70`，无边框；一个悬挂在外、颜色为 `--muted-foreground` 的 `“` |
| 链接（`.prose-article a`、`.prose-link`） | `text-foreground`，下划线为 `decoration-ink-line`；在支持悬停的指针设备上，下划线变为 `--foreground` |
| 列表 | 列表符号在 `::before` 里绘制，颜色为 `--muted-foreground`（`•`，或序号） |
| 行内代码 | `font-mono`，0.875em，`bg-muted`，`rounded` |
| 代码块 | `bg-muted/50`，`border-border`，`rounded-lg`；token 颜色来自 Shiki 的浅色 / 深色主题，背景来自站点 |
| 表格 | 表头 `bg-muted/50`，行悬停 `bg-muted/30` |
| 图注 | 居中，0.875em，`text-muted-foreground` |

文章里的每个尺寸都是 `--reading-size` 的 `em`，每个块的外边距都是它的倍数（段落 1.5×，`h2` 上方 4×，列表项 0.5×），所以读者调整字号时，整个版面一起移动。嵌在 prose 里的组件用 `.not-prose` 退出这套规则。

### 主屏幕

| 元素 | 规格 |
|---|---|
| 系统标识（`λhux`） | `TYPE.identifier`：mono `text-xs` `tracking-wider`，secondary |
| 问候语 | `TITLE_POETIC` |
| 上下文行（"Last read *…*"） | `text-sm sm:text-base`；secondary 上的 sans，标题用 serif 斜体 `text-foreground` |
| 小组件标题 | `TYPE.label` |
| App 标签 | `TYPE.appLabel`（11px，secondary） |

## 颜色

调色板是灰阶，用 OKLCH 表示。颜色由内容带来：壁纸、封面、照片。没有强调色；不要引入强调色。现有的两种色相承载的是含义，而不是品牌：红色表示错误或破坏性操作（`--destructive`，见下文），绿色表示"正在进行"（devtool 的开关、`WidgetStatus` 的圆点）。

**文字和底色都是带透明度的墨色。** 每个主题一个 `--ink`（浅色 `oklch(0.145 0 0)`，深色 `oklch(0.93 0 0)`），每个文字和底色 token 都是它的一个百分比，所以同一个 token 叠在白底上、玻璃上、图片上都成立。文字从五档里选一档：`text-foreground`、`text-reading-foreground`（连续正文，85 %）、`text-muted-foreground`（54 / 60 %）、`text-tertiary-foreground`（32 / 36 %）和 `text-quaternary-foreground`（20 / 22 %，分隔符和其他装饰）。底色是 `bg-muted`（4 / 6 %）、`bg-accent`（7 / 10 %）和 `border-border`（9 / 10 %）。绝不用 `text-*/NN`（去选一档），也绝不用 `decoration-*/NN`（用 `decoration-ink-line`）。完整的阶梯、壁纸上的增强、浮雕、反转的 `.ink-bare` 区域，以及调校它们的 lab：[Legibility](./system-legibility.md)。

**着色从不落在墨色上。** 灰阶唯一的例外需要主动开启：**Tint: Wallpaper**（`<html>` 上的 `data-tint="wallpaper"`）把图片的主色混进玻璃底色（`--tint-glass`，14 %）以及 accent 底色和焦点环（`--tint-accent`，28 %）。文字保持中性。

**浮层表面是玻璃。** 小组件、命令面板、sheet、窗口和胶囊都用 `bg-glass`、`-strong`、`-overlay`、`-sheet` 或 `-popover` 来绘制（或者 `lib/glass.ts` 里的 `GLASS_PANEL` / `GLASS_CAPSULE`），所以一个设置（Tinted 或 Clear）就能改变它们全部的样式。在 `lib/glass.ts` 之外使用 `bg-card/NN` 和 `bg-popover/NN` 会报 lint 错误。哪个 token 用在哪个表面上：[Glass](./system-glass.md)。

剩下的输入是页面本身，以及玻璃所混合的那些实色表面：

| 变量 | 浅色 | 深色 |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.2178 0 0)`（#1a1a1a，参照 [paco.me](https://paco.me)） |
| `--card` | `oklch(1 0 0)` | `oklch(0.19 0 0)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |

不透明的 `bg-card` / `bg-popover`（不带修饰）用于不是浮层玻璃的东西：`components/ui` 里的菜单、按下的药丸按钮的实色状态。`--destructive`（`oklch(0.58 0.22 27)` / `oklch(0.704 0.191 22.216)`）是 token 里唯一的色相，用于错误或破坏性操作：失败的语音请求、错误的 bundle 网址、手机 sheet 菜单里的破坏性选项。`--primary`、`--chart-*` 和 `--sidebar-*` 是 shadcn 的原始值，供 `components/ui` 使用。

层级只有两种阴影（`globals.css` 里的 `@theme`）：`shadow-raised` 用于静止的浮动控件和悬停预览，`shadow-overlay` 用于命令面板、展开的 Live Activity、devtool。两个主题里都是黑色；深色模式下，主要靠边框来区分层次。

## 间距与布局

- **栏宽。** `--page-col: 680px`，配合 `--page-gutter: 1.5rem`（`PageLayout`，`components/ui/page-layout.tsx`）。在文章页，读者可以在 600 / 680 / 760px 之间选（`data-reading-measure`），前提是三种都放得下（`measure:`，≥ 760px）。
- **页面内边距。** `pt-16 sm:pt-24 pb-32 sm:pb-40`，内容页和主屏幕一样。
- **页头。** 索引页和主屏幕的内容从同一高度开始：`HeaderZone` 是 `h-44 sm:h-48`，导航在一个固定的 `h-11` 槽位里，标题在剩下的空间里居中。
- **Prose 的节奏。** 以 `--reading-size` 的倍数计（见 [Prose](./design-system.md#prose)）。

### 主屏幕网格

主屏幕是一个*构图*，不是一份文档：标识 → 问候语 → 小组件网格。两条规则让它在任何显示器上都自在（`app/home-view.tsx`、`components/ui/sortable-masonry.tsx`）：

- **有空间时居中。** `main` 是 `min-h-svh`，构图带有自动外边距，所以在高屏幕上（竖屏 iPad Pro、大桌面显示器）它会落在视觉上居中的位置，一旦内容超出视口，就立刻回到顶部对齐的布局。手机、平板和普通笔记本电脑不受影响。
- **更多的小组件，而不是更大的小组件。** 列数和容器宽度一起变化，让每一级上小组件都保持约 330px 宽，就像 iPad 的主屏幕（`gridScale`）：

  | 断点 | 列数 | 容器 |
  |---|---|---|
  | — | 1 | 680px |
  | `sm` | 2 | 680px |
  | `lg` | 3 | 1024px |
  | `roomy` | 3（≥ 8 个小组件时为 4） | 1152px（1344px） |

  第四列要等小组件多到能填满它才出现：CSS 多栏布局按高度平衡，几张卡片分成四列，看起来就是一个歪斜、半空的网格。`roomy:`（在 `globals.css` 里定义）是最后一级的门槛：宽度 ≥ 96rem **并且**高度 ≥ 1000px，因为目的是花掉屏幕真正富余的空间；矮的超宽屏本来就要滚动，保留熟悉的桌面布局。

## 触摸

触摸遵循 iOS 的约定，而不是鼠标的。Tailwind 的 `hover:` 受 `(hover: hover)` 限制，所以手指永远看不到悬停底色；如果没有 `active:` 状态，点一下列表行就完全没有反馈。`globals.css` 里的 class 承载 chrome 的各项策略；封面的按压效果和作品图的 token 放在一起（`lib/glass.ts` 里的 `COVER_WASH`）。运行时不根据指针类型做任何推断。

**每个触控目标都是 48px。** 手指能按到的东西，至少要有 48 x 48px 的命中区域：这就是 Ask 球和命令栏本来的尺寸，比 Apple 的 44pt 下限大一档，让拇指在滚动中的页面上也能按准。画出来的控件不必这么大：`hit-area`（`app/globals.css`，"Touch target"）以控件中心向外长出一个看不见的 `::before`，补到 48px，已经更大的盒子不动；`hit-area-y` 只在垂直方向补，用于并排挤在一组里的控件。看得见的按下底色至少 28px 高，让反馈能从盖在上面的指尖四周露出来。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/design-system/row-rest.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上静止状态的 Writing 索引页：serif 标题、EN / All 选择块，以及一列带 mono 日期的文章标题，没有行被高亮。" />
  <img src="/img/docs/design-system/row-press.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个列表，第三行被按下：'React Is Not Vue, Obviously' 和它的日期后面出现一块柔和的圆角底色。" />
</div>

手机上的 `/writing`，静止时和按下一行时（在无头 Chromium 里强制 `:active`）。这一行是 `pressable … hover:bg-muted/50
active:bg-muted/60`：右图的底色就是手指在按下那一帧得到的反馈，也是它唯一得到的反馈。

| Class | 用在哪里 | 做什么 |
|---|---|---|
| `pressable` | 列表行、链接、按钮、磁贴：任何带 `hover:` 底色的东西 | 配一个 `active:` 颜色（chrome 按钮上则配缩放）。`:active` 规则把过渡时间清零，让高亮落在**按下的那一帧**；松开时通过元素自己的 `transition-*` 缓出。同时去掉灰色的点击闪烁和双击缩放的延迟 |
| `COVER_WASH` | 媒体封面：演讲缩略图、`/works` 磁贴、内嵌播放器（`lib/glass.ts`） | 像 iOS 的照片 / 音乐 / 主屏幕：按下时在**作品图**上盖一层暗色，而不是缩放卡片。控件是 `group/thumb pressable`，这样按下旁边的封面或提交行时，不会让所有缩略图一起变暗 |
| `widget-surface` | 可点击小组件自身的表面（`WidgetShell`） | iOS 的点击底色（墨色 8 %），用于按在卡片本身上的情况；被按下的后代如果有自己的动作（链接、按钮、tab、输入框），会通过 `:has()` 排除。与 `components/ui/widget-surface.ts` 里的 `OWN_ACTION_SELECTORS` 保持一致 |
| `system-chrome` | 导航、命令栏、Dock、命令面板、编辑控件、窗口的框架、每一个 surface（`SHELL`） | 操作系统的 chrome：不可选中文字，没有长按菜单，没有灰色点击闪烁。里面的文本输入框保留光标 |
| `system-surface` | 主屏幕、404 | 整个操作系统构图不可选中，包括所有后代。否则 iOS 会跳过 `select-none` 的标签，把一次长按扩展成整页的 Copy / Find Selection。与 `useLockTextSelection` 配合使用 |
| `system-voice` | 诗意标题、小组件网格、App 标签（在一个本身是文档的页面里出现的 System 文字） | 关闭选中，其余一概不动，所以链接仍然可以预览，仍然有点击闪烁。里面的文本输入框保留光标 |
| `press-hold` | 小组件和 App 图标（通过 `usePressHold`） | 长按的视觉部分：在传感器的整个激活延迟期间，被按住的对象缓慢变大，然后弹到被拿起时的尺寸（`widget-lift`）。松手或滚动会让它缓缓复原 |

### 四种声音：chrome、surface、voice、document

一块 UI 选其中一种。这三个 class 放在 `globals.css` 里，而不是作为 Tailwind 工具类写在调用处，这样几条策略可以并排阅读，而且三者都带着文本输入框的例外：`user-select: none` 被 `<input>` 继承后，Safari 里就没有光标了，而 class 字符串里的 `select-none` 没有办法另作说明。

- **Chrome**（`.system-chrome`）：不可选中，没有长按菜单，没有点击闪烁。导航、命令栏、Dock、编辑控件、窗口自己的框架，以及每一个二级 surface（见 [Surface System](./system-surface.md#a-surface-is-chrome)）。
- **Surface**（`.system-surface`）：一整个不是文档的构图，比如主屏幕或 404。长按不能扩展成覆盖整个视口的选区，而 iOS 即使在 `select-none` 的标签上也会这样做；`useLockTextSelection` 是 JS 的那一半。里面的文本输入框仍然有光标。
- **Voice**（`.system-voice`）：只关闭选中，别的都不管。诗意的索引标题（`TITLE_POETIC`）、小组件网格、App 标签：操作系统在一个本身是文档的页面里说话。在它们上面拖动不能画出高亮，但里面的链接仍然能预览、仍然有闪烁。需要箭头光标也表达这个意思时，配上 `cursor-default`。绝不要把它放在链接或按钮内部的元素上，因为设在文字上的光标会盖过控件本来会借给它的手形指针。
- **Document**（不加 class）：prose、用 `TITLE_READER` 的文章标题、`/writing` 列表、`/works` 的行。浏览器默认行为：文字保持可选中，长按链接仍然会打开系统预览。只加上按压底色。

拖动是唯一横跨四种声音的情况。当有东西正在被拖动时（通过框架拖动的窗口、编辑模式下的小组件），`html.dragging` 会暂停整个页面的选中，这样被拖动对象下方的文档，永远不会被一个与它的文字无关的手势高亮。它是叠在四种声音之上的临时状态：拖动结束，页面就又是文档了。

明知而付出的代价：不能选中的东西，也就不能交给 iOS Translate 或 Speak Selection。这只适用于 System 文字（问候语、索引标题、小组件卡片、标签），从不适用于文章的正文或它自己的标题；而唯一一个以 System 声音说话的文章标题（问候语下的 "last reading" 那一行）是一个链接，指向那篇文章所在的页面，在那里它又可以被选中了。

### 长按

- **App 图标 / 小组件**：长按会把对象拿起来（按住 400ms，容差 10px，`components/ui/sortable-order.ts` 里的 `TOUCH_ACTIVATION`）。没有系统长按菜单，没有选中。严格地说：只有按在小组件自身的表面上，也就是点击即触发整个小组件动作的那部分，才会*开始*拿起。按在有自己点击动作的后代上（行链接、按钮、tab、输入框）则归那个控件处理：它会滚动、预览或按下，绝不会把卡片拿起来。在编辑模式下，整张卡片又都是把手，就像 iOS 的抖动模式。
- **内容**（prose、`/writing` 列表、`/works` 的行）：浏览器默认行为。长按链接仍然会打开系统预览；文字保持可选中。
- **System chrome**：不可选中，没有长按菜单。

主屏幕网格处于编辑模式时，桌面上 **Done** / **Reset** 控件浮在命令栏上方；在手机上命令栏会淡出（`components/ui/home-edit-store.ts`），控件占据屏幕底部，也就是拇指所在的地方。它们使用和其余 chrome 相同的药丸样式，没有反色填充。

## 动效

讲功能，不讲表现：动效用来表示焦点、过渡或状态变化，手段是透明度、变换、模糊和轻微的缩放。如果一个动效没有解释任何东西，就去掉它。具体模式和曲线：[Motion](./motion.md)。

## 组件

### 选择块与分段控件

`components/ui/controls.tsx` 存放站点的设置控件；不同用途之间的差别在于所处表面的声音，所以这就是唯一的参数。

- **`HeaderAction`**：表示"可以对这个页面做的事"的选择块（`/writing` 的语言筛选、文章页头的语言和 `Aa` 操作）。`pressable` mono `text-xs`，`rounded px-2 py-1`。选中时：`bg-muted text-foreground`。`segment` 静止时是 `text-tertiary-foreground hover:text-foreground`；`action` 沿用所在行的墨色，并加上 `hover:bg-muted/60`。
- **`Segmented`** / **`Switch`**，有三种色调：`system`（devtool：mono 大写 10px、细线框、开启时为绿色）、`reader`（sans、内凹的 `bg-muted` 轨道配上凸起的 `bg-background` 滑块，灰阶）和 `bare`（没有轨道，选中的字形放在 `bg-muted` 上；只用于选择器）。

### 键盘提示

`TYPE.kbd`：`rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs
text-muted-foreground`，和命令面板结果里的一样。

### 链接

- **在 prose 里**：持续显示的下划线，用 `decoration-ink-line`（见 [Prose](./design-system.md#prose)）。`.prose-link` 让文章之外的 magic link 得到同样的处理。
- **返回链接**：`SystemNav`，见下文。

### SystemNav

每一个返回链接（回主屏幕、回文章列表、回文档）都是 `components/ui/system-nav.tsx`：

- 一枚玻璃胶囊：`rounded-full border border-border/50 bg-glass backdrop-blur-xl`，`h-9`，先是 `ChevronLeft`，再是 `TYPE.nav` 的路径（mono `text-xs tracking-wide`，secondary，悬停时 `text-foreground`）。`system-chrome pressable hit-area`（画出来 36px，触控目标 48px），`hover:bg-glass-hover active:bg-glass-strong active:scale-[0.97]`。
- **路径优先**：显示目的地（主屏幕是 `λhux`，还有 `/writing`、`/docs`），悬停时乱码滚动成 `cd ..`（或 `hoverText`）。点击立即导航，从不等动画结束。

```tsx
import { SystemNav } from "@/components/ui/system-nav";

<SystemNav href="/" path="λhux" />
<SystemNav href="/writing" path="/writing" />
<SystemNav href="/docs" path="/docs" hoverText="cd ~/docs" />
```

由 `PageLayout` 放置它；页面很少需要自己挂载一个。

### 小组件

主屏幕的卡片是 `WidgetShell`（`components/ui/widget.tsx`）：

```
group/widget relative rounded-2xl overflow-hidden
border border-border/50 transition-all duration-300
bg-glass backdrop-blur-xl hover:border-border hover:bg-glass-hover
```

当壁纸被绘制进小组件时（`widgetEnabled`），卡片放弃玻璃，改为 `bg-transparent backdrop-blur-sm hover:bg-ink/5`，叠在它自己那份壁纸上。带 `href` 或 `onOpen` 的卡片可以点击，并加上 `widget-surface`（见 [Touch](./design-system.md#touch)）。

`WidgetHeader` 是 `px-5 pt-5 pb-4`，`WidgetTitle` 是 `TYPE.label`，`WidgetBody` 是 `px-5 pb-5`。页头的箭头和横条的分页圆点随卡片一起显现（`WIDGET_REVEAL`）：悬停或焦点在卡片内时显示，手指永远看不到它们。卡片本身就是点击目标，露出的下一张封面已经说明横条可以滚动，所以它们在静止时只是在重复。

## 可见改动的检查清单

1. Prose 还是 System？System 的表面用玻璃 token 绘制，并选择 `.system-chrome`、`.system-surface` 或 `.system-voice`；Prose 两者都不加。
2. 文字：一个 `TYPE` 角色，或一档（`text-foreground`、`-reading-foreground`、`-muted-foreground`、`-tertiary-foreground`、`-quaternary-foreground`）。不用 `text-*/NN`，不用固定的灰色。
3. 下划线：`decoration-ink-line`。
4. 家族：serif 只用于强调和诗意标题；mono 用于机器层，`text-xs`，按原样小写。
5. 任何带 `hover:` 底色的东西，也要有 `pressable` 和 `active:` 状态；手指会按的东西都要有 48px 的触控目标（`hit-area`）。在手机模拟里看一看。
6. 不加新颜色；着色永远不落在文字上。
7. `pnpm lint`。
