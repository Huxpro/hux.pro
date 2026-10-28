---
origin: "AI-translated from the original"
---

# About 与 Badge

新访客最先遇到的那层界面，以及在行文中点名一件我做过的东西的内联 badge。

## 做好了是什么样

桌面上第一次访问 `/`：页面仍在面纱之下，文字在正中排成一栏，一圈光沿着屏幕边缘流动，而唯一在邀请你按下的东西是正在呼吸的 **Reveal**。

![桌面上首次访问时浮在主屏幕之上的 About：面纱是一层浅色玻璃，下面是模糊的页面；问候语用衬线体，一段带有公司和项目 badge 的文字，两条等宽字体的脚注，文字左边缘处是带 esc 键的 Reveal 按钮，右边缘处是另一种语言的切换，屏幕边缘环绕着一圈彩色光晕。](/img/docs/system-about/first-visit-desk.png)

1280×860，无头浏览器。文案里的每一家公司、每一个项目都是一个 badge，戴着它所在网站的图标；脚注用的是注释字体；离开的方式挂在文字的左边缘，作为它们的最后一行。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-about/first-visit-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上首次访问时的 About：问候语右侧是中文切换，文字铺满屏幕，溢出处在底部渐隐，底部居中的 Reveal 按钮随光晕一起绽放，光晕环绕着屏幕的圆角边缘。" />
  <img src="/img/docs/system-about/badge-drawer-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个 About 在点按 Lynx badge 之后：标题为 Lynx Framework 的附件抽屉升到 About 之上，里面是 lynxjs.org 的卡片和一个 lynxjs.org 按钮；问候语和光晕仍在它上方和四周可见。" />
</div>

手机（iPhone 15 Pro 的视口，无头浏览器，所以没有 bezel，也没有安全区内边距）。左：文字占据整个屏幕，因为溢出而在底部渐隐；Reveal 始终居中在底部。右：在 About 里点按一个 badge，附件抽屉会在它*之上*打开，文字留在下面，直到抽屉把那样东西送去别处。

## 原理

```
systems/about/
├── index.ts                     # AboutProvider, useAbout, useOptionalAbout, AboutSurface (client-safe)
├── provider.tsx                 # open / dismiss / close, first visit, Escape, the z-order table, useOverAboutZ()
└── components/
    ├── about-surface.tsx        # the veil, the words, the foot, the glow (systems/glow); mounted once in app/layout.tsx
    ├── about-copy.tsx           # server: content/about/<locale>.mdx → the words
    ├── about-language.tsx       # the other language's switch
    └── footnote.tsx             # <Fn>, <Footnotes>, <Footnote>

content/about/{en,zh}.mdx        # the copy
content/badges.json              # authored: which site a commit or identity stands for, vendored icons, manual cards
content/badge-icons.json         # generated: each site's official icon (pnpm badges:snapshot)
lib/badge-site.ts                # the rule for "which site", shared by component and script
scripts/badge-icon-snapshot.ts   # pnpm badges:snapshot / badges:check
scripts/magic-link-tags.ts       # reads every <Badge> / <MagicLink> in content/** and docs/**

components/magic-link/
├── resolve.ts                   # props → target, label, icon, href (data only)
├── magic-link.tsx               # <MagicLink /> (and the badge dress), <MagicLinkHost />
└── server.tsx                   # ServerMagicLink / ServerBadge / ServerProseLink: posts and site sections resolved
app/about/                       # `/about`: the home screen with the About up
```

## About

个人网站通常把“这是谁的网站”写在一个需要你专门去找的页面上。这个网站是一个操作系统，而操作系统会在第一次启动时自我介绍。所以 About 是一层浮在访客落脚的任何页面之上的界面，而不是一个独立的页面。

