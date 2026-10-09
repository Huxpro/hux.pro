---
origin: "AI-translated from the original"
---

# Lab

从内部研究这个站点，以及它发布出去的库。`/lab` 是索引页；每个 lab 都是 `systems/lab/catalog.ts` 里的一个条目、同一个框架（`LabShell`）、`app/lab/<id>` 下的一个路由文件夹、两种语言的文案，外加一个给索引页和主屏幕小组件用的小型实时 surface。

## 长什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-lab/index-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上的 /lab 索引页：标题和 Add the Lab widget to Home 开关，接着是 Libraries，Vitre 是一张宽卡片（它的 surface 旁边是简介和包的信息），然后是 Studies，六张卡片排成两列网格，每张都带着自己的 surface。" />
  <img src="/img/docs/system-lab/index-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的同一个索引页：Vitre 卡片把 surface 叠在文字和包信息上方；Studies 跟在后面排成一列，第一张是 Works Lab。" />
</div>

桌面和手机（393pt）上的 `/lab`。库排在前面，是一张带包信息（`vitre v0.1.0 · React >=19 · not on npm yet`）的宽卡片；研究跟在后面排成网格，每张卡片带着自己的 surface。标题下唯一的控件是主屏幕小组件的开关。

![Works Lab 的顶栏：λhux / Works Lab 及其下拉菜单和信息按钮，形态切换和 "covers"，实时读数 "50 commits · 5 tags · 9 identities"，右端是 Inspect、Tag、Reset 和 Save；下面是时间线。](/img/docs/system-lab/study-works.png)

一个研究，Works Lab（`layout="canvas"`）：一条顶栏里放着回首页的路、lab 的名字（它同时是切换器）、信息按钮、它的工具（时间线的形态）、实时读数，以及右端的操作。

![Vitre 的 API 页：同样的顶栏，工具是一个 Filter 输入框，操作是 Docs · API · On hux.pro，然后是包的页头（vitre v0.1.0、React >=19、not on npm yet、Source、Demo）和最前面的几个导出。](/img/docs/system-lab/library-vitre-api.png)

一个库，Vitre 的 API 页：同样的顶栏，工具是这一页的过滤框，操作是库的三个页面，下面是从包的 `package.json` 读出来的 `LibraryHeader`。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-lab/workbench-phone-folded.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的 Icon Lab：顶栏上有 SVG 和滑块按钮，下面是 app 图标；没有面板。" />
  <img src="/img/docs/system-lab/workbench-phone-open.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="点了滑块按钮之后的同一页：按钮变成实心，调节面板（Typography：wordmark、weight、size、tracking）在顶栏下方、舞台上方展开。" />
</div>

`lg` 以下的 workbench（手机上的 Icon Lab）：面板折叠在顶栏的滑块按钮后面，展开时出现在顶栏下方、舞台上方。

<img src="/img/docs/system-lab/home-lab-widget.png" style={{ width: "calc(50% - 0.5rem)" }} alt="主屏幕的 Lab 小组件：一张标题为 lab、带刷新按钮的卡片，显示 Legibility Lab 的 surface（四级墨色的 Aa 和策略那一行）及其名字。" />

访客打开主屏幕的 Lab 小组件之后：一次显示一个 lab 的 surface，点刷新换到下一个。

## 各部分怎么拼在一起

![目录（systems/lab/catalog.ts）列出七个 lab：六个研究，以及作为库的 Vitre 和它的 LibraryInfo。每个 lab 有一个 surface（LAB_SURFACES），供 /lab 索引页和主屏幕小组件使用；app/lab 下的每个路由文件夹包含 page.tsx、view.tsx 和 strings.ts，view 渲染在 LabShell 或 LibraryShell 里；库的文案来自它的包。LabShell 的顶栏是 λhux / LabNav、信息、工具、meta、操作，下面是 document、workbench 或 canvas 的主体。](/img/docs/system-lab/map.svg)

目录是唯一的清单。索引页、切换器（`LabNav`）、信息按钮、主屏幕小组件和库的页头都读它；别的地方都不列 lab。

```
systems/lab/
├── catalog.ts        # LabId, LABS, LAB_GROUPS
├── i18n.ts           # LabTable, useLabStrings, the frame's words
├── components/
│   ├── shell.tsx     # LabShell, LabBar, LabPanel, LabSection, …
│   ├── nav.tsx       # LabNav: the name, and the switcher
│   ├── controls.tsx  # the panel's knobs: Field, Slider, …
│   └── library.tsx   # LibraryShell, LibraryHeader, ApiReference
└── surfaces/         # LAB_SURFACES, SurfaceFrame, strings.ts

app/lab/              # the index, and one folder per lab
app/lab/vitre/        # the first library: guide, api/, site/
components/home/lab-widget.tsx   # the home widget
```

