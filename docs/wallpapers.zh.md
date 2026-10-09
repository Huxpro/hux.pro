---
origin: "AI-translated from the original"
---

# 壁纸

页面背后画的是什么：实时天空，或内置图库里的一张图片；一对浅色/深色壁纸显示哪一半；画在哪里；以及这些文件是怎么制作的。属于 [Ambient System](./system-ambient.md)；天空本身见 [The Sky](./ambient-sky.md)，壁纸对其上文字的影响见 [Legibility](./system-legibility.md)。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/wallpapers/sonoma-light.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面端首页，浅色主题下的 Sonoma 壁纸：浅绿色的山丘，白色玻璃小组件，深色文字。" />
  <img src="/img/docs/wallpapers/sonoma-dark.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一页面在深色主题下：Sonoma 的深色那一半，深绿与深蓝，深色玻璃小组件，浅色文字。" />
</div>

Sonoma 这一对，分别在浅色和深色主题下（桌面，1280 宽）。除了主题之外什么都没选：显示哪一半跟着主题走，图片以完整强度绘制，上面的玻璃和文字由这一对壁纸的测量 profile 决定。

- 同一时间只画一张壁纸。切换（天气 ↔ 图片，或一张图片换到另一张）时，用的是和天气变化相同的交叉淡化。
- 一对壁纸显示哪一半跟随应用主题，就像 macOS 的动态桌面。这不是一个设置项。
- 文件绝不会被放大到超过源图，1× 屏幕也绝不会下载 2× 的文件。

## 原理

背景是**一个图层栈，只由一个来源供给**：

```typescript
type WallpaperKind = "weather" | "image";
```

- `weather`：实时天空，有三种**样式**（`weatherStyle`）：

  | 样式 | 名称 | 副标题 | 是什么 |
  |---|---|---|---|
  | `sky` | **Sky** | shader · webgl | WebGL shader（`lib/wallpaper/`）：整个场景，带动画。需要 WebGL2。默认样式。 |
  | `gradient` | **Gradient** | css · gradient | 同一个场景画成 CSS 渐变（`sceneToCssGradient`），精确到分钟实时更新。Sky 的自动降级方案。 |
  | `classic` | **Classic** | css · gradient | 六套手调的天气状况配色，分白天和夜晚，外加日出 / 日落渐变（`getClassicGradient(scene, phase)`）。在时段和天气变化时跳变。只能手动选择。 |

- `image`：内置图库（`lib/wallpaper.ts` 里的 `BUILT_IN_WALLPAPERS`）中的一张图片，可以固定为一张静态图，也可以在一个相册里 Shuffle / Loop 播放（`lib/wallpaper-play.ts`）。

样式和引擎一一对应：Sky 是 canvas，另外两种是 CSS 图层栈。唯一的解析就是降级：`resolveWeatherStyle` 把没有 WebGL2（或开着 devtool 的 `noWebGL` 覆盖）的 Sky 变成 Gradient，`useWallpaper().effectiveStyle` / `.renderer` 告诉你最终生效的是哪个。小组件卡片总是画 CSS 图层栈：Classic 下画 Classic 配色，另外两种下画场景渐变。

