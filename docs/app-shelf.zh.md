---
origin: "AI-translated from the original"
---

# 应用文件夹：主屏幕上放外部项目的文件夹

首页的小组件网格里有一个**应用文件夹**：一块 iPad 风格的 springboard，摆着各个应用的图标（React、Lynx、Flappy Bird、Vue Lynx）。每个图标都是目标网站*自己*声明的主屏幕图标，在构建时提交进仓库。悬停、聚焦和编辑模式下，角上会挂出一个小小的**运行时徽标**（web，或按 flavour 着色的 Lynx）。

点一下图标，应用会在一个**带 chrome 的窗口**里打开（见 [Window System](./system-windows)）：web 应用用 iframe，Lynx 应用用 Lynx Player。⌘/Ctrl/Shift/Alt 加点击和中键点击依然会在新标签页打开应用的 `url`：图标本身就是一个真正的链接。

当精选目录一页放不下（默认 8 个图标）时，文件夹会**分页吸附滚动**，可以横向（`axis: "x"`，默认，和 iOS 文件夹一样）或纵向（`axis: "y"`）。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/app-shelf/folder-rest.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上静止状态的应用文件夹：四个图标和它们的标签直接放在壁纸上，背后没有卡片。" />
  <img src="/img/docs/app-shelf/folder-edit.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个文件夹处于编辑模式：图标背后出现了一块带边框和阴影的 strong 玻璃底板，每个图标都显示出地球形状的运行时徽标。" />
</div>

静止时（左）文件夹没有任何外框：图标和标签直接放在壁纸上，与下面卡片的边缘对齐。进入编辑模式后（右，拖动任意图标即可进入）底板出现（`bg-glass-strong`、一条边框、`shadow-raised`），所有运行时徽标都显示出来。Lynx 是一个带留白的 favicon，所以放在白色底板上；另外三个是 160px 及以上的方形图，铺满整块图标。iPhone 15 Pro 宽度，无头浏览器。

- 只有一页时不分页：网格按内容自然撑高，不吸附，没有页码点。
- 拖动一个图标只移动这一个图标；拖动文件夹的空白处则把整个文件夹在小组件之间移动。
- 拖放后的图标不会打开它的应用。
- 每个图标都是本地静态文件。运行时不爬取、不盗链任何东西。

## 原理

![content/apps.json 由 pnpm apps:snapshot 读取，它通过网络找到每个应用的图标，写入 public/app-icons 和 content/app-icons.json；pnpm apps:check 离线校验这两者；运行时 lib/apps.ts 导入两个 JSON 文件，由 AppTile 渲染文件夹和命令面板的应用条。](/img/docs/app-shelf/pipeline.svg)

作者只改一个文件；一条手动运行的命令负责爬取并提交图标；运行时只读已提交的文件。`apps:check` 是离线的守卫，CI 不会运行它。

### 编写

应用写在 [`content/apps.json`](../content/apps.json) 里。类型是 `lib/app-icon-core.ts` 中的 `AppLink`。

```json
{
  "apps": [
    { "id": "react", "title": "React", "runtime": "web", "url": "https://react.dev" }
  ]
}
```

- `id`：稳定的标识符，只能用 `[a-z0-9-]`（snapshot 脚本会拒绝其他字符和重复的 id）；也是 `public/app-icons/` 下图标文件的文件名。
- `title`：图标下方的英文标签。
- `titleZh` *（可选）*：中文标签；没有时回退到 `title`。目前唯一的双语条目是 Cat Wand / 逗猫棒。
- `url`：规范的目标地址（web 应用的 iframe 地址，两种运行时"在外部打开"的目标，也是图标 snapshot 用来解析图标图片的地址）。
- `runtime` *（可选）*：`"web"`（默认）或 `"lynx"`；决定窗口的内容体。Lynx 应用还可以用 `flavor`（`"react"` / `"vue"`，徽标的颜色）和 `bundleUrl` 扩展（见 [Window System](./system-windows)）。
- `size` *（可选）*：打开时的窗口预设，`"portrait"`、`"landscape"` 或 `"max"`。Lynx 默认 portrait，web 默认 landscape（`systems/windows/lib/geometry.ts` 里的 `defaultPreset`）。
- `icon` *（可选）*：当网站声明的图标不对或抓不到时，手动覆盖。站内的 `/…` 路径原样使用（文件必须在 `public/` 下）；`https://…` 地址则直接下载，不走自动发现。思路和 og-snapshot 的手动 `preview` 一样，都是兜底手段。Vue Lynx、Cat Wand 和 BusyWeek 都指向一个已提交的 `/app-icons/<id>.png`。Vue Lynx 需要它，是因为 `vue.lynxjs.org/icon-512.png` 是预先裁好的 iOS squircle（四角透明），和图标自己的圆角裁切叠在一起会出现双重边框；提交的文件是把这张图压平到不透明白底上的版本。
- `featured` *（可选）*：是否显示在主屏幕文件夹上。默认 `true`。设为 `false` 的应用仍然留在 ⌘K 应用条里，但不上 springboard（BusyWeek 和 Cat Wand / 逗猫棒就是这样，只出现在命令面板里）。
- `keywords` *（可选）*：在标题、中文标题、id 和运行时之外，额外的 ⌘K 搜索词。