## 两种 lab

**研究**（study）把站内的某个系统摊开：真实的组件、真实的策略、真实的状态，加上调节它们的旋钮。它是为这个站点服务的，从不假装是别的什么。

**库**（library）是一个独立成包、离开了站点的系统。它的 lab 就是这个包的主页；没有别的文档站。

| id | 类型 | 主体 | 对应系统的文档 |
|---|---|---|---|
| `works` | study | canvas | `content/log.json`（没有单独的文档） |
| `attachments` | study | workbench | `docs/system-attachments.md` |
| `icon` | study | workbench | `docs/app-icon.md` |
| `legibility` | study | workbench | `docs/system-legibility.md` |
| `glow` | study | document | `docs/system-glow.md` |
| `band` | study | canvas，自带面板 | `docs/system-dock.md` |
| `vitre` | library | canvas（指南），document（API、On hux.pro） | `packages/vitre/README.md` |

每个库的主页都有同样的三个页面，所以新的库只需带来自己的文案和 demo，不需要设计：

| 页面 | 路径 | 是什么 |
|---|---|---|
| Docs | `/lab/<id>` | 指南：库自己的正文，放在 lab 的 canvas 上（Vitre 的是一篇文章，旁边是一台模拟的 iPhone） |
| API | `/lab/<id>/api` | 按类别列出每个导出，再列出每个公开类型的字段，带一个过滤框（`ApiReference`） |
| On hux.pro | `/lab/<id>/site` | 这个站点怎么用它：实时状态、策略、它所在的文件。只读；旋钮留在 devtool 里 |

`LibraryShell` 把这三个页面放进顶栏的操作里，每一页开头是 `LibraryHeader`（名字、版本、peer 依赖、npm 或 "not on npm yet"、源码、demo），通过目录里的 `library` 从包自己的 `package.json` 读出，所以它不会和实际发布的内容脱节。发布到 npm 就是把那里的 `private` 翻过来；页头会跟着变。

## 索引页

`/lab` 有两个分区，库在前（`LAB_GROUPS`）：库是已经发布出去的 lab，对不同的读者做出不同的承诺，所以它排在前面，是一张带简介和 `LibraryFacts` 的宽卡片；研究则是网格里的一张卡片，只有一行介绍。每条顶栏上的切换器也按同样的方式分组。索引页本身是一个 `PageLayout` 页面，不是 `LabShell`。

## 同一个框架

每个 lab，不论哪一种，都在一条吸顶的顶栏（`LabBar`）下面直接打开它的工作区：`λhux`、lab 的名字（同时也是切换器 `LabNav`）、一个显示目录简介和完整读数的信息按钮，然后是 lab 的工具、实时读数（单行截断，`xl` 及以上才显示）和它的操作。即使一样都没有，lab 也照样有这条顶栏。

| `LabShell` 属性 | 是什么 |
|---|---|
| `lab` | `LabId`：顶栏上的名字和简介来自目录 |
| `layout` | `document`（单栏，默认）、`workbench`（舞台旁边是 `panel`；`lg` 以下面板折叠到顶栏的滑块按钮后面）、`canvas`（占满整个宽度；主体由 lab 自己布局） |
| `tools` | 驱动舞台的东西，放在名字后面 |
| `meta` | 实时读数 |
| `actions` | 会写入的操作（SVG、Reset、Save……），靠右 |
| `panel` | workbench 的旋钮（`LabPanel`） |
| `scrollTools` | 比顶栏还长的工具（比如指南的分节标签）在名字和操作之间横向滚动，而不是把操作挤到单独一行；在手机上它们占第二行 |
| `pin` | `band`（默认）：顶栏钉在一个 `PinnedSlot` 里，和 Dock 共用顶部的 band；`static`：它会滚走（Band Lab 在试另一种顶栏时用） |

顶栏第一行的高度就是 band 的高度，和 Dock 的胶囊齐平。吸附在它下方的东西读 `--lab-under-bar`。

## 内容留在包里