| | |
|---|---|
| 首次访问 | 页面加载 700ms 后（`FIRST_VISIT_DELAY_MS`），等下面有东西可以模糊时，升到页面之上。无论以哪种方式收起它，都会把访客标记为已见过（localStorage 里的 `hux_about_seen = "1"`）；在此之前刷新会再次显示。存储被禁用视为已见过：绝不纠缠。在 `/lab` 和 `/vitre` 下的路径（`QUIET_PREFIXES`）不出现，那些是工具。 |
| `/` `O` | 命令面板的斜杠命令，任何页面都可用（在输入框之外按 `/` 会打开斜杠列表；`systems/command/actions.tsx` 里的 `about` 设了 `key: "o"`）。这是 About 唯一的快捷键。没有单独的 `O`：一个在每个页面都被占用的单字母键容易误触，而 About 也没那么常用。 |
| ⌘K | 搜索里的 `About`。地理位置从 `O` 改到了 `C`。 |
| λhux | 主屏幕上的标志，绕远路的入口。悬停直到它说出自己的名字（*The λHUX OS*），然后点击这个名字。在手机上，按住标志直到名字完整显示，About 就会升起；一圈画在手指外侧的圆环会随着按住的时间逐渐合拢（`components/ui/hold-ring.tsx` 里的 `HoldRing`，与搜索按钮长按呼出 devtool 共用；`components/home/scramble-identifier.tsx`）。两种方式都去往 `/about`。 |
| `/about` | 用来分享的地址：主屏幕，About 已经升起（`app/about/about-route.tsx`）。收起它时，地址会原地换成 `/`（`history.replaceState`：不导航，不重新挂载）。 |
| 语言 | 另一种语言的名称，配上 Languages 图标（`AboutLanguageSwitch`，就是文章页头自己的 `HeaderAction`，用元信息行的等宽字体）。在手机上，它位于文字的右上角，与问候语齐平，并随文字一起滚走；在桌面上，它在文字右下角收尾底部那一行。按浏览器猜测的语言接待的访客，可以不离开就切换到自己读的那种语言。 |
| 离开 | Escape、`/` `O`、底部的按钮、在离文字足够远处点击，或文案里的任何东西打开了别的东西（badge 或链接会把控制权交给它所打开的东西）。使用指针时，“足够远”指在文字或底部左右 96px、上下 64px 之外（`MISS_MARGIN_X`、`MISS_MARGIN_Y`）；更近的点击视为失手。在触屏上，点按空白处永远不会关闭：那通常只是拇指搁着，按钮才是出口。打开附件抽屉不算离开。在手机上，badge 会在 About *之上*打开抽屉（`OVER_ABOUT_Z`，10025），文字仍在下面，Escape 会先收起抽屉。只有当抽屉把东西送到它下面的某处时，About 才会让开：舞台、窗口、另一个页面、灯箱（附件 context 上的 `onSend`）。打开新标签页时它留在原处。 |

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-about/slash-list-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上 /writing 之上打开的斜杠命令列表：Navigation 下列出 Home H、Writing U、Works X、System Prompts P 和 About O，然后是 Actions 和 Settings。" />
  <img src="/img/docs/system-about/slash-o-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="在该列表里按下 O 之后的 About，浮在模糊的 /writing 页面之上：同样的文字，按钮现在是带 esc 的 Close，没有脉动。" />
</div>

在 `/writing` 上按 `/` 打开斜杠列表，About 在其中是 `O`（左）。按下它，About 就浮到那个页面之上（右）。访客之前已经见过它，所以按钮是静止的 **Close**，而不是呼吸着的 Reveal。

### 三层