### 图标流水线（构建时，兼容静态导出）

```
pnpm apps:snapshot   # crawl each app URL, download icons, write snapshot
pnpm apps:check      # filesystem-only validation (no network)
```

`scripts/app-icon-snapshot.ts` 用 `lib/app-icon-core.ts` 里的 `discoverAppIcon` 解析每个应用。候选图标先按来源排序，再按声明的尺寸排序（大的在前），依次下载；第一个嗅探出是真实图片的响应胜出：

1. web app manifest 的 `icons[]`（去掉 `purpose: "monochrome"`）；
2. `<link rel="apple-touch-icon">`，然后是没有声明的 `/apple-touch-icon.png` 探测；
3. `<link rel="icon">`（从不用 `mask-icon`）；
4. `/favicon.ico`。

胜出的文件写入 `public/app-icons/<id>.<ext>`，并在 `content/app-icons.json` 中记录（`url`、`file`、`source`、`iconUrl`、`width`、`height`）。站内的手动 `icon` 记为 `source: "manual"`，带上嗅探出的尺寸，没有 `iconUrl`。

- 爬取失败永远不会删掉之前好好的图标。一个应用既抓不到图标、又没有旧图标、也没有手动 `icon`，整次运行就失败（exit 1）。
- `public/app-icons/` 里没有任何条目指向的文件会被清理掉。
- 以下情况 `apps:check` 会失败：某个应用没有对应条目，它的 `url` 在 snapshot 之后改过，它的图标文件不存在，或者 snapshot 里有一个已经不在 `apps.json` 中的 id。它从不重新爬取（服务器重新编码会让结果不稳定）。CI 只运行 `og:complete` 和 `badges:check`，所以要自己跑它。

运行时，`resolveAppIconSrc` 依次选用 snapshot 的 `file`、手动 `icon`，Lynx 应用最后再用 Lynx 标志。`iconFillsTile` 根据 snapshot 记录的尺寸决定图标的形态：方形且至少 160px 的铺满整块；其他的都当作字形，放在带留白的白色底板上（和 Safari 的"添加到主屏幕"一样），这样透明的深色字形在深色模式下依然看得见。

### 首页网格里的文件夹

`AppFolder`（`components/apps/app-folder.tsx`）是首页 `SortableMasonry`（`app/home-view.tsx`）中的 `"apps"` 项，所以它可以和小组件一起拖动，小组件选择器也可以把它隐藏。它以 `lg`（64px 图标）渲染 `FEATURED_APPS`，列表为空时什么也不渲染。里面的图标是一个*嵌套*的 dnd-kit sortable，有自己持久化的顺序（`localStorage["hux_app_order_v2"]`），挂载时与目录对账：删掉的应用移除，新增的接到末尾。

- 内部拖动会进入 masonry 共享的抖动编辑模式（通过 `useMasonryEdit()`）。编辑模式下，外层项的包装元素会吞掉点击，正是这一点让拖放后的那次点击不会打开被拖图标的应用。
- 共享的 **Reset** 控件也会恢复图标顺序：文件夹以 id `"app-shelf"` 把自己注册为 masonry 的一个 *section*。
- 底板：静止时文件夹是 `border-transparent`，带 `ink-bare-mid ink-bare-rest`（它的标签是一块裸露区域，落在壁纸中段时可能翻转墨色；见 [Legibility](./system-legibility)）。悬停时加上 `bg-glass` 和一条淡淡的边框；编辑模式，以及整个文件夹被拖起时的浮起副本，用的是 `bg-glass-strong shadow-raised backdrop-blur-sm`。

### 分页

![十一个精选应用按 4×2 布局分成两页，八个和三个；每页占满滚动容器的宽度，在起始处吸附；pageIndex 是 scrollLeft 除以 clientWidth 再取整。](/img/docs/app-shelf/paging.svg)

排好序的 id 由 `chunkAppPages`（`lib/apps.ts`）按 `columns × rows` 切成若干页；最后一页可以不满，靠左对齐。每一页都是一个占满宽度、`snap-start snap-always` 的网格，放在 `snap-x snap-mandatory` 的滚动容器里；页码点以页宽为单位读写 `scrollLeft`。线上目录只有四个精选应用，所以网站目前只显示一页；没有两页时的截图。

