---
origin: "AI-translated from the original"
---

# Attachments 系统

一个 commit 附带的所有东西，都走同一扇门。`/works` 上的一个 commit 带着各种媒体（链接卡片、视频、幻灯片、图片、社交组件），它那一行上的每个封面、卡片和播放器调用的都是同一个 `open(set, index)`。由一份策略（`systems/attachments/lib/policy.ts`）决定这一项去哪里：在手机上，是一个能在这个 commit 的附件之间翻页的 sheet；在更宽的屏幕上，直接去站内本来就为这类东西准备好的地方（theater 的舞台、应用内浏览器窗口、路由）。

## 做好了是什么样

在手机上，点任何一个封面，都会在那一项上打开附件 sheet。它的按钮把这一项送往下一站。网页在应用内浏览器里打开，而应用内浏览器在手机上就是一个 sheet，叠在附件 sheet 之上：在网页上往下一拖，就回到这个 commit 的附件，就像手机 App 里的链接在自带的浏览器里打开，再回到它出发的那一屏。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-attachments/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上 React Compiler 那一行之上的附件 sheet：react.dev 卡片放大显示，下面是它的标题和描述、一个带箭头的 react.dev 按钮，再下面是 1 / 2。" />
  <img src="/img/docs/system-attachments/phone-browser.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一部手机按下 react.dev 按钮之后：react.dev 页面在应用内浏览器里，一个更高的 sheet 叠在附件 sheet 之上。" />
</div>

左：在 React Compiler 那一行的 react.dev 封面上真实点按一下（`hasTouch`），sheet 就停在那张卡片上，显示 `1 / 2`，因为这个 commit 附带了两项。右：它的按钮把应用内浏览器叠在上面。两个 sheet 都开着（两个 dialog）；附件 sheet 在更高的那个下面。

在桌面上，同样的点击会跳过 sheet。链接卡片直接在页面之上的应用内浏览器窗口里打开；视频或幻灯片去 theater；图片去 lightbox。

![桌面上的 /works 页面，react.dev 页面在一个居中于其上的应用内浏览器窗口里打开。](/img/docs/system-attachments/desk-window.png)

在 1280px 宽时点击 react.dev 封面：没有 sheet，页面在一个窗口里。（这里没有展示 theater：无头 Chromium 播放不了这些嵌入内容。）

在被按下之前，封面会用一个 chip 说明自己是什么；一个会去新标签页的网页也会提前说明（就是那个 chip，见下文）。

## 原理

### 策略