1. **面纱**：模糊后的页面（`backdrop-blur-2xl backdrop-saturate-150`），覆上玻璃材质（`bg-glass/70`），所以 Tinted / Clear 和壁纸色调都会生效。页面仍然可见：你还看得出自己在哪儿。
2. **文字**：一栏，`33rem`，居中，保持简短。问候语用衬线体（像有人在说话），其余用无衬线体。每一段依次升起，伴随一小段模糊散去（`globals.css` 里的 `.about-copy`）；减弱动态效果时这些都不运行。文字在自己的容器里滚动，溢出时在容器底部渐隐（`.about-scroll-fade`），所以无论文案多长、屏幕多矮，都不会把出口挤出屏幕。
   **底部**：始终在屏幕上。它是一个玻璃按钮（`GLASS_TRACK_FLAT`，剧场控件的玻璃，所以它属于面纱，而不是一块搁在面纱上的板子）。首次访问时它写着 **Reveal**（面纱从新访客落脚的页面上揭开），并且在呼吸：光晕的 `pulse`，只有它的外晕（`inside={false}`），从按钮后面向外绽放。它是屏幕上唯一在邀请你按下的东西。第一次收起之后，它就是一个普通的 **Close**，静止不动。在有键盘的地方（精细的悬停指针），文字后面会显示 `esc`。底部只有一次按下，别无其他：按钮下面没有文字。在手机上，按钮居中在屏幕底部。在桌面上，它挂在文字的左边缘，作为它们的最后一行，因为居中放在一段参差不齐的段落下面，它就和什么都对不齐。
   **位置**：在桌面上（`sm` 及以上），文字和底部是一组，在屏幕上居中（上下留出弹性空间）。在手机上，文字占用屏幕所能给的每一行，底部贴在屏幕最下方。
3. **光晕**：Siri 光环，在一切之上，不接收指针。

层级：在剧场和窗口（10000–10005）之上，在命令面板（10050）之下，所以命令面板仍然可以被召唤到它上面。这些层级是 `systems/about/provider.tsx` 里的一张表：`ABOUT_Z`（10020）是界面本身，`ABOUT_GLOW_Z`（10021）是光环，`OVER_ABOUT_Z`（10025）是它的文案在它之上打开的东西，`DEVTOOL_OVER_ABOUT_Z`（10030）是 devtool。必须出现在 About 之上的界面向 `useOverAboutZ()` 要层级（附件界面和身份卡片都这样做；devtool dock 传入 `DEVTOOL_OVER_ABOUT_Z`）。

**在 bezel 之内。** 画出 vitre bezel 时（iOS），页面的屏幕是它边框以内的那个盒子，按它的半径圆角。About 是这块屏幕上的界面，而不是屏幕周围那圈玻璃上的。它的层级让它位于 bezel 的遮罩（9999）之上，所以不能指望遮罩来裁切它。界面和光晕都取 `BEZEL_INSET` 和屏幕的半径，按它裁切，并带上 `VITRE_LAYER_ATTRIBUTE`，这样容器滚动时它们会变成 absolute。半径是 `useWallpaper().screenRadius`：bezel 的半径，也就是传给 `<Vitre>` 的同一个数，所以在 devtool 里拖动时，bezel、面纱和光环一起变。（About 挂载在 `<Vitre>` 之外，在那里 `useVitre()` 只会读到禁用状态的默认值。）光环的 shader 沿着同一个圆角盒子运行。没有 bezel 时，光环沿着视口的普通矩形运行。

**留白。** 在手机上，文字离两侧各 36px（或安全区加 24px），上方留 5rem（或安全区加 3.5rem），底部按钮下方留 36px（或安全区加 20px）：外圈的几十个像素属于光环。

### 光晕

光环是这个网站唯一的光：来自 `systems/glow` 的 `<EdgeGlow>`，与其他所有光晕（命令面板在聆听、窗口在加载）使用同一个 shader 和渲染器。它如何构建、有哪些参数、代价多大，见 [system-glow.md](./system-glow.md)。在这里它为文字镶边。它的 `content` 是文章（以其滚动容器所显示的范围为限）以及下方的出口。它的 `depth` 是光止于何处，以到文字的较窄那侧留白的比例表示，各边相同。depth 来自 devtool 的 Glow 模块，每种布局一个（`aboutDesk` 对应桌面上居中的那一组，`aboutPhone` 对应手机的整个屏幕；`systems/glow/lib/tuning.ts`）：默认都是 140%。强度、动效（默认 `flow`）和基线也是 About 在那里的参数。它的圆角是 `screenRadius`：在 bezel 里是 bezel 的圆角，没有 bezel 时为 0（浏览器窗口里的页面是矩形；手机的圆角玻璃由硬件来裁切）。

