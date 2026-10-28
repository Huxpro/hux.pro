---
origin: "AI-translated from the original"
---

# App 图标系统

一个**生成式**的 App 图标：favicon 和主屏幕图标是一份小配置的纯函数，而不是一次性手绘的作品。在 `/lab/icon` 里调整各项参数，保存，提交进仓库的资源文件就会重新生成。设计保持*稳定*（同一份配置得到同一个 SVG），同时又*可编辑*。

> 遵循设计语言：一个安静的字标（"mostly just the name of the site"），叠在低对比度的纹理上。只用灰度，没有强调色。

## 做好了是什么样

![桌面宽度下的 Icon Lab：顶栏显示实时读数 "λHUX · Grid · r 0.00"，以及 SVG、Reset 和 Save 按钮；中间舞台是 256 的 App 图标和尺寸阶梯；右侧面板是 Typography 和 Background 两组控件。](/img/docs/app-icon/lab-desk.png)

1280 宽下的 `/lab/icon`。右侧面板放着每一个参数；舞台实时预览当前配置，只要没有改动，Save 就保持灰色。

![五个生成文件按 1:1 像素展示：icon.svg 和 icon-512.png 以 512 并排，然后是 icon-192.png、180 的 apple-icon.png，以及 favicon.ico 的 48、32、16 三帧。](/img/docs/app-icon/outputs.png)

`pnpm icon:generate` 写出的文件，按 1:1 像素绘制。浏览器渲染的 `icon.svg`（左上）和 resvg 生成的 `icon-512.png`（右上）逐字形一致：两者都用 300 字重的 JetBrains Mono，一个把字体内嵌进去，另一个把字体交给光栅化器。ICO 的 16px 帧只是一团模糊；它只给用不了 SVG 的浏览器准备。

## 工作原理