![流程：open(set, index) 调用 homeFor(media, ctx)，后者询问 ctx.compact。在手机上答案是 surface，一个 sheet，它的页面上的按钮调用 act 和 nativeHomeFor；在其他情况下 homeFor 直接把每种类型送往它的去处。一张表按类型列出从 sheet 按钮出发和从桌面点击出发的去处：视频和幻灯片去 theater，图片去 lightbox，指向本站的链接去 route，不能被嵌入框架的链接去 tab，其他链接去 window，社交组件在手机上去 tab、在桌面上去 surface。](/img/docs/system-attachments/routing.svg#bleed)

这份策略就是两个函数，上面的图画的正是它们俩。`homeFor(media, ctx)` 回答一次点击落在哪里。`nativeHomeFor(media, ctx)` 是去掉 surface 之后的同一个问题：这一项本身会做什么，也就是 sheet 的主按钮执行的动作（provider 的 `act`）。`ctx` 是两个事实：`compact`（小于 `sm`，640px）和 `windows`（挂载了窗口管理器）。每个去处是一个 `AttachmentHome`（`lib/types.ts`）；`provider.tsx` 里的 `send` 对每个去处各有一个分支。

| | 手机（`< sm`）：点按 | 手机：sheet 的按钮 | `sm` 及以上 |
|---|---|---|---|
| 视频 | 附件 sheet | theater（在那里是一个 PiP） | theater |
| 幻灯片 | 附件 sheet | theater（在那里是一个 PiP，和录像一样） | theater（一条 `slides` track；见下文） |
| 链接卡片，外站 | 附件 sheet | **应用内浏览器，作为叠在这个 sheet 上的另一个 sheet**；如果页面拒绝被嵌入框架，就是新标签页 | 应用内浏览器窗口，如果页面拒绝被嵌入框架，就是新标签页 |
| 链接卡片，本站（`/writing/…`） | 附件 sheet | 路由 | 路由 |
| 图片 | 附件 sheet | lightbox | lightbox |
| 社交组件 | 附件 sheet | 新标签页 | 附件 surface：从 `sm` 起是 panel，从 `lg` 起是 window |

在手机上，任何东西都先打开 sheet，而它的按钮就是原生动作：视频和幻灯片去舞台，舞台在手机上是一个 PiP；网页在应用内浏览器里打开。舞台不管长成什么样都是舞台；在这一点上幻灯片和录像没有区别，没有任何东西会把它送去新标签页。

### 应用内浏览器

应用内浏览器在每种视口下都一样：`useWindows().openUrl(url, { title })` 把页面打开在一个应用窗口里（`systems/windows`）：和应用一样的全出血框架、chrome 胶囊和菜单，以 URL 为键，所以同一个页面会聚焦到已有的窗口，而不是再开一个。窗口菜单里的 `Open in browser` 是出口。见 [system-windows.md](./system-windows.md)。

手机上的窗口就是一个 sheet（[Window System](./system-windows.md) 中的 "A phone window is a sheet"），所以在手机上按钮会把浏览器叠在附件 sheet 之上：附件 sheet 退后一步，网页在它之上升起。为此 provider 让附件 sheet 保持打开（`send` 的 `window` 分支，`if (!compact) setIsOpen(false)`）；在桌面上，窗口自成一体，surface 关闭。

### 会去新标签页的网页

页面上唯一会离开本站的按下，是应用内浏览器显示不了的那种（`policy.ts` 里的 `leavesSite`、`unframeable`）：

- **拒绝被嵌入框架的网页**（`preview.frame === "deny"`）。快照会读取 `X-Frame-Options` / `frame-ancestors`；它怎么读、怎么手动标记一个页面，见 [og-previews.md](./og-previews.md) 中的 "Framing policy"。
- **PDF**（路径以 `.pdf` 结尾的链接，`isPdfLink`），不管它的响应头怎么说：应用内浏览器是一个 sandbox 的 iframe，两个引擎都没法在里面读 PDF。WebKit 把第一页画成一张不能滚动的静态图，Chrome 则不会在 sandbox 的框架里运行它的查看器。系统自带的查看器、在新标签页里，是它唯一合适的去处。

在桌面上，这样的卡片会在点击**之前**就说明：它的封面在 strip、展开的卡片和悬停预览里都带着 `New tab` chip，tooltip 里也会加上 "Opens in a new tab"。新标签页打开时，一条 Dock 通知（`showNotice`，`systems/dock/notice.ts`，4 秒）会写出那个不肯被嵌入的域名。在手机上，新标签页刚刚盖满屏幕，底下不会再有通知。目前会离开本站的附件来自 GitHub、Gitee、Meta、web.dev、WeAreDevelopers 和 Behance，外加一个 PDF；其他所有页面在每种视口下都在窗口里打开。

### Lightbox

图片附上来通常是为了让人看清（一张海报、一张图表），而 sheet 的宽度会把它变成缩略图。它的去处是 lightbox（`systems/attachments/components/image-lightbox.tsx`，在根 layout 中挂载一次，和 surface 并列）：用 Base UI 的 Dialog 做模态（焦点、Escape、滚动锁定），放在 theater 的遮罩之下，图片适配视口、四周留出边距，用 `react-zoom-pan-pinch` 提供滚轮 / 触控板 / 双指缩放、双击切换、拖动平移，以及 `+` / `-` / `0`。缩放为 1 时是"适配"；上限是文件自身像素的两倍，所以 `url` 要写全分辨率的文件，`thumbnail` 写一张轻量的封面（tile、行内插图和 sheet 画的都是封面）。在手机上，sheet 的 `View` 按钮打开它，sheet 会让开，而不是和第二个模态争夺焦点。

### Set

一行上的每个入口打开的都是同一个东西：这个 commit 的全部附件，作为一个 set，由 `attachmentSetFor(commit, locale)` 每行构建一次，以 `attachmentSet` 往下传：

```ts
interface AttachmentSet {
  id: string;          // the commit id, the surface's session key
  title: string;       // localized commit title
  subtitle?: string;   // conference / publication / platform / company / team
  href?: string;       // /works#<hash>
  items: readonly Media[];  // every media item, in authored order
}
```

set 和 tile 是同一个集合：每个附件都能解析出一个封面（链接也一样；log 只把链接呈现为卡片），所以从 strip 到 grid 的路上没有东西会被丢掉，sheet 的 `2 / 3` 也不可能数到一个这一行从没显示过的页面。这是一条构建期的不变量：附件解析不出运行时图片时，`pnpm og:complete` 会失败，而 CI 会运行它（`.github/workflows/ci.yml`）。幻灯片自己没有 OG 标签，所以它的封面是手写的（`thumbnail`）；卡片的封面来自快照。快照会一直保留已经记录的图片，直到某次抓取给出另一张（"kept the cover we already had"，`scripts/og-snapshot.ts`），所以一个网站不再声明 `og:image` 时，不会因为一张其实还在线的图片让 `og:complete` 失败。

contact strip 里的封面（`MediaStrip`）和展开内容里的播放器或卡片（`MediaRenderer`）各自按引用找到自己那一项（`set.items.indexOf(media)`），然后调用 `open(set, index)`。标题行没有自己的门：在印出封面的地方，封面就是入口；在不印封面的 index 里，这一行只数出它们的数量（`📎 3`），打开这一行会带出 strip（`rowFormFor`）。带修饰键的点击（⌘、中键）从不拦截：每个入口都保留一个真实的 `href` 给它们用。

在 provider 之外（MDX 里的 `<Media />`，或者编辑器的检查模式，它不传 set），一切照旧：播放器在原地播放，卡片是链接，幻灯片在挂载了 theater 时打开 theater。

### Surface

`AttachmentSurface`（`id="surface-attachments"`）在根 layout 中挂载一次。它的形态取决于视口（`ADAPTIVE_PRESENTATION`）：手机上是底部 sheet，这也是它存在的原因；从 `sm` 起是 panel，从 `lg` 起是 window，宽 `min(92vw, 560px)`，留给那一种在桌面上没有原生去处的东西（社交组件）。这个窗口默认不能拖动：`surface-attachments` 列在 `DRAGGABLE_INSTANCES` 里，所以 DevTool 可以打开拖动，但它在 `DRAGGABLE_DEFAULTS`（`systems/devtool/provider.tsx`）里没有条目，而壁纸窗口和播放列表窗口有。

里面是组件那一套 strip：`components/ui/snap-pager.tsx` 里的 `useSnapPager` 和 `PagerDots`，和 Featured Talks、featured-stack 组件翻页用的是同一个 primitive。每个附件一页，全宽，一页一页地吸附，下面是圆点和 `2 / 3` 计数。一场演讲有视频、幻灯片和一篇文章，读起来就是一件事的三个面，滑一下就能在它们之间切换，不必回到那一行。surface 在第一次绘制之前就落在被点的那一页上。

每一页（`attachment-page.tsx`）把附件放大显示：视频或幻灯片是一张 16:9 的封面，链接卡片整张显示，图片，或者实时的社交组件。下面是一组用 theater 外观的操作按钮（`GLASS_CLUSTER`、`GLASS_ACTION`，主按钮在玻璃胶囊上，`systems/theater/lib/chrome.ts`）：

| 这一页 | 主按钮 | 旁边 |
|---|---|---|
| 视频、幻灯片 | `Watch` / `Slides`，播放标记或幻灯片图标，在胶囊上 | 来源的域名 ↗ |
| 图片 | `View`（放大镜图标） | 文件的域名；本站托管的文件则是 `Open original` |
| 指向本站的链接 | 文章是 `Read`（书本），其他栏目是 `Visit`，在胶囊上 | 无 |
| 指向外站的链接、社交组件 | 域名 ↗，一个真实的链接，这一行唯一的一个 | 无 |

外站的网页不管是在应用内浏览器里打开还是在新标签页里，都打扮成一个出口：它的地址加上箭头。这一页的封面不带 chip（见下文）。视频页和幻灯片页还会印出 commit 的标题和场合。

surface 的尺寸取决于内容（`fitContent`）；轨道是一个 flex 行，所以每一页都和最高的那一页一样高，滑动时 sheet 保持不动。屏幕外的页面是 `inert`，以轨道停下的那一页为准来计算。

### Theater 里的幻灯片

幻灯片是一场演讲留下的另一样东西，它和录像属于同一个舞台。`Track` 是 `VideoTrack | SlidesTrack`（`systems/theater/lib/types.ts`）：`slides` track 把幻灯片的 URL 放进舞台的 iframe，保留 theater 的标题栏、上一个 / 下一个和播放列表侧栏，没有播放控制（reveal.js 在框架里接管方向键）。它和舞台上的其他东西一样，最小化到 Live Activity。胶囊既是听东西的地方，也是让一份幻灯片保持打开的地方，而且它分得清两者：对幻灯片来说，第三个视图是 `Minimize`，图标加文字，在 theater 栏、PiP 栏和胶囊里都一样（`SurfaceSwitch` 直接从 theater 读取 track），永远不是 `Audio`；胶囊在幻灯片图标下写 `slides`，而不是在均衡器后面写 `watching`。

舞台有**两个库**，从不同时显示。录像在录像之间浏览：`TheaterRegistrar` 注册的演讲专辑（React / Lynx / Personal），外加一个临时专辑，放那些不属于任何专辑的视频。幻灯片在幻灯片之间浏览：`buildSlidesAlbum(locale)` 是 log 里的所有幻灯片，按日期排序，注册为 Slides 库；打开任何一份幻灯片都会落在这个库里的那一份上，其他每一份都只隔一张卡片。`useTheater().openMedia(media, meta)` 按媒体的类型挑选库；附件系统和独立的 `<Slides />` 封面都经过它。

## 封面戴的 chip

站内每个封面在被按下之前都会说明自己是什么。`MediaMark`（`components/log/media/media-mark.tsx`）是唯一的一套词汇，也是唯一画它的东西：**封面左下角的一个 chip，带一个图标和一个词**。它和壁纸 tile 标示 Live / Preset 用的是同一个 chip（`ARTWORK_CHIP`，`lib/glass.ts`），所以图片上的 chip 不管图片在哪里都长得一样。

| 封面 | chip |
|---|---|
| 一段录像（视频） | `▶ YouTube` / `bilibili` / `Vimeo`：平台名，所以一场演讲会说明它录在哪里 |
| 放在网页上的录像（一场 GitNation 演讲） | `▶ GitNation`：同一个 chip，写的是托管方的名字 |
| 一份幻灯片 | `Slides` |
| 拒绝被嵌入框架的网页，不管是什么类型 | `↗ New tab` |
| 网页、文章、图片、社交组件（只在悬停预览里） | `Web`、`Writing`、`Image`、平台名。本站的其他栏目（`/works`）不戴：它的卡片会印出自己的名字，而 `Web` 会暗示它要离开 |

![Attachments Lab 中悬停预览这一层的三个封面：WeAreDevelopers 页面戴着 New tab，GOSIM Paris 页面戴着 Web，一篇文章戴着 Writing。](/img/docs/system-attachments/lab-chips.png)

lab 在预览这一层展示的词汇，这一层每种类型都有标记，chip 是凸显的：拒绝嵌入的网页写 `New tab`，网页写 `Web`，文章写 `Writing`。

谁戴 chip 由 surface 决定，分三层：

| 在哪里 | 谁戴 chip |
|---|---|
| `/works`（strip、展开的卡片、行内播放器、幻灯片封面） | 录像、幻灯片，以及会离开的网页。卡片本身就是提示（域名、标题），每张卡片都戴 chip 只会是噪音 |
| 悬停预览 | **每一种**（`markFor` 的 `all`）：预览是一瞥，chip 就是它的说明文字 |
| 附件 sheet 的页面、首页组件的封面、theater 的侧栏 | **都不戴**：它们都已经在封面旁边说明了这是什么（一个带文字的按钮、组件的那一行字、侧栏的标题），chip 只会重复 |

chip 说的是这个东西*是*什么，从不说它在哪里打开。所以一段 GitNation 录像戴着播放 chip，却在应用内浏览器里打开而不是在舞台上：它是一段录像，其余的由上面的策略决定。`markFor(media, locale, { all, leaves })` 从一项上读出 chip；`leaves` 来自 `homeOf(set, i) === "tab"`，所以只有在点击本身就会打开新标签页的地方它才为真（在桌面上；手机上的点按打开的是 sheet）。`mediaKindOf` 读出类型，供 sheet 按钮的图标和 lab 使用。

两种分量。在页面里的封面上，chip 是轻的（`ARTWORK_CHIP_REST`）：一排封面不该变成一排图章。封面被悬停时 chip 升到完整的样子，被按下时也一样，因为手指从不悬停。chip 从它所在的锚点、按钮或 `[data-cover]` 上读这两种状态，所以没有封面需要是一个 `group`。预览里的封面本来就是悬停之后的状态，所以一开始就是凸显的（`raised`）。

三种尺寸：`mini` 用于 contact strip 的 tile，chip 保留图标、去掉文字（就像壁纸 tile 的小徽章）；`compact` 用于 grid 的 tile、侧栏缩略图和紧凑的卡片；`default` 用于完整的封面。tile、链接卡片、行内视频的外壳、幻灯片封面和悬停预览的海报都从这里拿 chip，封面上没有别的东西说明它是什么。没有封面可戴的卡片，把 chip 放在它的说明行里（`inline`）。

## /works 的三种形态

页面印出一个 commit 的多少内容，是三种*形态*之一，而一种形态是几个独立原子的预设，而不是一套自己的布局（`ROW_FORM`，`lib/log-view.ts`）：文字印不印（描述和评语，`none` · `full`；没有截断），用哪种附件对象（`none` · `covers` · `grid`），笔记印不印（`details`），作者字段印不印，悬停时有没有预览。工具栏上的控件把每一行重置为某个预设；某一行自己被按下时会翻转它的笔记（在 index 里，因为没有文字和图片需要保持不动，也会把它们一起带出来）。按下也不会多出任何东西的行，就没有按下这回事：没有底色、没有指针手势、没有 `role="button"`。带 git 名字的旧链接（`oneline`、`stat`、`patch`）仍然能解析，作为别名。

feed 正在退场。只有当 DevTool 的 Works 模块打开它时（`worksFeed`，一个保存的设置，默认关闭），控件才会提供它；关闭时，`?view=feed` 链接按默认形态来读，URL 保持原样。

| 形态 | 文字 | 媒体 | 笔记 | 作者 | 预览 | 读法 |
|---|---|---|---|---|---|---|
| `index` | 无 | 无 | — | — | ✓ | 总览：每个 commit 一行，整段职业生涯两屏看完 |
| `covers`（默认） | 全部 | `covers`：112px 的 tile，图标 chip | 按下 | — | ✓ | 作品就在屏幕上，靠滚动来读：读者该知道的东西不需要等一次按下 |
| `feed` | 全部 | `grid`：半栏宽的 tile，写出说明文字 | ✓ | ✓ | — | 全部内容，没有任何东西藏在悬停或 sheet 后面。按下会折起一行的笔记。 |

**什么是读到的，什么是要来的。** 这道分界在数据里一次划定，对每个 commit 都一样。封面上方是滚动的人应当知道的：`description`（作品是什么、我在其中做了什么、它为什么重要，本身完整，并且短到可以整段印出），以及 `commentary`，我自己对它的一句话，用旁注的衬线体放在下面。封面下方、在这一行的按下之后，是长篇：`details`（会议公布的演讲摘要、论文的具体信息、整段引用的原文、一条存档说明）。需要截断才放得下的 description，里面混进了 `details`；读者判断这份工作所需要的事实，不放进 `details`。

**名字原地成链接。** 这三个字段可以给它们提到的东西加链接，`[words](target)`（lib/inline-links.ts）：一个 URL 或站内路径、一个 commit（`commit:lynx-framework`）、它的某一项媒体（`commit:wasmcert#1`），或者一个职位（`role:meta-engineer`）。这一行把每个链接渲染成一个 magic link（`InlineText`），所以句子里提到的网页会预览出它的卡片，并在封面上的网页会打开的地方打开；一个只是代表那个网页的封面就可以从 strip 里撤掉。其他所有印出 commit 的地方（预览、书架、组件、紧凑的行）拿到的都是纯文字。快照会抓取以这种方式链接的页面。

**装饰从不把关按下。** `--pretty=fuller` 的那些字段是出处信息：章节点出时代，标题行点出团队。它们还属于笔记的时候，每一行都因为它们而可以按下，而大多数按下除此之外什么也带不出来。现在它们在静止时一样都不印（连过去给单个封面署名的 `@handle` 也不印），只在被要来时作为**签名**出现（TimelineCommit）：`commit` 和 `Author:`，到哪里都是这两个。没有 `Role:`。`Author:` 打开身份卡片，卡片上有职位、任期、团队和地点；而每一行都写一个职位，会让 Lynx 那几年一路往下读到十一遍 `Architect @ ByteDance`，重复 handle 和团队早已点明的公司。

- **在桌面上**，hash 本来就挂在页边。悬停或聚焦一行（经过 140ms 的意图停顿，免得指针扫过页面时让每个页边都闪起来）会让 hash 亮一级，并从它下面落下 `<author>`（`MarginFields`），12px，用 muted 那一级，右对齐到 hash 的边缘，在它下方 6px。栏里的东西都不动。它就是身份卡片的触发器。
- **在任何地方，点按**都能切换它。它是个彩蛋，所以没有任何东西宣告它的存在：点这一行在 gutter 里的**标记**、它的**团队**（`Lynx @ ByteDance`、`M.S. Capstone @ RIT`，手指会去点的那段纯文本场合；本身是链接的场合保留它的链接），或者它的**日期**，也就是 commit 自己的时间戳。它们都不会因此改变外观，这一行也不会为此显得可以按下。在 `lg` 以下没有页边，这一行会展开成带标签的竖排，hash 作为其中的 `commit` 字段；在桌面上，点按会把页边里的签名钉住。index 的一行太短，放不下页边，所以在那里点按也是展开带标签的竖排。
- **动效**（globals.css，"The signature"）：每一行都由一个扫过它自身盒子的裁切来显示，从不用 transform（transform 过的图层会重新光栅化 12px 的等宽字，导致闪烁）。在桌面上，作者从 hash 下面落下来。在手机上，这一行展开到竖排的高度（grid 行从 `0fr` → `1fr`），标记点一下头，各字段从左到右打出来，间隔 70ms，每个值比它的标签晚一拍，就像 `git log` 打印它们那样。签名展开期间，它所来自的那一行元数据保持点亮。离开是一次快速淡出。减少动态效果时只保留淡入淡出。

feed 直接印出这些字段，所以没有彩蛋。这一行的地址是 hash，而且只有 hash：桌面上是 gutter 里的那个，手机上是竖排里的 `commit` 字段。日期一度是手机上的永久链接，那时竖排丢了它的 `commit` 字段；点一下日期页面就滚动，带来的惊讶多于用处，所以它又变回了纯文本。旁注是同一条规则在行这一级的另一半：一整个次要的 commit，折叠成安静的一行，直到被按下。

### 标题行

一行上的每个事实，在每种形态、每种状态下都只有一个位置，展开一行只会在标题行下方增加内容。描述上方的东西都不动。这一行是 `hash · mark · title [· 中文] ··· [📎 n] venue date`：场合（演讲的会议、媒体报道的平台、项目的团队）放在标题行上、日期之前的一栏里，行的右侧紧贴边缘排列，所以当展开的行用封面替换掉计数时，场合和日期留在原处。团队印得很节制，它的 `@ Company` 在同一家公司的一串项目里只出现一次：先是 `React Core team @ Meta`，然后是 `PLR`。

有自己页面的场合（演讲的会议）是一个指向它的 **magic link**，从不是一个光秃秃的出口。在指针下它会预览出页面的卡片，按下后去的地方和封面上的网页一样：手机上是抽屉，桌面上是应用内浏览器，只有拒绝被嵌入框架的页面才去新标签页。它以前会带着一个 `↗` 去新标签页，那是标题行唯一一扇属于自己的门。即使是会议的首页也值得留着，但要放在它的卡片后面，而不是一跳了之。它的卡片在快照里（`logHrefs`，scripts/og-snapshot.ts）；抓取不到的页面没有预览，保留它的抽屉。

在 `@md` 以下，这一行没有放一栏的空间，于是同样的三样东西变成一个 *eyebrow*：标题上方的一行等宽字，与标题隔一级（6px），就像报纸上压在大标题上方的引题。场合在左边，`📎 n` 和日期紧贴右边缘。没有任何东西被截断来塞进去，标题和它的那句话仍然挨在一起。不管什么视口、折叠还是展开，场合都不会出现在标题下面。eyebrow 的各格是顶部对齐的 16px 行，而不是基线对齐，所以展开的行让出的 `📎 n` 不会把场合挤动。标题的字重也由形态决定（形态印出正文时用 `rowHeading`，index 里用 `rowTitle`），从不由按下决定：一个随着行展开而变粗的标题，曾是这一行上唯一会动的东西。没有元信息行：标题和它的那句话之间没有任何东西，描述放在高一级的位置（`TYPE.caption`，muted），读起来就是这一行的第二层。静止时没有东西给这一行署名：handle 属于签名（见上文），通过悬停，或者点按标记、团队或日期来要。

### 附件对象

每个封面都是一个 tile（`AttachmentTile`，`components/log/media/attachment-tile.tsx`）：一张 2:1 裁切的图，加上它的 chip。2:1 就是这些封面本来的比例：OG 图是 1.91:1，视频海报上下各损失一窄条，而预览和 surface 会把它完整显示出来。所有类型用同一个比例，才能让视频和卡片并排，让一排 tile 和下一排对齐。形态决定尺寸和说明文字，从不决定形状。

**strip**（`MediaStrip`，`covers`）是排成一行、没有说明文字的 tile：在这个尺寸下 chip 就够了，其余的交给预览。当封面比栏宽时，strip 会延伸到页面的出血区（`--page-bleed`，globals.css：从栏的边缘到视口的边缘），所以封面只会被屏幕边缘截断：在手机上，strip 一直延伸到 gutter 的边缘并可滚动；在桌面上，它伸进页边，三个封面正好放下。在页面中间被截断的一行看起来像个错误；同样的一行伸到边缘之下，读起来就是一条后面还有更多的侧栏。strip 这一行只属于封面，没有东西给它署名。

**grid**（`AttachmentGrid`，`feed`）用的是这一行自己的 strip 项：timeline 直接把 `stripItems` 交给它，没有封面的东西（实时组件）交给它下面的 `MediaRenderer`。说明文字在这里写出来（它来自哪里、它是什么、它的简介），这里也没有什么需要第二步。chip 在录像或幻灯片上只剩下图标（播放标记是一种可操作的提示，不是信息），卡片上则没有 chip。点击执行的是这一项的原生动作（`act`：舞台、应用内浏览器、页面），从不是附件 sheet，那等于在已经显示在屏幕上的东西上再打开一个抽屉。

封面和说明文字是同一个控件（`AttachmentTile` 的 `footer`）：同一个 `<a>`，所以按标题会让图片泛起底色、文字变暗（`COPY_WASH`：透明度，也就是封面按下的那套语言）。说明文字不是一个碰巧做同样事情的第二个点击目标，也不是这一行的折叠把手。折叠是标题行上的一层 muted 填充；打开附件是一次变暗。两者混在一起，按下的感觉就会一样。在 `covers` / `index` 里手动展开的行，仍然从它的标题行折叠；展开的内容（`data-row-body`）会拦住这次点击，并显示默认光标，所以描述、笔记和说明文字看起来不像折叠目标。feed 本身不按行折叠：每个 commit 都已经展开，离开它是在工具栏上换一种形态。在手机上，录像或幻灯片是例外：封面原地播放，它下面的栏（`PiP`）把播放交给舞台，所以那一行是标签，不是第二扇门。

- 在桌面上，单位是半栏宽，不管有几个。这里借鉴的 feed（X、LinkedIn）在这条规则上意见一致：媒体有固定的占地面积，数量改变的是怎么铺，从不改变帖子有多大。两个就是两个带说明的 tile；单独一张卡片是 tile 加上旁边的说明文字（聊天 App 给链接打印的那种展开预览）；单独一段录像或一份幻灯片旁边没什么可说的，就像视频帖那样占满整栏。
- 在手机上，feed 就是 feed：一个接一个，每个都跨过页面 gutter 和侧栏那一列，从边缘铺到边缘（`PHONE_BLEED` 包住的是裁切的图，而不是说明文字；在 `w-full` 的图片上用负 margin 只会把一个栏宽的封面挪个位置）。封面和说明文字仍然是同一个控件；点卡片下面的标题，和点图片是同一扇门。录像或幻灯片原地播放（`InlinePlayable`：一张 16:9 的封面，换成平台的播放器或幻灯片本身）。它下面的栏从一开始就在，所以按下播放不会让任何东西移动。这一栏写出这一项的名字，并带一个控件 `PiP`，把播放交给舞台（`act`），给想继续往下滚的人用，同时停掉行内播放器，保证两者不会同时播放。这一项在舞台上期间，它在 feed 里的位置会用一层底色和封面上的 PiP 标记说明这一点，按下它就把播放拿回来。这个状态从 `useOptionalTheaterStage` 读取，它带着舞台上正在播放的东西和它的几扇门，却不带完整 theater context 里那个不停走动的时钟。卡片则去它的原生去处。

在这之前，单独一张卡片是全宽、按原始比例，视频是全宽、16:9，任意两个就是一条半宽的滚动侧栏，每个 tile 的高度由发布方的说明文字决定，所以每一个展开的行形状都不一样，没有两条右边缘能对齐。

每个 tile 都由一个 `TileSlot`（`resolveTile`）画出来：它在 set 里的位置、它的点击落在哪里、它的 chip 和说明文字，由 strip 或 grid 对每一项解析一次，而不是每个 tile 每次渲染都解析一次。

**项目的演讲**（`lib/works-talks.ts`）。一场演讲讲的是它 `attachedTo` 的项目。只筛选项目时，演讲那几行不在读的范围内，所以项目在它的 strip 末尾戴上这些演讲的录像（或幻灯片），每个都用等宽字配上它的场合：这是 strip 里唯一带说明文字的封面，因为项目封面中间的一段录像需要说明它是在哪个舞台上讲的。这个封面在项目的 set 里打开，所以它在哪里播放，和它自己那一行的封面一样。其他所有读法都让演讲保持为独立的行，带着连到项目的连接线。DevTool 的 Works 模块还在试用另外五种排法（`worksTalks`）：封面，演讲行保留或被吸收；项目文字下面的一个 git trailer（`Presented-at:`）；标题行上的 refs（`git log --decorate`）；以及把演讲折叠在它的项目下面。

### Gutter

从 `lg` 起，hash 和侧栏挂在页面的左页边里（`TimelineCommit` 中的 `GUTTER_PULL`）：这一行向左拉出 gutter 的固定宽度，所以标题、描述和附件对象都落在页面栏自己的左边缘上，与时代标记以及其他每个页面的正文对齐。在 `lg` 以下没有页边可挂，gutter 留在栏内；在这一行的 `@sm` 以下，hash 照旧隐藏。

## 滚动这个页面的代价

壁纸是一个在整个页面下方动画的 canvas，所以每一帧本来就带着一次合成；log 往上放的东西，决定了这一帧到那时是否已经用完。三条规则让 feed 在手机上滚得动：

- **封面的 chip 上不用 `backdrop-filter`。** 过去每个封面都在 chip 下面加了一层 2px 的模糊：二十多个 backdrop 根在全出血的位图上滚动。一层半透明填充看起来一样，代价只是一次填充。
- **行内容上不用 `content-visibility`。** 试过，配上 24rem 的固有尺寸，花掉的比省下的多。它是这里唯一一条从没按时间测量过、只按它跳过了什么来衡量的规则。在 402px 的手机上每行 380–530px，所以页面会随着行进入范围不断改变尺寸（一次滚动中变了 32 次，17.0k → 20.1k），而每一行进入范围就是一次布局：**一次滚动中布局耗时 248ms，不用它是 36ms；布局 147 次，不用它是 67 次**（Chromium，4 倍 CPU 降速，脚本驱动地滚完手机上的 feed）。在这个降速下它为首次加载省下约 200ms，而在 iOS 上，尺寸变化比慢更糟：滚动视图对页面高度的认知落后于页面本身，所以手指往上推时会撞到一个已经不在那里的底部。它要跳过的工作，本来就已经通过别的方式延迟了：封面上的 `loading="lazy"`、`decoding="async"`，以及在指针无法悬停的地方不建预览树。
- **预览面板只在预览时存在。** `Cursor` 过去为每一行都挂着一个 fixed、带 transform 的面板：在桌面上，还没有人悬停，就已经有五十个合成层。空闲时，它只是一个隐藏的 span。

还有其他几条，每条都不大：封面在主线程之外解码（`decoding="async"`）；吸顶的时代胶囊的磨砂模糊只在 `sm:` 及以上；只是把东西送上舞台的组件都不订阅那个不停走动的 theater context（`useOptionalTheaterStage`）；在指针无法悬停的地方不建预览树（行的、strip 的、签名的）；连接线只观察它自己的容器。PR 里的 trace 显示了剩下的开销去了哪里：壁纸的 canvas，每个页面都一样要付。

## 悬停封面

行的磁吸预览（跟随光标的面板，展示一个折叠的行里装着什么）在印出 strip 的形态里退场，因为这一行现在会印出它的封面；在 feed 里则完全不出现（`ROW_FORM.peek`）。取而代之的是每个封面各自预览，用同一套语言（`components/log/media/media-peek.tsx`）：把指针停在 contact strip 的缩略图上，链接卡片会预览成迷你 OG 卡片（域名、标题、描述），视频、幻灯片或图片则是它的海报，每个都戴着凸显的 chip，此外什么都没有：没有说明文字，没有笔记。`PeekThumb` 和 `PeekCard` 就在那里；`index` 形态里那一行叠起来的卡片堆也是用这两个构建的，戴着同样的 chip（`PeekItem` 为此带着它的 `media`），所以两种形态的预览一模一样。预览的图片怎么定尺寸（`PeekCover`）见 [og-previews.md](./og-previews.md) 中的 "Cover sizes"。

## Lab

**`/lab/attachments`**，Attachments Lab（`noindex`），是这个系统的 devtool，就像 `/lab/legibility` 之于阅读界面。上面没有一样是 mock：

- **Vocabulary**：在 log 自己的封面上展示各种尺寸的 chip，分 `/works` 和预览两层，GitNation 的情况也在其中。
- **Render paths**：一个 commit 的媒体被画出来的每一个地方、按下后送往哪里，以及对应的文件（`RENDER_PATHS`，`app/lab/attachments/paths.ts`）：strip、桌面 grid、手机 grid 和 `InlinePlayable`、`MediaRenderer`（单个、侧栏、胶囊）、各种预览、附件页、theater 的侧栏缩略图、MDX 的 `<Media />`，以及首页的 Featured Talks 组件。
- **Homes**：把策略列成一张表，实时读取 `homeFor` / `nativeHomeFor`，上下文可以钉住（是不是手机、有没有窗口管理器）。
- **Specimens**：用生产组件渲染的上述各个界面。
- **Try it**：走真实 provider 的按钮，并实时显示当前的 surface 栈和打开的窗口。在手机上，这里可以看按钮怎样把浏览器叠在附件 sheet 之上。

![lab 的 Homes 表，视口钉在手机：每一行的点按都是 sheet；按钮把视频和幻灯片送去 theater，GitNation 录像和网页送去 window · sheet，拒绝嵌入的网页送去 tab，文章送去 route，图片送去 lightbox。](/img/docs/system-attachments/lab-homes.png)

钉在手机上的 Homes 表。每次点按都是 `sheet`；按钮那一列是 `nativeHomeFor`，`window · sheet` 就是作为叠放 sheet 的应用内浏览器。不钉住、在 1280px 下，点按那一列就变成按钮那一列。

`/lab/attachment`（以及旧的 `/editor/attachments`）会重定向到这里。标题就是各个 lab 的下拉菜单（`systems/lab/catalog.ts`）。

## 添加一种类型

1. 把它加进 `Media` 联合类型，并给它一个 `is…Media` 类型守卫（`lib/log.ts`）。
2. 在 `lib/policy.ts` 里说明它在哪里打开，两个函数都要写。
3. 如果它的去处是 theater 或 lightbox，在 `send`（`provider.tsx`）的对应分支里让它通过类型守卫。
4. 在 `media-mark.tsx` 里说明它的封面戴什么，`mediaKindOf` 和 `markFor` 都要写。
5. 在 `attachment-page.tsx` 里给它一个页面；没有页面，sheet 对它什么都不显示。
6. 如果它能在舞台上播放，给它一个 `Track` 类型，并教会 `mediaToTrack`（`systems/theater/lib/albums.ts`）构建它。
7. 在 `RENDER_PATHS` 里给它一行、在 lab 里给它一个 specimen，然后在那里检查：表格（钉在手机和不钉）、specimens、按钮。
8. 如果它会画封面，`pnpm og:complete` 必须仍然通过。

## 参考

```
systems/attachments/
├── index.ts                          # the public surface
├── provider.tsx                      # AttachmentProvider, useAttachments(): open / act / homeOf / send
├── lib/
│   ├── types.ts                      # AttachmentSet, AttachmentHome
│   ├── policy.ts                     # homeFor / nativeHomeFor, leavesSite, isPdfLink, linkTarget
│   └── set.ts                        # attachmentSetFor(commit, locale)
└── components/
    ├── attachment-surface.tsx        # the paged sheet / panel / window (AdaptiveSurface)
    ├── attachment-page.tsx           # one attachment, large, with its native action
    └── image-lightbox.tsx            # an image, letterboxed, zoomable (the `lightbox` home)

components/log/media/
├── media-mark.tsx                    # MediaMark, markFor, mediaKindOf: the chip
├── attachment-tile.tsx               # AttachmentTile, TileSlot, resolveTile: one cover
├── media-strip.tsx                   # MediaStrip: the `covers` form's strip
├── attachment-grid.tsx               # AttachmentGrid, InlinePlayable: the feed's grid
├── media-renderer.tsx                # MediaRenderer: players and cards in a body or MDX
└── media-peek.tsx                    # PeekCard, PeekThumb: the hover peek

app/lab/attachments/                  # the lab; paths.ts is RENDER_PATHS
```

`<AttachmentProvider>` 挂载在 theater 和窗口的 provider 之内；`<AttachmentSurface />` 和 `<ImageLightbox />` 在 `app/layout.tsx` 中各挂载一次。

### 历史

过去每种类型各有各的打开方式。视频去 theater。幻灯片去它自己的 lightbox（`SlideModal`），而在手机上它干脆放弃，打开一个新标签页。卡片是一个普通的 `<a target="_blank">`。contact strip 里的封面是一个链接；同一个封面在展开的内容里却是一个播放器。在手机上，点一张缩略图，要么离开本站，要么往页面上丢一个缩略图大小的画中画。站内已经有 theater、窗口管理器和路由；缺的是一条把附件送到正确去处的规则，以及一种适合手机的形态。`SlideModal` 和 `SlidesPlayerProvider` 已经删掉了。chip 取代了三套由手里拿着封面的那个组件就地画出来的词汇：任何能播放的东西上的播放圆盘、幻灯片上压在圆盘之上的说明 chip，以及会去新标签页的卡片下面的一行文字。