库的文案放在包里，而不是 `app/lab`：Vitre 的在 `packages/vitre/site/src/docs`（指南是 `sections.tsx`，参考是 `api.ts`）。`api.ts` 会针对 `vitre.d.ts` 做类型检查，所以没写文档的导出或公开字段会让 `pnpm vitre:typecheck` 失败，又因为 lab 导入了它，`next build` 也会失败（这条规则也写在 skill `.claude/skills/vitre` 里）。lab 把这份数据适配成模板的 `LibraryApi`（`app/lab/vitre/api.ts`），用站点的字体排印渲染出来。

正是这一点让库保持可移植。如果哪天它需要一个自己的主页（独立的仓库、社区、分版本的文档），一个小小的外壳就能渲染同样的内容；什么都不用重写。

库的 demo 是一个独立的文档（`/vitre/index.html`，由 Vite 构建到 `public/vitre`）：这个包会接管它所运行的页面，所以模拟器把它装进框里，通过 `postMessage` 驱动它。手机在 `/vitre` 得到全屏的 demo；其他设备都被重定向到 `/lab/vitre`（`next.config.ts`）。

## 规则

| 规则 | 原因 | 打破之后 |
|---|---|---|
| lab 的 `href` 是 `/lab/<id>`，路由文件夹是 `app/lab/<id>` | `labFromPath` 靠路径的第一段找到当前的 lab | 切换器和顶栏显示错误的 lab，或者显示成索引页 |
| lab 的每一页都渲染在 `LabShell` 里（库：`LibraryShell`） | 顶栏是回首页、去其他 lab 的路 | lab 没有出口，也没有简介 |
| 文案放在 lab 旁边的 `LabTable` 里（`const zh: typeof en`），用 `useLabStrings` 读取；不放进 `lib/i18n.ts` | lab 是开发工具；站点词典放的是访客读的东西。`typeof en` 让缺失的 key 成为类型错误 | 没翻译或彼此走样的文案 |
| 代码名称按原样书写（组件、属性、文件、JSON key、类名、路由） | 那就是你在仓库里会搜索的东西 | 一个在代码里谁都找不到的标签 |
| 库的 `LibraryInfo` 从它的 `package.json` 读出 | 页头和索引卡片说明的是实际发布的东西 | 撒谎的版本号或 npm 链接 |
| Lab 小组件保持 `defaultEnabled: false`（`components/home/widgets.ts`） | lab 是对站点内部的研究，不是访客来这里的目的 | 每个访客的主屏幕都多出一张开发工具卡片 |

## 可以自由选择的

- 主体：`document`、`workbench` 或 `canvas`，看 lab 的舞台需要什么。lab 可以在 canvas 上自己布局面板（Band Lab 就是这样）。
- 工具、读数和操作，或者都不要。
- 研究要不要写回（Works 和 Icon 在 `next dev` 下可以保存）；大多数只是读数。
- 研究的页面 metadata 设置 `robots: { index: false, follow: false }`；库的页面会被收录，因为找这个包的开发者应该能找到它们。

## 添加一个

1. 在 `catalog.ts` 里加一个条目，并把它的 id 加进 `LabId`：`kind: "study"`，或者 `kind: "library"`，并从包里读出它的 `library`。
2. 在 `app/lab/<id>` 下加一个路由，放进 `LabShell`（研究）或 `LibraryShell`（库，旁边还有 `api/` 和 `site/`）。
3. 在 `systems/lab/surfaces` 里加一个 surface（`<id>.tsx`，画在 `SurfaceFrame` 里，文案放在 `surfaces/strings.ts`），并注册到 `LAB_SURFACES`。在注册之前，`Record<LabId, …>` 类型会一直报错。
4. 两种语言的文案：旁边放一个 `strings.ts`，用 `useLabStrings` 读取。（Legibility Lab 比共享表格出现得早：它的 `i18n.ts` 有自己的 `useLabText`。不要照抄。）

## 刻意低调

Labs 是公开的，但不是大多数访客来这里的目的：命令面板能按名字搜到它，却从不主动推荐（`systems/command/actions.tsx` 里的 `searchOnly`；`/` `E` 仍然能打开索引页），主屏幕小组件也默认关闭，直到访客自己添加，可以在网格的编辑模式里加，也可以用 `/lab` 上的开关（`useHomeWidget("lab")`；选择存放在 `hux_widget_prefs` 里）。

## 历史

这一族以前放在 `/editor` 下，叫 editor 家族。`next.config.ts` 保留了旧地址：`/editor` 跳到 `/lab/works`，`/editor/theater-variants`（一个已经不存在的展示页）跳到 `/lab`，`/editor/:path*` 跳到 `/lab/:path*`。`/lab/attachment`（单数）重定向到 `/lab/attachments`。