| 精选应用数（4 × 2） | 表现 |
|-----------------------|-----------|
| 8 个及以下 | 按内容自然撑高的网格：不吸附，没有页码点，没有空着的第二行 |
| 9–16 | 两个吸附页（8 + 余下的）；页码点在文件夹下方 |
| 17–24 | 三页；同样的规律 |

多于一页时，网格固定为 `repeat(rows, auto)`，让每一页占同样大的地方。`axis: "y"` 把页面纵向叠放，滚动容器高度上限为 `rows × 5.5rem`，页码点移到右边缘。

## 规则

- **内部的 `DragOverlay` 要 portal 到 `<body>`。** 抖动模式下，masonry 项的包装元素带有 `rotate` transform（`widget-jiggle`），而带 transform 的祖先会成为 overlay 的 `position: fixed` 的包含块。这曾让可见的拖动副本和 dnd-kit 的碰撞矩形都发生偏移，悄无声息地弄坏了跨行排序。
- **按下图标时阻止事件冒泡。** `SortableAppIcon` 会阻止 `pointerdown`（并守住 dnd-kit 的 activator），这样拖动图标永远不会激活外层的 sortable，把整个文件夹拎起来。
- **保留持久化用的 id。** `"app-shelf"`（section id）和 `hux_app_order_v2`（存储键）是访客保存的状态；改掉任何一个，都会悄悄重置他们的顺序。
- **`id` 既是文件名，也是保存的位置。** 改名需要跑一次 `pnpm apps:snapshot`（生成新文件，清理旧文件），而且在访客保存的顺序里，改名后的应用会跑到末尾（`reconcile` 先保留认识的 id，再追加新的）。
- **手动图标应当是不透明的方形图。** 图标会自己裁出 squircle（`rounded-[22.5%]`）；预先裁好的图会出现双重边框，小于 160px 或非方形的图会被放到带留白的底板上。
- **永远不要让图标指向远程图片。** 图标显示的一切都必须是 `public/` 下已提交的文件。

## 可以自由选择的

- `AppFolder` 上的 `layout={{ columns, rows, axis }}`；默认是 `DEFAULT_APP_FOLDER_LAYOUT`（4 × 2，`"x"`）。
- 哪些应用设为 `featured`，以及它们的默认顺序（目录顺序）。
- 按住和拎起时的缩放（`ICON_HOLD_SCALE` 1.08，`ICON_LIFT_SCALE` 1.15）。

## 新增或修改一个应用

1. 在 `content/apps.json` 里新增或修改条目。
2. 运行 `pnpm apps:snapshot`。如果报 "no icon" 失败，就加一个手动 `icon`（如果是站内文件，把它提交到 `public/` 下），再跑一次。
3. 看看新图标：它是铺满，还是按预期带留白放在底板上？文件夹上（如果是精选）和 ⌘K 应用条里都要看。
4. 运行 `pnpm apps:check`，然后把 `content/apps.json`、`content/app-icons.json` 和 `public/app-icons/` 一起提交。

## 对照：⌘K 的应用条

<img src="/img/docs/app-shelf/palette-strip.png" style={{ width: "50%" }} alt="手机上的命令面板：搜索框下方是一行横向的应用图标，React、Lynx、Flappy Bird、Vue Lynx、Cat Wand 和被截掉一半的 BusyWeek，每个都显示着运行时徽标。" />

同一份目录在命令面板里（`CommandAppsStrip`，`systems/command/apps-launcher.tsx`）：所有应用，包括 `featured: false` 的那些（带绿色 Lynx 徽标的 Cat Wand，以及在边缘被截断的 BusyWeek），以 `md`（48px）显示，徽标始终可见，排成一行横向滚动。它记录在 [Command System](./system-command) 里。

## 参考

| 部分 | 位置 |
|-------|----------|
| 目录、精选列表、分页辅助函数、`iconFillsTile` | `lib/apps.ts` |
| `AppLink`、图标发现、`resolveAppIconSrc`、`appTitle`、`runtimeLabel` | `lib/app-icon-core.ts` |
| Snapshot / check 脚本 | `scripts/app-icon-snapshot.ts` |
| 图标视觉（图标 + 徽标 + 标签） | `components/apps/app-tile.tsx` |
| 分页吸附的文件夹小组件 | `components/apps/app-folder.tsx` |
| ⌘K 应用条 | `systems/command/apps-launcher.tsx` |
| 窗口菜单和最小化 Dock 中的图标 | `systems/windows/components/app-icon-plate.tsx` |

`AppTile` 是文件夹和 ⌘K 应用条共用的图标视觉。窗口 chrome 用的是 `AppIconPlate`，它以胶囊大小套用同样的 `resolveAppIconSrc` / `iconFillsTile` 规则。`AppShelf`（以及 `components/home/app-shelf.tsx`）是 `AppFolder` 的已弃用别名。
