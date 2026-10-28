<!--
  图片使用相对本文件的路径：这个包是私有的（不在 npm 上），所以 README 在
  GitHub 上读，图片在那里能正确解析。如果以后发布，改用
  https://hux.pro/img/docs/vitre/...（npm 只渲染绝对地址的图片）。
-->

# Vitre

*AI 翻译自[英文原文](./README.md)。*

iOS 26 上的 Safari `theme-color`，外加稳定的页面边缘。Vitre 在页面四周画一圈
bezel，实时给 Safari 的玻璃工具栏和状态栏着色，并让页面在容器里滚动，边缘就不会
跟着动。用于 React。

*Vitre* 是法语的“窗玻璃”。iOS 26 的 Safari 把它的栏画成盖在页面边缘上的玻璃，
颜色取自下面的内容。Vitre 就是这些边缘处的窗框和玻璃。

文档在 [hux.pro/lab/vitre](https://hux.pro/lab/vitre)，旁边有一台模拟 iPhone
跑着 demo；每个导出都列在 [hux.pro/lab/vitre/api](https://hux.pro/lab/vitre/api)。
公开 API 是 [`vitre.d.ts`](./vitre.d.ts)。实现一旦偏离它，`src/contract.ts`
就会让类型检查失败。这份 README 写的是 lab 没写的部分：实测 iOS Safari 的行为、
这个包怎么绕过它，以及它的局限。

## 效果

<p>
  <img src="../../public/img/docs/vitre/bezel-on.png" width="49%" alt="lab 的模拟 iPhone 里的 demo，bezel 开着：状态栏和工具栏是黑色，页面内侧边缘是黑色圆角，页面在 bezel 里滚动到中间。" />
  <img src="../../public/img/docs/vitre/bezel-off.png" width="49%" alt="同一台手机、同一个滚动位置，bezel 关着：状态栏和工具栏变成页面的白色底色，圆角消失。" />
</p>

`/lab/vitre` 手机里的 demo，滚动到中间，左边 bezel 开着，右边关着。开着时，
两条栏取 bezel 的颜色（黑色），页面在里面被裁成圆角；关着时，它们取页面的底色。
这里的栏是 lab 根据 `theme-color` 模拟画出来的；在 iPhone 上，Safari 自己的栏
也是同样的表现。

## 术语

Vitre 管三件事：

| 术语 | 含义 | 在 API 里 |
|---|---|---|
| **bezel** | 页面四周的边框：每条边一道 band，内侧是圆角，只有一种颜色。 | `BEZEL_*`、`clampBezel*`、`data-bezel`、`--bezel-color`、`--bezel-band` |
| **chrome** | Safari 的状态栏和工具栏。bezel 开着时显示 bezel 的颜色，关着时显示页面的底色。 | `syncChrome`、`CHROME_*`、`chromeMorph` |
| **scroll** | 页面在哪里滚动：`window`，或者 `container`（window 保持不动）。 | `scroll`、页面滚动 API、`PAGE_SCROLL_TIMELINE` |

其余的都以库名命名：`<Vitre>`、`useVitre`、`vitreBootScript`、
`VITRE_LAYER_ATTRIBUTE`、`data-vitre-*`、`#vitre-scroll`。

## 用法

```tsx
import { Vitre, BEZEL_INSET, VITRE_LAYER_ATTRIBUTE, vitreBootScript } from "vitre";

// <head>: paint the first frame right, before React.
<script dangerouslySetInnerHTML={{ __html: vitreBootScript(resolverSource) }} />

// Around the page.
<Vitre
  enabled={on}          // null until the client knows; holds what the boot script applied
  color="#000000"
  band={0}
  radius={16}
  scroll={on && isIOS ? "container" : "window"}
  ground={theme === "dark" ? "#1a1a1a" : "#ffffff"}
  backdrop={<div {...{ [VITRE_LAYER_ATTRIBUTE]: "" }} style={{ position: "fixed", ...BEZEL_INSET }} />}
>
  {page}
</Vitre>
```

每个 prop 都在 [lab 的指南](https://hux.pro/lab/vitre)里有一节，旁边的手机实际跑着它；
boot 解析器见 [The first frame](https://hux.pro/lab/vitre#boot)。

## 滚动

`scroll` 决定页面由谁滚动：window，或者 bezel 里的一个容器，此时 `<html>` 和
`<body>` 保持不动。`<Vitre>` 把选择写到 `<html>` 上（`data-vitre-scroll`），
其他代码都从那里读。它和 `enabled`、`color`、`band` 互不相关。bezel 开着时，
用 container 滚动。

![两个面板。window 滚动：html 滚动并承载 --page-scroll 时间线；body 在文档流中；Vitre 的 bezel、backdrop 和 body > .fixed 是 position: fixed；#vitre-scroll 在文档流中。container 滚动：html 带有 data-vitre-scroll="container"，不滚动；body 以 inset 0 固定；bezel、backdrop 和 body > .fixed 变成 absolute；#vitre-scroll 是 absolute，负责滚动，并承载 --page-scroll。两种模式下，syncChrome 的 band 都是 html 的 fixed 子元素。](../../public/img/docs/vitre/scroll-modes.svg)

同一个页面的两种模式。container 滚动时，`<body>` 里所有全屏图层都变成 absolute
（虚线），页面画的任何东西都不会给 chrome 着色，滚动和 `--page-scroll` 时间线都交给
`#vitre-scroll`。只有 `syncChrome` 的 band 作为 `<html>` 的子元素，仍然 fixed 在
Safari 取色的位置。

| | `window` | `container` |
|---|---|---|
| 滚动元素 | document | bezel 里的容器 |
| Safari 工具栏 | 随滚动收起和展开 | 保持展开 |
| `getScrollContainer()` | `null` | 容器 |
| `window.scrollY`、`scrollTo`、`scroll` 事件 | 页面 | 不是页面的滚动 |
| `animation-timeline: scroll(root)` | 页面 | 不生效，改用 `--page-scroll` |
| 点击状态栏 | 滚动到顶部 | 在 iOS 上滚动到顶部（见[轻点状态栏](#轻点状态栏)） |
| 全屏 fixed 图层（`body > .fixed`、`body >` 下内联 `position: fixed` 的元素、`VITRE_LAYER_ATTRIBUTE`） | fixed | absolute |
| `position: sticky`、IntersectionObserver、`scrollIntoView`、锚点 | 正常 | 正常 |

切换模式会保留滚动位置，并通知页面滚动监听器。

读取或驱动页面滚动的代码都要经过这个包：任何需要传入滚动元素的地方用
`getScrollContainer()`（`useVitre().scroll` 变化时重新绑定），其余用
`pageScrollTop`、`pageScrollHeight`、`pageViewportHeight`、`pageOffsetOf`、
`scrollPageTo`、`onPageScroll`、`usePageScroll` 和 `emitPageScroll`，它们每次调用
都会读取当前模式，没有 `<Vitre>` 时直接作用于 window。滚动驱动的 CSS 绑定到
`animation-timeline: --page-scroll`（`PAGE_SCROLL_TIMELINE`）或
`scroll(nearest)`。页面该用哪一种，附带示例，见
[Page scroll, in either mode](https://hux.pro/lab/vitre#pageScroll)。

## Chrome：有什么需要重新加载吗？

没有。只要每次变化都让 chrome 看到，一切都是实时的。

“每次加载只有一种颜色”是为了应对 iOS 26 Safari 不重新读取根背景色的权宜之计
（见 [iOS Safari 的实际行为](#ios-safari-的实际行为)），并不是平台的限制。
`syncChrome(color, { band, radius })` 用 bezel 的一次形变把新颜色展示给 Safari：
一个新颜色的 fixed bezel 在 160ms 内从当前 band 长到 `CHROME_MORPH_PX`（8px；
更厚的 band 保持不变），停留 440ms，再用 280ms 缩回去，圆角始终贴着内侧边缘。
它同时也设置 `theme-color`，给 iOS 18 用。chrome 的颜色该变时，`<Vitre>` 就会
调用它。

有两个细节让它起作用，都经过实测：

- **每条 band 都是独立的 fixed 元素。** Safari 采样的是 fixed 元素盒子下方合成出来
  的内容，所以一个透明的全屏容器里放着彩色子元素，并不会改变 chrome。
- **band 是 `<html>` 的子元素。** container 滚动时，`<body>` 的 fixed 子元素会变成
  absolute，而 Safari 不对 absolute 的内容采样。

这次形变是给会从页面采样的 chrome 准备的，也就是 iOS Safari。其他地方都传
`chromeMorph={false}`（或 `syncChrome(color, { morph: false })`）。`theme-color`
照样会设置，Android Chrome 和 macOS Safari 会跟随它，但什么都不画。在桌面窗口上，
这次形变只会让每次切换主题都出现 880ms 的 8px band。

在一段 bezel 在浅色页面上打开的录屏里，band 到达边缘后的一个 50ms 帧之内，chrome
就从白色变成了黑色。8px 的 band 停留约 450ms，缩回 0px 之后 chrome 仍然是黑色。

| 不重新加载时的变化 | 没有 `syncChrome` | 有 `syncChrome` |
|---|---|---|
| 打开 bezel | chrome 停在底色 | bezel 的颜色 |
| 关闭 bezel | chrome 停在 bezel 的颜色 | 底色 |
| 色调从 black 改成 dark | 未测试 | chrome 为 `(26, 26, 26)` |
| 切换主题，bezel 颜色跟随主题 | chrome 停在白色 | `(26, 26, 26)`，再切回时变回白色 |
| 切换主题，bezel 关着 | chrome 停在白色 | chrome 为 `(26, 26, 26)`，再切回时变回白色 |
| 切换主题，bezel 开着 | 未测试 | chrome 保持 bezel 的颜色 |

## 哪些是实时的，怎么做到

`<Vitre>` 的每个 prop 都是实时的：

| 变化 | 做法 |
|---|---|
| `enabled`、`color`、`band` | 在 layout effect 里写到 `<html>` 上（`data-bezel`、`--bezel-color`、`--bezel-band`、背景色）。chrome 应显示的颜色变化时，重新同步 chrome（只改 band 不会重新同步）。 |
| `radius` | 圆角重新渲染。 |
| `scroll` | 在 `<html>` 上写 `data-vitre-scroll="container"`。滚动位置在 window 和容器之间转移，页面滚动监听器会触发。在 iOS 上，页面离开顶部时，轻点状态栏能作用到容器。 |
| `ground` | bezel 关着时重新同步 chrome。 |
| 页面隐藏或显示 | `visibilitychange`、`pagehide` 和 `pageshow` 会把颜色重新展示给 chrome。离开再回来（主屏幕 Web App 关闭后重开、Safari 进入后台）会让 iOS 采样页面背景。 |
| 有东西清空了 `<html>` 的属性 | 一个 mutation observer 在下一次绘制前恢复状态。 |

## 轻点状态栏

轻点状态栏会滚动到顶部，而 iOS 只把这个手势交给主 `WKScrollView`。WebKit 给它创建的
每个溢出 `UIScrollView` 都设了 `scrollsToTop = NO`，所以滚动容器永远拿不到这个手势。

window 可以拿到。`<body>` 以 inset 0 固定，所以几个像素的 window 滚动在屏幕上什么都
不会移动。页面离开顶部时，`<html>` 会加上 `data-vitre-status-tap`，获得几个像素的
滚动范围，并停在其中一个位置（park）。当 Safari 把它滚回 0，而且手指不在屏幕上、视口
也没变，那就是一次轻点。随后容器沿着 chrome 形变的曲线缓动回顶部，按距离用 280 到
640ms。开启减弱动态效果时直接跳到顶部。一次触摸会让它停在原地。

它要把四个时机处理对：

- **每帧只做一次决定。** 滚动事件是异步的，一帧里可能有两个：容器的和 window 的。
  处理函数只在 `requestAnimationFrame` 里安排一次协调，它在这一帧的滚动事件之后运行。
  如果处理函数直接动手，容器的处理函数可能在 window 的处理函数运行前就把 window 重新
  park 了，轻点就会时不时被吞掉，取决于哪个滚动元素先动。
- **轻点通常发生在惯性滚动中途。** 合成器还在施加的惯性会和每一次写入的 `scrollTop`
  打架。所以先结束惯性滚动：加一帧 `overflow: hidden`，而且必须覆盖整整一帧，否则合成器
  根本看不到。如果容器还是动了，回到顶部的动画会以新位置为起点重新计算，而不是把它拽回
  一条过时的曲线上。
- **park 只是一个请求。** 在 iOS 上，主 frame 在 UI 进程里滚动，所以刚调用完
  `window.scrollTo`，`window.scrollY` 报告的仍是旧的偏移。park 要稍后才能确认，
  只有确认过的 park 才能被当作轻点，或被撤回。
- **布防会解除页面锁定。** 弹层库会把 `<html>` 上的 `overflow: hidden` 当作“已经锁定”
  （Base UI 读取视口滚动元素计算后的 `overflow-y`）。布防期间，`<html>` 读起来不是
  这样。所以一旦有东西往 `<html>` 上写内联 overflow，布防就让开，清掉后再重新布防。
  park 没生效也没关系：下一次滚动、mutation 或 resize 会再试一次，每次失败的 park
  最终都会落到其中之一。

它只在 iOS 上运行。其他地方没有这个手势可接，`<html>` 最好不要去动。宿主可以在任何
地方打开 container 滚动（hux.pro 的 devtool 就可以），所以判断的是平台，而不是模式。

## 局限

- 渲染在滚动容器里的 fixed 弹层，显示时可能伸到视口边缘，在这段时间里给 chrome 着色。
- 形变是看得见的：一道新颜色的 8px band，持续约 600ms。
- iOS 18 展开的底部工具栏既不跟随 `theme-color`，也不跟随根背景色。
- container 滚动时，样式表会把 `body > .fixed`（Tailwind 的类）和 `<body>` 下内联
  `position: fixed` 的直接子元素变成 absolute。其他全屏图层必须带上
  `VITRE_LAYER_ATTRIBUTE`，否则会保持 fixed 并给 chrome 着色。
- container 滚动时，页面看起来是锁定滚动的（`<html>` 是 `overflow: hidden`）。
  行为良好的弹层库看到这一点会让开，Base UI 的对话框就是这样，于是宿主的布局保持不变。
  总是通过往 `<body>` 上写 `position: relative` 和高度来锁定的库，会把这个布局压垮，
  所以采用之前先检查。轻点状态栏处于布防状态时，`<html>` 读起来不是锁定的，这样的库
  就会接管。在 iOS 上，Base UI 的锁定只是 `<html>` 上的一个内联
  `overflow: hidden`，只要它还在，布防就一直让开。
- 轻点状态栏和滚动锁定不能同时成立，所以 sheet 打开时这个手势不起作用。sheet 关闭后
  就恢复。
- container 滚动时，其他代码调用 `window.scrollTo(0)` 会被当作一次轻点。hux.pro 上
  没有这样的代码。`scrollPageTo` 移动的是容器。

## 演示与文档

![桌面上的 Vitre lab：顶栏是各节的标签，左边是画出来的 iPhone 跑着 demo，右边是指南的第一节。](../../public/img/docs/vitre/lab.png)

桌面上的 `/lab/vitre`：画出来的手机跑着 demo，屏幕中间的那一节驱动它。

- **demo** 是 `packages/vitre/site`，用 Vite 构建，只导入 `vitre`。它是 `<Vitre>`
  里的一个小站点，每张卡片演示一个功能，还有一个 devtool，能编辑每个 prop，并显示 Vitre
  解析出的结果、写到 `<html>` 上的内容和设置的 `theme-color`。设置会保存，下次加载时
  boot 脚本按它绘制，所以能测试 Safari 真正的 chrome。
- **部署位置。** hux.pro 把它构建到 `public/vitre`，在 `/vitre` 提供。手机在那里全屏
  打开；其他 user agent 会被重定向到 `/lab/vitre`（`next.config.ts`），在画出来的
  手机里以嵌入方式（`/vitre/index.html?frame`）运行，跟随站点的浅色或深色，每一节通过
  `postMessage` 驱动它。`/vitre/index.html` 本身从不重定向。
- **在 `pnpm dev` 里**，demo 缺失或比源码旧时，会在 Next 启动前先构建
  （`scripts/vitre-demo.mjs`）；它在站点里没有热更新，所以用
  `pnpm vitre:site:build` 重新构建。
- **文档的内容**留在这里，`site/src/docs`：各节（`sections.tsx`）和 API 参考
  （`api.ts`），中英双语。每个导出和 prop 都有文档，参考会对照 `vitre.d.ts` 做类型
  检查，所以有未写文档的导出或 prop 时，`pnpm vitre:typecheck` 会失败。hux.pro 的
  lab 负责渲染（`app/lab/vitre`，用 lab 的库模板）：带标签和模拟器的指南、由 `api.ts`
  生成的 API 页面，以及 hux.pro 自己怎么用这个包（`/lab/vitre/site`）。页面是 lab
  的，文字是包的。

单独开发 demo：

```bash
pnpm vitre:site
```

然后在同一网络下的手机上，或在 iOS 模拟器里打开 `http://localhost:5173/vitre/`。
（`vite dev` 在任何屏幕上都显示 demo；要看文档，请运行 hux.pro。）

## 测试

```bash
pnpm vitre:typecheck
```

它对照 `vitre.d.ts` 检查实现（`src/contract.ts`），也对照 `vitre.d.ts` 检查 lab 的
API 参考（`site/src/docs/api.ts`），所以新的导出或 prop 在写好文档之前都会失败。它还会
对 demo 做类型检查。

## iOS Safari 的实际行为

上面每条规则依据的实测结果。在 iOS 26.5 模拟器里读取截图像素测得，并在真机上核对过。
iOS 18.5 不同的地方另有注明。

| 行为 | iOS 26.5 | iOS 18.5 |
|---|---|---|
| 加载时的 chrome 颜色 | 根背景色，或贴着视口边缘的 `position: fixed` 内容。它复制的是合成出来的像素，即使内容是透明的。 | `theme-color` |
| 之后修改根背景色 | 不会重新读取，chrome 保持旧颜色。 | 不会重新读取 |
| 之后修改 `theme-color` | 忽略 | 跟随 |
| 之后加入的贴边 fixed 内容 | 从 6 CSS px 厚起实时跟随（5 不生效；`CHROME_SAMPLE_PX`）。内容移除后颜色保留。 | 未测量 |
| 工具栏收起 | 用户向下滚动文档时收起，向上滚动时展开。脚本触发的滚动不改变它，但滚到顶部会展开。每次收起都会重新采样 chrome。 | 用户滚动时相同。脚本滚动未测量。 |
| 竖屏时的安全区 | 全部为 0 | 全部为 0 |
| React 19 水合失败（错误 #418） | 清掉 `<html>` 上的所有属性 | 相同 |

### iOS Safari 上的 window 滚动

为什么 bezel 要配 container 滚动。在 iOS 26.5 模拟器里测得：

- **边缘漏出。** 工具栏每次收起或展开，底部 band 下面都会露出最多约 50px 的页面，
  持续约 200ms。Safari 还在按旧的视口尺寸绘制 fixed 元素。
- **实时变化。** 工具栏收起会让 Safari 重新采样边缘。偶尔在一次实时变化之后，chrome
  会停在错误的颜色上，直到重新加载。

---

给贡献者：在 hux.pro 里开发这个包有一份检查清单，即 skill
[`.claude/skills/vitre`](../../.claude/skills/vitre/SKILL.md)。