![content/icon.json 由 lab 的 Save 通过 POST /api/icon 写入，由 pnpm icon:generate 读取；两者都调用 generateIconAssets，它先规范化配置，用内嵌 woff2 字体的 buildIconSvg 渲染出 icon.svg，再用 resvg 和一个 TTF 光栅化出 apple-icon.png、icon-192.png、icon-512.png 和 app/favicon.ico。pnpm icon:check 重新渲染 SVG，去掉字体块后与已提交的文件比较。](/img/docs/app-icon/pipeline.svg#bleed)

一份配置，两个写入方，一个生成器。图从左往右读。

| 部分 | 位置 |
|-------|----------|
| 配置（唯一事实来源） | `content/icon.json` |
| 配置类型、默认值、`normalizeIconConfig`（钳制每个字段） | `lib/icon/config.ts` |
| 纯 SVG 渲染器（`buildIconSvg`） | `lib/icon/render.ts` |
| 字形子集字体（`fetchEmbeddedFontFace`、`fetchFontBuffer`） | `lib/icon/fonts.ts` |
| SVG 转 PNG（`rasterizeSvgToPng`，resvg）和 `.ico`（`encodeIco`） | `lib/icon/raster.ts` |
| 资源生成（`generateIconAssets`，仅限 Node） | `lib/icon/generate.ts` |
| Icon Lab | `app/lab/icon`（`/lab/icon`） |
| 开发环境保存 API（GET / POST，生产环境返回 403） | `app/api/icon/route.ts` |
| CLI（`icon:generate`，以及带 `--check` 的 `icon:check`） | `scripts/icon-generate.ts` |
| Web manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| 接入 `<head>` | `app/layout.tsx` → `metadata.icons` |

### 主屏幕覆盖

每个平台要的格式不同；它们都出自同一份配置：

| 平台 | 用的是什么 | 资源 |
|----------|--------------|-------|
| 浏览器标签页（现代） | `<link rel=icon>` SVG | `public/icons/icon.svg`（512） |
| 浏览器标签页（旧版） | `/favicon.ico`（16/32/48） | `app/favicon.ico` |
| iOS "添加到主屏幕" | `apple-touch-icon` PNG（180） | `public/icons/apple-icon.png` |
| Android / Chrome PWA 安装 | web manifest → PNG 192/512（+ maskable） | `app/manifest.ts` + `public/icons/icon-{192,512}.png` |

`app/favicon.ico` 由 Next 的文件约定链接；`layout.tsx` 在此之上再加上 SVG 和 apple-touch-icon。manifest 把 512 列了两次，第二次带 `purpose: "maskable"`：图标是满版底色加居中的标记，所以不需要单独渲染一份带安全区的版本。

### 字体

字标始终是 JetBrains Mono，用配置里的字重和斜体，从 Google Fonts css2 API 获取，`text=` 只设为字标里的字形。它会被获取两次，两种格式：

- **SVG：** 一个 woff2 子集，作为 `@font-face` data URI 内联在 `<style>` 块里，这样 favicon 离开页面也能用自己的字体渲染。
- **PNG / ICO：** 一个静态 TTF（Google 会把它提供给旧版 user agent），因为 resvg 渲染 woff2 子集时字重不对。resvg 会忽略内联的 `@font-face`，它的 `fontBuffers` 选项又会悄悄改为加载系统字体，所以 TTF 先写进一个临时文件，作为 `fontFiles` 传入并关闭系统字体，光栅化用的 SVG 再按字体的真实 family 名称请求它（字重 300 时是 `JetBrains Mono Light`）。

两次获取都是尽力而为。离线时，SVG 写出时不带 `<style>` 块，光栅图回退到系统等宽字体；命令仍然成功（见下面的规则）。

resvg（`@resvg/resvg-js`）是 devDependency，只由生成器动态导入。资源文件已提交进仓库，所以部署的网站从不运行它。

## Lab

打开 **`/lab/icon`**（从 `/lab` 索引进入；`noindex`）。在 `lg` 以下，面板收进顶栏的滑块按钮（Controls）后面，Save 和 Reset 不显示：写入图标是宽屏上的活儿。顶栏的读数是 `wordmark · texture · r <cornerRadius>`。

**舞台。** 256 的 App 图标、一组尺寸阶梯（128、64、32、16）和两种遮罩（圆形、方形）。图标和阶梯都按 22% 的 CSS 圆角裁切，模拟系统遮罩的效果。每个预览都是一份 512 渲染，直接内联进 DOM（不是 `<img>`），再由 CSS 缩放，并各自带一个 `idPrefix`，免得内联副本的 `url(#…)` defs 互相串线。预览把 `font-family` 设为 `var(--font-mono)`，即 `next/font` 在全站加载的 JetBrains Mono，因此与发布的 SVG 里内嵌的字体一致。

![lab 舞台上 App 图标下方的部分：Sizes 阶梯为 128、64、32 和 16，Masks 一行是裁成圆形和方形的图标。](/img/docs/app-icon/lab-sizes-masks.png#bleed)

尺寸阶梯和遮罩。要盯的是圆形遮罩：字标必须留有余量地落在圆内。

**Typography：** Wordmark（文本框和五个预设：`λHUX`、`hux`、`λhux`、`λ`、`hux.pro`）、Weight、Size、Tracking、Nudge Y、Nudge X、Italic、Wordmark colour。字体和大小写不是可调参数：字标始终是等宽字体，原样绘制，一个终端风格的系统标记。

**Background：** Texture（Solid / Dots / Grid / Lines / Noise / Grad）和一个共用的 Base colour。每种纹理在配置里保留各自的设置，所以切换样式时不会继承另一种纹理的调校。显示哪些控件取决于纹理：

- Dots、Grid、Lines、Noise：Texture colour、Texture opacity、Density。
- Lines 和 Grad：Angle。
- Grad：Gradient end（从底色渐变到这个颜色）。
- Solid：除了底色之外什么都没有。

**Shape：** Corner radius，烘焙进 SVG。保持为 0。

**操作。** **Save**（仅 `next dev`）把配置 POST 到 `/api/icon`，后者规范化配置、写入 `content/icon.json` 并重新生成全部五个资源；会有一条提示说明光栅图是否已写出。在配置与上次保存不同之前它是禁用的。**Reset** 载入默认配置但不保存。**SVG** 把当前渲染下载为 `icon.svg`，不含内嵌字体。

## 规则

- **配置和全部五个输出一起提交：** `content/icon.json`、`public/icons/icon.svg`、`apple-icon.png`、`icon-192.png`、`icon-512.png` 和 `app/favicon.ico`。Save 和 `pnpm icon:generate` 写出的是同一组文件。
- **联网重新生成，并阅读输出。** 离线时命令仍以 0 退出，但 SVG 会丢失字体（标签页显示平台自带的等宽字体），PNG 和 ICO 也用系统等宽字体绘制。提交前确认看到 `✓ Wordmark font embedded in SVG` 和 `✓ PNG + favicon.ico rasterized`，并亲眼看一看 PNG：git 只把它们显示为二进制。
- **CI 不检查图标。** `.github/workflows/ci.yml` 只运行 `pnpm og:complete` 和 `pnpm badges:check`。`pnpm icon:check` 要自己跑。它在内存中重新渲染 `icon.svg`，两边都去掉 `<style>` 块后与已提交的文件比较，所以只有字体不同时也能通过。它不看 PNG 或 ICO（它们的字节随 resvg 版本变化）：过时的光栅图也能通过。
- **让标记保持在 maskable 安全区内。** 512 兼作 maskable 图标，Android 可能把它裁成边长 80% 的居中圆形（半径 205px）。目前字标的四角离中心约 194px。更长的词、更大的 Size 或更宽的 Tracking 都会把它们往外推；舞台上的圆形遮罩能看出来。
- **Corner radius 保持为 0。** 大多数平台会套上自己的遮罩（舞台上有预览）；烘焙进去的圆角会被裁两次。
- **灰度。** 图标遵循设计语言：没有强调色。

## 修改图标

1. `pnpm dev`，在 `lg` 或更宽的宽度下打开 `/lab/icon`，调整，然后 Save。或者手动编辑 `content/icon.json`，再运行 `pnpm icon:generate`。
2. 检查那两行 `✓`（Save 的提示只说明光栅图是否已写出）。
3. `pnpm icon:check`。
4. 打开 PNG 和 `app/favicon.ico`；在 lab 里检查圆形遮罩。
5. 提交这六个文件。

## 参考：`content/icon.json`

`normalizeIconConfig` 用 `DEFAULT_ICON_CONFIG` 填补缺失的字段，并钳制每个数值，所以手动编辑过的文件总能渲染。尺寸和偏移都是画布边长的比例。

| 字段 | 钳制范围 | Lab 控件 | 绘制内容 |
|-------|-------|-------------|-------|
| `text` | 前 24 个字符 | Wordmark | 字标，原样、居中 |
| `fontWeight` | 100–900（lab：步长 100） | Weight | 获取并设置的字重 |
| `fontSize` | 0.1–0.95 | Size | 字号 = `fontSize × edge` |
| `letterSpacing` | −0.2–0.5 em | Tracking | 字间距 = `letterSpacing × font size` |
| `italic` | 布尔值 | Italic | 获取并设置斜体 |
| `textColor` | 任意字符串 | Wordmark colour | 字标的填充色 |
| `offsetX`、`offsetY` | −0.5–0.5（lab 滑块：−0.3–0.3） | Nudge X / Y | 移动文字中心 |
| `background.style` | `solid dots grid lines noise gradient` 之一 | Texture | 绘制哪种叠加层 |
| `background.color` | 任意字符串 | Base colour | 满版的底色填充 |
| `background.<texture>` | `textureColor`、`textureOpacity`（0–1）、`scale`（0–1）、`angle`（0–360）、`gradientColor` | 按纹理 | 见下文 |
| `cornerRadius` | 0–0.5 | Corner radius | 底色、裁切和渐变的 `rx` |

每种纹理如何使用它的设置（`render.ts` 里的 `buildBackground`）：

| 样式 | 形状 |
|-------|-------|
| `dots`、`grid`、`lines` | 一个 `max(8, round(edge × (0.18 − 0.13 × scale)))` px 的图案单元：`scale` 越大越密。Dots：半径为单元 12% 的圆。Grid：在两条边上画 4% 宽的描边。Lines：一条 18% 宽的条带，单元按 `angle` 旋转。以 `textureColor` 和 `textureOpacity` 绘制。 |
| `noise` | `feTurbulence` 分形噪声，`baseFrequency = 0.4 + 1.4 × scale`，去饱和后以 `textureColor` 和 `textureOpacity` 填充。`angle` 不使用。 |
| `gradient` | 沿 `angle` 从 `background.color` 到 `gradientColor` 的线性渐变。`textureColor`、`textureOpacity` 和 `scale` 不使用。 |

## 为什么是这个形状

它沿用 OG 快照的做法：一个与框架无关的渲染器（`lib/icon/render.ts`，类似 `lib/og-core.ts`），lab 预览、开发环境的保存路由和 CLI 都用它，所以预览到的和发布出去的出自同一份代码。提交进仓库的文件就是生产产物；部署的网站在运行时不需要任何图像库。