### 文案

文字按文章的方式排版：读者的字号（`--reading-size`）、1.75 倍行高、文章的墨色、段距一段半；链接和强调沿用文章的规则（`.prose-link`、`.about-copy em`），所以 About 不会与站内正文的样式走样。

`content/about/en.mdx` 和 `zh.mdx`。根 layout 在构建时用 `AboutCopy` 渲染两者（它是 server component，所以按路径引入，不从系统的 index 引入），界面显示读者所用的那一种。可用的东西有：

| | |
|---|---|
| `<MagicLink>` | 召唤某样东西的一个词：一篇文章、一件作品、一个职位、一个页面（见下文） |
| `<Badge>` | 同样的链接，打扮成戴着该事物图标的胶囊：一家公司、一个项目 |
| `*…*` | 斜体，用衬线体，用于文案所谈论的那个词，*interface*（中文没有斜体，“界面”用衬线正体）。拉丁衬线字设为 1.0625em，这是文章为 Newsreader 较小的 x 高度所做的光学调整。规则与文章相同（`.about-copy em` 与 `.prose-article em` 并列，globals.css） |
| `<Fn n="1" />` | 注释的标记：一个上标数字，点击后在 About 内把注释滚动到视野中（地址不变） |
| `<Footnotes>` / `<Footnote n="1">` | 注释本身，放在末尾，用 About 的注释字体（那行小号等宽字）；点击注释的编号会滚回它的标记 |
| `<Kbd>` | 一个按键 |
| 普通链接 | `ServerProseLink`：当它指向网站认识的东西（一篇文章，无论它用过哪个地址；一个栏目；某个 commit 附带的 URL）时是 magic link，否则是普通链接。站内路径会收起 About 并导航；外链在新标签页打开，About 保持不动 |

每一个关键词都是 magic link：公司和项目是 badge（各自戴着 `pnpm badges:snapshot` 得到的网站图标；`content/badges.json` 为 commit 或身份指定对应的网站），其他的只是词本身。

## Magic link

magic link 点名一个*可召唤的东西*，并以网站在其他各处召唤它的同样方式召唤它。无论这个链接打扮成什么样，行为都一样：

| 它点名的是 | 使用指针（悬停） | 在手机上（点按） | 使用指针按下 |
|---|---|---|---|
| `post="dreamer"` | /writing 那一行的预览（`PostPeekView`） | 抽屉：那个预览，以及 Read | 那篇文章 |
| `commit="lynx-framework"`（整个 commit） | /works 那一行的预览（`buildCommitPreview`） | 附件抽屉，翻阅它的所有媒体 | 它在 /works 上的那一行 |
| `commit=… item={n}`（一个媒体） | /works 封面的预览（`mediaPeek`）；本站的文章按文章预览 | 只有它的一个抽屉 | 它的归宿：舞台、内置浏览器、路由、灯箱 |
| `role="meta-engineer"`（或 `identity="meta"`，整个身份） | /works 职位那一行的预览：身份的资料（`IdentityPeek`） | 身份卡片（[system-identity.md](./system-identity.md)） | 它在 /works 上的那一行（身份则是 `/works`） |
| `href="/works?type=talk"` | 栏目的卡片（它的分享图，一个计数） | 抽屉：卡片，Visit | 那个页面 |
| `href="https://…"` | 页面的卡片（`pnpm og:snapshot` 抓取这些；没有卡片可抓的页面用 `content/badges.json` 的 `previews`） | 抽屉 | 内置浏览器，或新标签页 |
| `app="…"` | 无 | 一个窗口，在手机上就是一个 sheet | 一个窗口（`openApp`） |

文章的预览是它的正文（摘要、封面），只有服务器能读到，所以在服务器上渲染的 MDX 映射（About、文章、文档）使用 `server.tsx`：它读取文章，或者统计一个栏目，然后把带着这些内容的 `media` 交给客户端链接（`InternalLinkMeta.peek`）。