因为只有一个图层栈、一种 kind，两者**在结构上就互斥**：不存在两者同时绘制的状态，所以不需要任何仲裁。Sky 的 canvas 是"一切皆图层"的唯一例外：它直接根据场景绘制整页背景的位置（见[数据流](./system-ambient.md#how-it-works)）。

日出日落的 Live Activity 不受这些影响：它在 Dock 里根据时钟渲染，所以即使用图片壁纸，日出和日落照样会提醒。

### 浅色/深色对与不透明度

显示哪一半**始终跟随应用主题**。固定某一半的唯一结果，就是浅色文字压在浅色图片上，而为了挽救它所需的压暗又让壁纸变得像幽灵；图块上每一半各有一个太阳 / 月亮，只是指示，不是控件。`useWallpaper().variant` 就是主题当前落在的那一半。

不透明度只在 provider 里解析一次，整页图层和小组件叠层都通过 `useWallpaper().opacity` 读取。它以当前正在绘制的东西的 **family** 为键（`lib/wallpaper.ts` 中的 `WALLPAPER_LOOK_FAMILY`、`WALLPAPER_OPACITY`），而不是以用户选择的东西为键：降级到 Gradient 的 Sky 就是一层 wash。

| 外观 | Family | 浅色主题 | 深色主题 |
|---|---|---|---|
| Weather · Sky | `picture` | 1.00 | 1.00 |
| Weather · Gradient | `wash` | 0.70 | 0.85 |
| Weather · Classic | `wash` | 0.70 | 0.85 |
| Image | `picture` | 1.00 | 1.00 |

Sky 以 1 绘制，因为它的主题遮罩是在 shader 内部混合的。图片以完整强度绘制，因为那是用户亲自选的，而首页就是一个桌面。阅读页通过遮罩和虚化让它退后，而不是调暗图层（见 [Reading surfaces](./system-glass.md#reading-surfaces)）；上面的表面有多实，又是另一个独立的设置（[Glass](./system-glass.md)）。

### 位置

当前壁纸画在哪里由 `wallpaperPlacement` 决定：

| 模式 | 效果 |
|------|--------|
| `full` | 在整个页面后面（默认） |
| `widget` | 只在小组件卡片里，每张卡片都是一扇与视口对齐、通向它的窗口 |
| `off` | 哪里都不画：全局背景总开关 |

**每个 family 自己决定边缘要什么。** 边缘表同样以 family 为键（`lib/bezel.ts` 中的 `WALLPAPER_FAMILY_EDGES`）。在 iOS 手机上，provider 据此实时解析每个页面，随外观变化而变化：

| 外观 | 边框 | 柔边 |
|---|---|---|
| Weather · Sky | 开 | 关 |
| Weather · Gradient | 关 | 开 |
| Weather · Classic | 关 | 开 |
| Image | 开 | 关 |

CSS wash 是页面自身的颜色向外推开，所以它会淡回底色里。照片是贴在页面上的一张图，所以它在边框内以一条线收尾。Sky 也是一张图（渲染出来的），因此用图片的配置。边框的启动脚本以保存的样式为键，而不是以 WebGL 支持为键，所以降级到 Gradient 的 Sky 会保留它的边框，而不会闪烁。桌面窗口默认什么都没有，除非被覆盖。devtool 设置的会话级边缘覆盖会记下设置时所在的 family，所以 family 一变（切换 kind，或 Sky ↔ 某个 CSS 样式），覆盖就结束。

**边框**是 `vitre`（`packages/vitre`，参考 ryOS）：页面四周一圈纯色，默认黑色，页面在里面带圆角；在 iOS 上，页面在一个容器里滚动，document 本身保持不动。色调、宽度和圆角是两种 kind 共用的已保存设置（`bezelTint` 为黑色，宽度和圆角为 null 表示默认值）。Safari 做了什么、为什么这样做，见该包的 README。

**柔边**（顶部/底部渐隐）只在边框关闭时生效。图片是图层栈里的又一层，所以柔边开启时，它得到和天气渐变相同的 mask（`EDGE_FADE_MASK`，或深色模式日出 / 日落时更宽的 `EDGE_FADE_MASK_HIGH_CONTRAST`，都在 `lib/platform.ts`）。

### 选择文件

每张壁纸都以 `cover` 绘制，所以规则关心的是在真实屏幕上的拉伸，而不是像素数：**完整尺寸的文件，是能以 2× 覆盖 2560×1600 视口（5120×3200 设备像素）的最小尺寸，绝不放大到超过源图。** 只要更小，旁边就附带一个匹配的 `@1x` 覆盖版本（`.1x.webp`）。`pickWallpaperSrc()` 选择能覆盖视口 × DPR 的最小版本。页面先立刻画出 480px 的选择器缩略图，等选中的文件解码完成后再淡入覆盖在上面（一种 blur-up，缩略图本来就已经下发了）。

## 图库

三个分类（`WALLPAPER_CATEGORIES`），在选择器里用和 Featured Talks 小组件切换相册相同的胶囊切换。

- **Weather**：排在第一，也是实时的那一个。三个图块：**Sky**，一个小的实时 canvas，以图块大小的像素预算运行 shader；**Gradient**，就是页面会画的那个渐变；**Classic**，当前天气和时刻的配色。每个都带一个标签：两个实时样式上是 Live，Classic 上是 Preset。没有 WebGL2 时，Sky 图块显示 Gradient 并附一条说明，这正是选了它之后会画出的东西。图块下面是 **Tilt** 一行（陀螺仪；见 [The Sky](./ambient-sky.md#gyroscope-tilt)）。
- **Apple**：macOS、iPadOS 和 iOS 的默认壁纸，成对的浅色/深色。共十七组：macOS Golden Gate、Tahoe、Sequoia、Sonoma、Ventura、Monterey、Big Sur、Catalina 和 Mojave；iPadOS 26 和 iPadOS 18 的四种配色（Violet、Indigo、Blue、Teal）；iOS 15、14 和 13。
- **Nature**：Mac OS X 的 19 张 Nature 桌面图片（Aurora、Zebra、Zen Garden……），取自 ryOS。每张只有一张照片，所以两半是同一个文件（`isSingleImage()`），选择器里不拆分显示。

Apple 和 Nature 的开头各有 **Shuffle**（参考 iOS 的照片随机播放：扇形拼贴，随机顺序）和 **Loop**（参考 macOS 的更换图片：整齐叠放，按图库顺序），只在该相册内轮换。选中其中任一个时，正下方会出现 **Frequency** 一行：On Visit（每个标签页会话一次）、Hourly（默认）、Daily。点一张静态图会把它固定下来，并关闭播放。

命名：iPadOS 的配色以颜色命名，说明文字只写年份（"iPadOS 18 Violet — iPadOS · 2024" 既重复又会溢出）。iOS 的那几对是手机用的图，由于每个图块都是同样的 16:10 卡片，就在说明文字上加一个手机图标作标记；`isPhoneWallpaper()` 根据平台推导出这一点。Apple 以正方形画布提供它们，由设备自行裁剪；这里一张都没有裁。

### 分辨率

| | 完整文件 | @1x | 1× 下的拉伸 |
|---|---|---|---|
| macOS Golden Gate | 4480×3088 | 2560×1765 | 1.00× |
| macOS Tahoe … Big Sur, Catalina | 5120×5120 | 2560×2560 | 1.00× |
| macOS Mojave, Nature Earth & Moon | 5120×2880 | 2844×1600 | 1.00× |
| iPadOS 26 横向 | 2752×2064 | 2560×1920 | 1.00× |
| iPadOS 18 | 3840×2668 | 2560×1779 | 1.00× |
| iOS 15 / 14 / 13 | 2916² / 3072² / 3208² | 2560×2560 | 1.00× |
| Nature Mt. Fuji | 3200×2000 | 2560×1600 | 1.00× |
| Nature（其余） | 2560×1600 | （同一文件） | 1.00× |

有意不收录的：iOS 17（2048²，会拉伸 1.25×），以及 iOS 18 / 27 和竖向的 iPadOS 26（太高，无法覆盖 16:10）。横向的 Nature 照片在 3× 竖屏手机上仍会拉伸约 1.64×；源图只有 1600px 高，而这里什么都不放大。每个图块在名称下面标出完整文件的像素尺寸。

### 编码

`scripts/wallpaper-encode.ts`，依据 `public/wallpapers/sources.json` 里的来源记录（`pairs`，每项标记为 `"encode": "graphic"` 或 `"photo"`，以及 `photos`）：

- **图形类壁纸对**：WebP q80。
- **照片**（Nature，以及 Catalina / Mojave 两对）：WebP q95，4:4:4 色度；如果文件会超过每 2560×1600 百万像素约 1.8MB，则退到 q90（Zen Garden 耙过的沙子）。
- **缩略图**：长边 480px，q72。

预算（`scripts/wallpaper-check.ts` 中的 `BUDGET_KB`）：图形类壁纸对的完整文件超过 2MB，就说明出了问题（Big Sur 深色是一幅有颗粒感的插画，约 1.2MB）；照片的预算是 8MB，因为耙过的沙子从头到尾都是细节。

```bash
pnpm wallpapers:encode               # every photo and every pair marked "encode" → WebP full, @1x, thumb
pnpm wallpapers:encode golden-gate   # only the named ids; prints base colour and size for the catalog
pnpm wallpapers:check                # files present, sharp enough, sized as declared, within budget
pnpm wallpapers:profile              # measure every wallpaper for legibility; commit the table
pnpm wallpapers:profile:check        # the committed table is current (CI does not run this)
```

每张壁纸，包括天气渐变，在 `lib/wallpaper-profiles.json` 里都有一份静态 **profile**：各条带的明度、画面有多繁杂、主色。可读性策略在运行时读取它，而不是读像素；见 [Legibility](./system-legibility.md)。

**来源。** 高分辨率原图来自 wallpapers.poutanen.dev（macOS 6K 图形类 Tahoe–Big Sur、iOS 13、iOS 14）、4kwallpapers.com（Golden Gate 原生尺寸、Catalina、Mojave、iOS 15；它那张 6016×4147 的 "6K" Golden Gate 是原生壁纸对的放大版，没有使用）、static.applewalls.com（iPadOS 26 横向），以及 LAYTAT/macOS-Wallpapers 和 Deeeee-macOS-Wallpapers 导出的 `/System/Desktop Pictures`。512pixels.net 的 6K 文件是手工放大的，所以跳过了。`sources.json` 记录了每个文件的确切 URL。

**这些作品的权利归 Apple 所有。** 它们是为个人网站提交的，不做二次授权；它们的来源存档同样没有授权 Apple 的图片。

## 选择器

`wallpaper-sheet.tsx`，一个基于 `<AdaptiveSurface>` 的次级窗口（见 [Surface System](./system-surface.md)），在根布局里挂载一次，形状和音乐播放列表的 sheet 一样：窄视口上是底部的 action sheet，宽视口上是贴右边缘的浮动面板。只要当前用的是天空，它打开时就停在 Weather 标签页。

它的图块是 **macOS 设置里的壁纸对卡片**：16:10 的卡片左右分成浅色和深色两半，每半各有一个太阳 / 月亮，选中时有一个对勾，下面是 `Name` + `macOS · 2020`。Shuffle / Loop 图块用同样的框（三张照片的拼贴，扇形或叠放），作为单独的一对放在静态图上方，这样 Frequency 可以紧贴在它们下面。Weather 图块也是同样大小的同一种框：天空只是壁纸之一，只不过是会动的那一张。位置设置作为紧凑的一行放在网格上方：它是一个修饰项，不是你打开这里要找的东西。

| 从哪里打开 | 方式 |
|---------|-----|
| 命令面板 | `Wallpaper: <current>` 那一行（⌘K），或 `/` 然后 `W` |
| Devtool | Wallpaper 模块：整个背景系统集中在一处 |
| 代码 | `useWallpaper().openPicker()` |

## `useWallpaper()`

完整的类型是 `systems/ambient/provider.tsx` 中的 `WallpaperContextType`。大多数调用方需要的部分：

| 分组 | 字段 |
|---|---|
| 选中了什么 | `kind`、`setKind`、`weatherStyle`、`selectWeather`（选择一种样式，**并且**把 kind 切到 weather）、`wallpaper`、`wallpapers`、`selectWallpaper`（固定一张静态图，**并且**把 kind 切到 image；关闭播放）、`selectPlay`、`play`、`playAlbum`、`playEvery`、`setPlayEvery` |
| 正在画什么 | `effectiveStyle`、`renderer`（`"shader"` 或 `"css"`）、`shaderSupported`、`variant`、`src`、`layers`、`opacity`、`profile`、`legibility` |
| 画在哪里 | `placement`、`setPlacement`、`fullEnabled`、`widgetEnabled`、`softEdgeEnabled`、`edgeMask`、`bezel` 及边框设置、`devtoolOverrides` |
| 阅读页 | `reading`、`veil`、`blurred`、`readingBlur`、`readingDim` 及对应的 setter |
| 天空的控制项 | `gyro`（`enabled`、`active`、`readings`、`gated`、`denied`、`reachable`、`supported`）、`setGyroEnabled`、`skyWindow`、`setSkyWindow` |
| 界面 | `openPicker`、`closePicker`，以及倾斜引导和天空之窗邀请的打开/关闭函数 |