![桌面上的 About，指针停在 Lynx badge 上：一张预览卡片浮在文字旁边，显示 lynxjs.org 的博客卡片“Lynx: Unlock Native for More”，位于面纱之上。](/img/docs/system-about/badge-peek-desk.png)

使用指针时，Lynx badge 的预览与它在 /works 上那一行的预览一样（这里是它唯一一个附件的卡片），浮在 About 之上（`MagicLinkHost layer`）。按下会把它带到 `/works` 上它的那一行，并收起 About。

About 升起时的任何页面切换都会收起它（provider 监听路径），所以抽屉的 Visit 或卡片的那一行也会把它留在身后。

预览跟随输入方式（`magneticPreviewEnabled`），所有预览都是如此；抽屉跟随视口（附件的策略）。在 About 里，预览、抽屉和身份卡片都浮在它之上（`MagicLinkHost layer`、`useOverAboutZ`），只有当某样东西离开、去往它下方的归宿时，About 才会让开。它从三处得知这一点：附件（`onSend`）、页面切换，或者导航、打开 app 的链接（`MagicLinkHost onLaunch`）；新标签页不会让它让开。收起它有两个动词：`dismiss()` 属于访客（按钮、Escape、离文字足够远的点击），也是唯一会把 `/about` 换成 `/` 的那个；`close()` 是交接，把地址留给接手的东西，所以替换永远不会落在路由的 push 之下。两者都会把访客标记为已见过。只有当 About 之上没有任何东西（抽屉、卡片、命令面板）把 Escape 标记为已处理（`defaultPrevented`）时，Escape 才归 About。

## Badge

`<Badge>` 是为我做过的东西准备的 magic link：在句子里内联点名，戴着它的图标，一按就到它在网站上的归宿。任何渲染 MDX 的地方都能用（文章、文档、About：`components/mdx-components.tsx` 和 `about-copy.tsx` 里的 `Badge: ServerBadge`），在代码里则写作 `<MagicLink badge>`。

```mdx
<Badge commit="lynx-framework">Lynx</Badge>       {/* a commit in content/log.json */}
<Badge role="alitrip-engineer">Alibaba</Badge>   {/* a role: the identity's profile */}
<Badge commit="hermes-engine" item={1} />         {/* its second attachment */}
<Badge app="lynx-flappy-bird" />                  {/* an app in content/apps.json */}
<Badge href="https://youtu.be/…">Talk</Badge>     {/* any URL; the kind is read off it */}
<Badge href="/img/x.jpg" as="image" />           {/* force the kind */}
<Badge href="…" icon="/app-icons/react.png" />    {/* choose the icon (a path, a URL or an app id) */}
```

### 按下后去哪儿

badge 通过附件策略（`systems/attachments/lib/policy.ts`）调用 `open`，与 `/works` 上的封面完全一样，所以 badge 永远不会和封面在“东西归宿何处”上意见不一。在手机上，先出现的是附件抽屉，那样东西、它的标题和入口都在拇指够得到的地方。在桌面上，东西直接在它原生的归宿里打开：

| 东西 | 桌面上 | 手机上 |
|---|---|---|
| 一个页面 | 内置浏览器（一个窗口），如果它拒绝被嵌入或是 PDF，则用新标签页 | 抽屉 |
| 一段录像、一份幻灯片 | 舞台（剧场） | 抽屉 |
| 一篇文章、一个站内路径 | 路由 | 抽屉 |
| 一张图片 | 灯箱 | 抽屉 |
| 一条社交媒体帖子 | 附件界面 | 抽屉 |
| 一个完整的 commit | 它在 /works 上的那一行 | 抽屉，翻阅它的媒体 |
| 一个职位 | 它在 /works 上的那一行 | 身份卡片 |
| 一个 app | 一个窗口，在它的运行时上（web 或 Lynx），通过 `openApp` | 一个窗口，也就是一个 sheet |

它保留真实的 `href`，所以 ⌘ 点击、中键点击和没有 JavaScript 的页面都照常可用；要去新标签页的页面会在 tooltip 里说明。

badge 是句子里的一个词，所以复制时也是一个词：它的图标是 `select-none`（否则字母图标里的字母会被复制成 "H Hux Blog"），而且它是 `draggable={false}`，所以在它上面拖动会选中文字，而不是把链接拖走。About 的文字是主屏幕之上的一份文档，主屏幕的选择锁（`useLockTextSelection`）原本会拦住它们：文章标记了 `data-text-document`，选择锁会放过它。

一个承载 magic link、并且在链接打开东西时应该让开的界面，用 `<MagicLinkHost onLaunch={…}>` 包住它们，就像 About 那样。打开抽屉或身份卡片的链接不会调用它：那些东西浮在宿主之上，由宿主抬高它们（`AdaptiveSurface` 的 `zIndex`），并收听抽屉接下来把东西送到哪里（`useAttachments().onSend`）。

### 它戴什么

总是它的官方图标。没有图标的 badge 会让 CI 失败。

![badge 的图标从哪里来：content 和 docs 里的 Badge 标签、content/log.json 里列出的项目以及 content/badges.json 汇入 lib/badge-site.ts，scripts/badge-icon-snapshot.ts 和 components/magic-link/resolve.ts 都向它询问网站；脚本写出 content/badge-icons.json 和 public/badge-icons/，resolve.ts 读取它们，把图标交给 BadgeMark。](/img/docs/system-about/badge-icons.svg)

“哪个网站”只有一条规则（`lib/badge-site.ts`），被问两次：一次是提前由快照脚本问，它抓取并提交图标；一次是在页面上由 `resolve.ts` 问，它查找图标。快照只能保存页面将会问到的东西。

| badge | 它的图标 |
|---|---|
| `app=` | app 的主屏幕图标（`content/app-icons.json`，`pnpm apps:snapshot`） |
| `role=`、`identity=` | 身份所属网站的图标，在 `content/badges.json` 的 `identities` 下指定 |
| `commit=`、指向别处的 `href=` | 它的**网站**为主屏幕声明的图标（manifest → apple-touch-icon → favicon），由 `pnpm badges:snapshot` 快照到 `public/badge-icons/` 和 `content/badge-icons.json` |
| 指向本站路径的 `href=` | 本站自己的图标（`/icons/icon.svg`） |
| 指向图片的 `href=` | 图片本身 |
| `icon=` | 就用它：一个路径、一个 URL，或一个 app id |

哪个网站代表一个 badge：`href` 的主机名，去掉 `www.`，并合并别名（youtu.be 是 YouTube，twitter.com 是 X，b23.tv 是 bilibili）；职位则是其身份的网站，来自 `identities`；commit 则是它的第一个外部附件，除非 `content/badges.json` 在 `commits` 下指定了它的网站：Ele.me 的 PWA 是 h5.ele.me，而不是介绍它的那篇 Medium 文章；Alitrip 的移动版网页是 Alibaba（alibabagroup.com）；Hux Blog 是 huxpro.github.io。

当一个网站自己的图标已经没了或者换掉了，`content/badges.json` 会在 `icons` 下指定一个，放在 `public/img/badges/` 里，永不重新抓取：Hermes（hermesengine.dev 现在重定向到 GitHub，所以它的 logo 用的是 Wayback Machine 保留的那个）、Ele.me（h5.ele.me 现在换成了淘宝闪购的新品牌；蓝色的 `e` 是 PWA 当年附带的存档图标）和 Wepiao（wepiao.com）。

为主屏幕绘制的图标（manifest、apple-touch-icon，或任何 ≥160px 的正方形）铺满它的方块。favicon 是一个字形，放在一块白色底板上，就像主屏幕显示它的方式，所以黑色的标志（Lynx 的猫）在深色下也看得清。没人快照过的 badge 会回退为一个带颜色的字母图标（commit 的年代色、身份的强调色），对于 `href` 则回退为表示它是什么的字形；检查就是为此而设的。

胶囊以 `em` 为单位，所以无论字号多大都能嵌在句子里。在正文中它带有 `.not-prose`，以摆脱链接样式。

## 约束

下面每一条被打破，都会有看得见的问题。

| 约束 | 原因 | 会坏掉什么 |
|---|---|---|
| badge 或列出的项目背后有一个新网站：运行 `pnpm badges:snapshot` 并提交 `content/badge-icons.json` 和 `public/badge-icons/` | 页面只读快照；`pnpm badges:check`（`.github/workflows/ci.yml`）遇到没有图标的网站会失败 | CI 变红；没有 CI 的话，该有 logo 的地方是一个字母图标 |
| 移除某个网站上最后一个 badge 或项目：再运行一次快照 | `--check` 遇到没有 badge 使用的过期条目也会失败 | CI 变红 |
| `docs/` 或 `content/` 里的语法示例用 `…` 写 URL 或 id（`href="https://youtu.be/…"`） | `scripts/magic-link-tags.ts` 读的是原始文本，包括代码块，只跳过属性里带 `…` 的标签 | 示例会像真正的 badge 一样被抓取和检查 |
| 必须出现在 About 之上的界面，从 `useOverAboutZ()` 取它的层级 | About 位于 10020，在窗口和剧场之上 | 它会在面纱之下打开，被模糊，按不到 |
| About 之上的界面在它处理的 Escape 上调用 `preventDefault()` | About 的 Escape 监听器在 window 上，冒泡阶段，只让位于 `defaultPrevented` | 一次 Escape 把两者都关掉 |
| 从 About 手里接过屏幕的东西调用 `close()`，而不是 `dismiss()` | `dismiss()` 用 `replaceState` 把 `/about` 换成 `/` | 替换落在路由的 push 之下，取消了导航 |
| `AboutCopy` 和 `components/magic-link/server.tsx` 按路径引入，永远不从 index 引入 | 它们读文件系统；而 index 会被客户端代码引入 | 客户端 bundle 引入了 `node:fs`，构建失败 |
| 不用单独的 `O`（或任何单字母）打开 About | 在每个页面都被占用的字母容易误触 | 访客在别处打字时把它召唤出来 |

## 可以自由选择的

- **文案。** `content/about/*.mdx` 里写什么都行，只要保持简短：这一栏可以滚动，但 About 是一段自我介绍，不是一个页面。两种语言不必逐字对应。
- **Badge 还是词。** 公司或项目用 badge；其他的用 `<MagicLink>`，只是词本身。两者行为相同。
- **光晕的调校。** depth、强度、动效和基线在 devtool 的 Glow 模块里；默认值在 `systems/glow/lib/tuning.ts`。
- **哪个网站代表一个 commit。** 它的第一个外部链接，或 `content/badges.json` 里 `commits` 所指定的。

## 做法

给一个新网站加 badge：

1. 写出来：`<Badge href="https://…">Name</Badge>`，用真实的 URL，或者一个第一个外部链接就是那个网站的 `commit=`。
2. `pnpm badges:snapshot`。如果抓取找不到图标，就在 `content/badges.json` 的 `icons` 下指定一个（一个 URL，或一个放在 `public/img/badges/` 下的文件），再运行一次。
3. 在浅色和深色页面上各看一眼这个 badge：favicon 会有白色底板，主屏幕图标会铺满。
4. 提交 MDX、`content/badge-icons.json` 和 `public/badge-icons/`。`pnpm badges:check` 通过。

样例，每种一个，在 `docs/component-test.en.mdx`（`/docs/component-test`）。

文案里的链接要打开一个新界面：从 `useOverAboutZ()` 读取它的 `zIndex`，把它的 Escape 标记为已处理；如果它把访客送到 About 下方的某处，就用 `close()` 收起 About（或者让附件的 `onSend` 来做）。

再看一次首次访问：从 localStorage 里删掉 `hux_about_seen`，然后在 `/lab` 和 `/vitre` 之外的页面刷新。
