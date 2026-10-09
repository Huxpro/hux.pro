---
origin: "AI-translated from the original"
---

# Window 系统：给 App 用的窗口

点一下某个 App（主屏上的 **App 文件夹**，或 ⌘K 的 Apps 栏），它会在一个可拖动、可调整大小的窗口里打开。这里的隐喻是 macOS/iPadOS 的"打开一个 App"，取台前调度（Stage Manager）的格调：内容铺满到边缘，上面只浮着一个 **pill**。在手机上，同一个 App 则是一个 **sheet**，所有 chrome 都收在一个把手里，因为这么大的屏幕本来就用这种习惯。一个窗口框架承载两种运行时：

- **Web App** 加载在 `<iframe>` 里。
- **Lynx App** 加载在 **Lynx Player** 里：`@lynx-js/web-core` 的 `<lynx-view>` 元素运行一个 `.web.bundle`。它沿用 Lynx 在设备上的双线程模型（主线程 + 后台 Worker），在浏览器里复现出来。

两者外面的 chrome 完全一样，只有内容部分不同。

这不是 `AdaptiveSurface` 的 `window` 形态（壁纸选择器、播放列表）；那是给站内界面用的浮动面板，在 [Surface System](./system-surface.md) 里讲。App 窗口是一个独立的系统，有自己的拖动逻辑，也不在 devtool 的可拖动列表里登记任何东西。

## 做好了是什么样

![Cat Wand，一个 Lynx App，在桌面上以竖向窗口打开：内容铺满到边缘的黑色画面，左上角的红绿灯 pill 被点亮，旁边是 App 的标题。](/img/docs/system-windows/desk-window.png)

一个 Lynx App（Cat Wand，从 ⌘K 的 Apps 栏打开），在 1280px 宽的桌面上，鼠标停在它的 pill 上。静止时 pill 是看不见的，圆点是暗灰色；鼠标移上去时它填上玻璃，圆点显出各自的颜色，标题滑入。没有标题栏。

![pill 下方以 popover 形式出现的窗口菜单：App 头部（Cat Wand，Lynx · Vue）、Portrait（已勾选）、Landscape、Maximize，然后是 Reload、Minimize、Close。](/img/docs/system-windows/desk-menu.png)

同一个窗口的菜单，在 pill 上右键打开。Lynx App 没有 "Open in browser" 这一行；Web App 会在 Reload 和 Minimize 之间多出这一行。

![页面顶部的 Dock 条带里有一个胶囊：Cat Wand 的图标带着 Lynx 角标，以及它的名字。](/img/docs/system-windows/minimized.png)

最小化后，它变成一个胶囊停在 Dock 的 Live Activity 条带里。背后的 Lynx view 仍在运行；点一下，它回到原来的位置，保持原来的状态。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-windows/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的 Cat Wand：一个从底边升起的 sheet，App 铺满到边缘，唯一的 chrome 是浮在顶部正中的三个暗色圆点。" />
  <img src="/img/docs/system-windows/phone-menu.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="点一下圆点之后的同一个窗口：圆点在玻璃上亮起，窗口退后一步，菜单作为 sheet 叠在它上面，有 Reload、Minimize 和红色的 Close。" />
</div>

同一个 App 在手机上（393pt 宽，无头浏览器，所以没有安全区 inset）。左：一个 sheet 停在 Dock 条带正下方，它的把手就是浮在内容上的三个圆点。右：点一下把手，把手亮起，菜单作为 sheet 叠在窗口上，窗口退后一步。没有尺寸选项：detent 就是尺寸。

改动要守住的标准：

- 内容区归 App 所有。上面除了 pill 什么都没有，而 pill 在需要之前是看不见的。
- 把 App 收起来永远不会丢掉它。只有 Close（以及 Reload）会让它重新开始。
- 每个 App 只有一个窗口。再次打开就是把它聚焦。
- 菜单在哪里都是同一份列表，变的只是装它的容器。
- 任何控件都不会消失：不管把手被卡在什么状态，它都仍然显示那三个圆点。

## 原理

```
systems/windows/
├── provider.tsx                # WindowProvider + useWindows (the state machine)
├── lib/
│   ├── types.ts                # WindowInstance, Rect, WindowMode
│   ├── geometry.ts             # size presets, placement, clamps, working area
│   ├── pointer.ts              # armPointer (tap · long-press · drag), TAP_SLOP
│   └── lynx-shadow-css.ts      # generated: flattened web-elements layout CSS
├── components/
│   ├── window-layer.tsx        # <WindowLayer>: the fixed "desktop" surface
│   ├── window.tsx              # <Window>: the shape fork; <DesktopWindow>'s gestures
│   ├── window-sheet.tsx        # <WindowSheet>: a window on a phone, as a sheet
│   ├── window-grip.tsx         # the pill doing double duty as the sheet's handle
│   ├── window-pill.tsx         # TrafficDots, PillTitle, pillShell: one look, two homes
│   ├── window-chrome.tsx       # <WindowChrome>: the desktop pill + popover menu
│   ├── window-menu.tsx         # WindowMenuBody (the rows) + WindowMenuSheet
│   ├── minimized-dock.tsx      # <MinimizedWindows>: Dock capsules (direct restore)
│   ├── app-frame.tsx           # runtime switch: WebFrame vs LynxFrame; appGround
│   ├── web-frame.tsx           # <iframe> + "may block embedding" fallback
│   ├── lynx-frame.tsx          # ssr:false boundary around the player
│   ├── lynx-player.tsx         # <lynx-view>: the Lynx Player
│   ├── app-badge.tsx           # runtime marker on icons
│   └── app-icon-plate.tsx      # the app's icon, for the menu header and Dock pill
├── lynx-view.d.ts              # <lynx-view> JSX typing
└── index.ts
```

`WindowProvider` 挂载在 `shared/providers.tsx` 里。`app/layout.tsx` 挂载一次 `<WindowLayer />`，并把 `<MinimizedWindows />` 作为 `<Dock>` 的子元素挂载。

### 管理器

`WindowProvider` 是一个纯状态机。它管着有哪些窗口打开、它们的层叠顺序，不管任何视觉上的东西（和 Dock 系统同样的分工）。

![状态图：openApp、openUrl 和 openBundleUrl 进入 mode "normal"；minimize(id) 进入 mode "minimized"，restore(id) 回来；reload(id) 递增 generation 并重新挂载 AppFrame；close(id) 从任一状态卸载。下方：最小化的桌面窗口仍由 WindowLayer 渲染，opacity 为 0 且 inert；最小化的手机窗口是一个带 keepMounted 的已关闭 SurfaceSheet。](/img/docs/system-windows/lifecycle.svg)

`provider.tsx` 里的每一个调用，以及它对窗口做了什么。最下面一行是两种形态都遵守的承诺，各自用各自的机制。

- **每个 id 一个窗口。** App 的 id 是它在 `content/apps.json` 里的 id；网页是 `url:<url>`，临时 bundle 是 `ota:<url>`。打开一个已经打开的 id，会聚焦（并取消最小化）它的窗口，而不是再开一个重复的，这一点跟随主屏的习惯，而不是"⌘N 新建一个文档"。
- **聚焦 = 层叠顺序。** 一个单调递增的计数器把目标窗口抬到其他所有窗口之上；`focusedId` 是 `z` 最高的未最小化窗口。对最前面的窗口调用 `focus` 什么都不做，因为每次按下指针都会触发它。
- **最小化** 让桌面窗口以神奇效果（genie）缩向顶部的 Dock 条带（opacity 0，scale 0.08），在那里停成一个胶囊（`MinimizedWindows`，与音乐 / 氛围的 activity 共用一行）。点胶囊（`restore`）或点 App 图标（`openApp`）都会把它带回来并聚焦。**最小化不是卸载**：`WindowLayer` 让每个窗口，包括最小化的，一直挂载着，只是透明且 `inert`，所以它的 iframe / `<lynx-view>` 继续运行，状态得以保留（计数到 5 的计数器回来时还是 5）。
- **Reload** 递增 `generation`，它是 `<AppFrame>` 的 key：对跨域 iframe 或 Lynx 运行时来说，重新挂载是唯一可用的重启方式。
- **Close** 是唯一的卸载，也是唯一的 `AnimatePresence` 退场（原地缩小）。
- **尺寸** 是一个预设（`portrait` / `landscape` / `max`），通过 `setSizePreset` 设置；`max` 就是最大化状态。**缩放**（绿色圆点 / 双击顶部条带，`toggleMaximize`）在 `max` 和之前的预设之间切换，把最大化之前的矩形存进 `restoreRect` / `restorePreset`。
- **按键交给最前面的窗口。** Esc 关闭它，但 ⌘K 面板或某个窗口的 popover 菜单打开时（`[cmdk-root], [role='menu']`），或者有输入框获得焦点时除外，这样关掉一个浮层永远不会顺带关掉它后面的窗口。在手机上，Esc 先到达 sheet，执行的是最小化。输入框之外的 ⌘A 什么都不选，所以冲着 App 按下的 ⌘A 不会把背后的页面涂成一片蓝。
- **视口会变。** `onViewportChange`（整个系统只有一个 `resize` 监听，合并到每帧一次）把最大化的窗口重新贴合到工作区，并把其余窗口限制在范围内。

### 尺寸

`geometry.ts` 放着纯数学部分。**工作区** 从左右两侧和底部各缩进 12px（`MARGIN`），从顶部缩进 56px（`DOCK_BAND`），所以窗口（包括最大化窗口的顶边）都避开了顶部居中的 Dock。

| 预设 | 尺寸（以工作区为上限） | 用途 |
|---|---|---|
| `portrait` | 400×760 | 手机形状的卡片（Lynx、移动端网页）；Lynx 的默认值 |
| `landscape` | 1024×680 | 宽卡片（文档、桌面端网页）；Web 的默认值 |
| `max` | 整个工作区 | 仍然保留宽松的顶部间距："留白"，不是全屏 |

注册表里 App 的 `size` 会覆盖默认值。新窗口每打开一个就向右下错开 28px（对 6 取模），`max` 除外。调整大小允许的最小尺寸是 300×220（`MIN_SIZE`）。`clampRect` 让整个窗口保持在工作区内（调整大小、重新布局时）；`clampDrag` 则宽松一些：窗口可以悬出左、右、下边缘，只要还有 88px 留在屏幕上，并且它顶部的 34px（`CHROME_H`）仍然够得着。

### 两种形态

App 窗口采用视口要求的形态，而 `Window`（`window.tsx`）只是一个分叉，依据是 `WINDOW_PRESENTATION = { base: "sheet", sm: "window" }`：

| 宽度 | 形态 | 是什么 |
|-------|-------|-----------|
| `< 640px` | **sheet**（`WindowSheet`） | 一个从底边升起的 `SurfaceSheet`：三个 detent 决定它的尺寸，共享的堆叠决定它的层次，它的把手承担全部 chrome。 |
| `≥ 640px` | **window**（`DesktopWindow`） | 可拖动、可调整大小的盒子。 |

这个判断用的是 surface 系统的断点表（`SURFACE_BREAKPOINTS.sm`），也就是把命令面板变成 sheet 的同一个断点，而 `isMobile`（`lib/geometry.ts`）就是由它定义的，所以由"是 sheet"推出的那些规则（一次只开一个 App）恰好在形态切换时生效。跨过断点会重新挂载 App（两个不同的组件，所以 iframe 会重新加载）；在 App 用到一半时把手机拉伸成桌面，不是任何人会做的手势。

### 手机上的窗口是一个 sheet

- **尺寸** 就是手指松开时停在的那个 detent。共有三个，而不是站内共用的那一对：`SHEET_DETENTS` 的最低和最高值（0.7 和 1），中间是窗口自己的 `dockDetent()`。窗口在那里打开，也就是桌面窗口顶边所在的位置，刚好避开 Dock 条带（`1 - DOCK_BAND / height`，限制在 0.8 到 0.97 之间，视口变化时重新计算），因为那正是 App 想要的尺寸。从那里，一次拖动可以把它拉到最顶，或者拉到 0.7 去看它背后的页面。菜单在这里不再提供尺寸预设：在手机上它们本来都解析成同一个矩形。
- **把手是唯一的拖动点。** 其他 sheet 从任何地方都能拖；窗口的内容区归 App 所有，否则一个跟着手指走的游戏（逗猫棒）会把窗口从手指下面拖走。内容区带着 Base UI 的 `data-base-ui-swipe-ignore`，所以从那里开始的触摸永远不会变成滑动。iframe 从来不需要它，因为它的触摸到不了这个文档。但 Lynx view 就在 DOM 里，两种运行时加载出来之前的那个加载转圈也是。
- **它回来时是它平常的尺寸。** 向下一甩，按定义就会停在最低的 detent，所以收起的窗口会重置到 dock detent，恢复时也在那里，而不是缩着回来。
- **是收起，不是杀掉。** 向下拖（或按 Esc）是 `minimize`，永远不是 `close`。sheet 关闭了，但 `keepMounted` 让它的 DOM 留在原地，所以 iframe 或 Lynx view 保住了自己的文档。它从 Dock 上的胶囊回来。Close 是菜单里的破坏性操作，除此之外别无他处，所以任何一次误甩都不会丢掉 App 的状态。
- **一次一个。** 在手机上打开或恢复一个 App，会把其他 App 收进 Dock（`provider.tsx` 里的 `soloOnPhone`）：第二个 sheet 只会把第一个埋起来，而不是并排放着，而 Dock 就是 App 切换器。从 `sm` 起，窗口可以共存，窗口本来就该这样。
- **它叠在打开它的东西上。** 窗口 sheet 和其他 sheet 一样处在共享的堆叠里，所以从附件 sheet 打开的窗口（一次 `Visit`）会让那个 sheet 退后一步，窗口收起时再让它回到前面。即使它是之前某次访问时被保留挂载下来的，它也会画在那个 sheet 上面，因为堆叠的顺序就是绘制顺序（[Surface System](./system-surface.md)，"Stacking"）。
- **菜单**（`WindowMenuSheet`，`presets={false}`）是叠在窗口上的一个 sheet。它是窗口 sheet 的 React 子元素，并声明 `nestedIn`，所以 Base UI 把它当作真正的嵌套 drawer，让窗口退后一步，就像 iOS 从一个 sheet 上再弹出一个 sheet 那样。
- **它画在 surface 层里**，而不是 `WindowLayer`：sheet 被 portal 到 sheet 们的 `z-60` 基准层，并通过 `usePresence` 让 `AnimatePresence` 保持打开，以便在窗口被移除之前播完退场动画。

### 把手：窗口的 pill，一身二用

sheet 本来就有一个拖动条，所以 pill 不叠在它上面：它们是同一个东西（`window-grip.tsx`，作为 `grip` 传入，配合 `gripOverlay`）。它就是窗口自己的 chrome，原样不变：浮在铺满边缘的内容之上、居中的、没有底板的一簇红绿灯，没有任何看起来像标题栏的东西。它同时也是拖动 sheet 的地方。点一下打开菜单。

它看起来和桌面上的 pill 一模一样（来自 `window-pill.tsx` 的 `pillShell` 和 `TrafficDots`，去掉了 hover），连内边距都一样：静止时没有底板、三个暗色圆点，被拇指按住时以及菜单打开期间亮成玻璃。这个亮起就是点击反馈，而 CSS 在这里给不了它。触摸从来不会设置 `:active`（把手是 `touch-none`，按下的默认行为被 preventDefault 掉了），而鼠标按下会设置它，然后*再也不清除*，因为 popup 捕获了指针，Chrome 永远看不到松开。所以亮起的状态由我们自己管，而且它被设计成**被卡住也安全**：亮起是玻璃配亮色圆点，静止是桌面上那个 pill 的样子，一次丢失了松开事件的按下会让 pill 停在按下的样子（不对，但绝不会消失），直到 `PRESS_TIMEOUT`（4s）把亮光收回。这就是这个控件上的任何东西都必须过的关（哪些做法没过关，见"历史"一节）。

点击是把手唯一自己负责的事，也是唯一一件丢了也无害的事（菜单不打开，下一次点击照常）。它不能是 click 处理函数（在 `Drawer.Content` 之上没有 click），也不能是 `armPointer`（它的长按会在拖动途中触发，而那时没有 move 事件来取消它）。一次按下，加上一个落在 `TAP_SLOP`（6px）范围内的 `pointerup`，就是一次点击。把手在捕获阶段监听 document，抢在 Base UI 之前，并在松开*之后*用 `setTimeout` 打开菜单：在 sheet 自己的手势记账进行到一半时刷入一个嵌套 drawer，会让 sheet 以为自己仍被按住。

Base UI 从不从 `button, a, input, select, textarea, label, [role="button"]` 上开始滑动，所以 pill 是一个 `<div>`（`aria-hidden`），它的圆点不可交互（在这里是指示器，不是三个目标），而可访问的控件是旁边一个视觉上隐藏的 `<button aria-haspopup="menu">`。

手机上的 pill 唯一没有照搬的是它的点击区域。`[data-window-grip]::before`（`app/globals.css`）把点击区域从 48×28.5 的 pill 扩大到 72×44.5，因为这个 pill 同时也是把手。点击区域和外观是有意分开的：一个 pill 哪天换了外观，不能把点击区域也一起带小。

### 桌面上的 chrome

这是*窗口化*窗口的 chrome（`window-chrome.tsx`）；手机上的窗口戴的是把手。内容**铺满到边缘**；控件是经典的红/黄/绿圆点，摆放得在各个平台上都像原生的：

- **指针** → 一簇放在**左上**（macOS）。圆点始终是完整尺寸，但静止时是**没有底板的 pill 上的暗灰色圆点**；鼠标移上去时 pill 填上玻璃，圆点显出颜色（只在聚焦的窗口上；后台窗口的仍是灰色），×/−/+ 符号和 App **标题** 淡入。两种状态之间没有东西移动，所以按钮是稳定的目标。
- **`sm` 及以上的触摸**（平板）→ 一个小的、**居中**的、始终灰色的 pill。圆点在触摸下不可交互（是指示器，不是三个小目标）；点一下以操作表（action sheet）的形式打开菜单。

菜单（App 头部、尺寸预设、Reload、Web App 才有的 Open in browser、Minimize、Close）通过**右键**、在 pill 上除了可用圆点以外的任何地方**点一下**、或**长按**（450ms）打开。`armPointer`（`lib/pointer.ts`）区分*点击 → 菜单*、*按住 → 菜单*和*移动超过 `TAP_SLOP` → 拖动*，所以点击永远不会让窗口抖一下，拖动也永远不会弹出菜单。没有下拉箭头。绿色圆点用于缩放；双击顶部条带也一样。

菜单提供什么是一份列表（`window-menu.tsx` 里的 `WindowMenuBody`）；在哪里提供则有三种容器，这样几种形态就不会各自走样：

- **指针**（`hasFineHoverPointer`）→ pill 下方的一个 **popover**：portal 到 `<body>`，带一层覆盖整个视口、位于 `z-[55]` 的遮罩（这样点击任何地方都能关闭它，即使是在 iframe 上方，而 iframe 的指针事件不会冒泡），在 pill 下方左对齐，并限制在视口内。
- **触摸，窗口化** → `WindowMenuSheet`，一个从底边升起的 `SurfaceSheet`（[Surface System](./system-surface.md)），`fitContent`、`modal`，顶部是 App 头部，操作是按同样顺序排列、拇指大小的行，Close 单独成组，红色。sheet 自带遮罩（在窗口层及其 iframe 之上）、Escape、拖动关闭和共享的堆叠。
- **触摸，在手机上** → 同一个 sheet，`nestedIn` 窗口自己的 sheet，去掉尺寸预设。

sheet 里的一行**先关闭 sheet，再执行操作**（在 `SURFACE_TRANSITION_MS` 之后）：`close` 会卸载窗口，连带着卸载一个原本会在动画中途消失的 sheet。iOS 也是这样做的。

桌面窗口上的手势（`window.tsx` 里的 `DesktopWindow`）：

- **拖动**（pill，或者沿顶边一条 16px 的带子作为抓取容差）和**调整大小**（6px 的边，14px 的角；没有顶边的调整手柄，因为顶部是拖动带，所以调整顶部高度靠两个上角）在手势进行期间把几何属性**直接写到 DOM 节点上**，在 pointer-up 时提交一次（`setRect`）。这样避免了每帧的 React 重渲染，iframe 和 Web Worker 在那种情况下重绘得很糟。
- 拖动是**自由的**：你可以把窗口大部分塞到屏幕外。松开时 `clampDrag` 把它拉回来，刚好让 chrome 还能抓到，用一个带一点过冲的弹簧，作为**边缘回弹**。
- 拖动或调整大小时，一层透明的**手势遮罩**盖住内容区，这样 iframe 就吞不掉 `pointermove` 事件流，拖动也不会卡住。
- 最大化的窗口既不能拖动也不能调整大小。

`WindowLayer` 是单独一个 `position: fixed; inset: 0` 的层，位于 `z-40`，`pointer-events: none`，所以它永远不会抢走页面的点击（每个窗口为自己重新打开指针事件）。它在 Dock（`z-50`）、sheet（`z-60` 及以上）和 ⌘K popover（`z-[10050]`）之下，所以 ⌘K 总是在最上面。

### 运行时

**WebFrame。** 一个 `<iframe>`（出于防御加了 sandbox），带一个体面的兜底：很多网站通过 `X-Frame-Options` / CSP `frame-ancestors` 拒绝被嵌入，而浏览器是在 JS 跨域读不到的那一层拦下的。所以它不去假装检测，而是等 frame 的 `load`；如果 4s 之后还没触发，就出现一条不挡操作的横幅（"This site may block embedding."），提供在新标签页里打开这个 App 的选项。在那之前，站点的光晕沿着顶部跑，充当加载进度条。

**LynxFrame → LynxPlayer。** `<lynx-view>` 和它的运行时在模块被 import 的那一刻就会创建 Web Worker，所以 player **完全不能碰服务端**。`lynx-frame.tsx` 通过 `next/dynamic` 以 `ssr: false` 加载它，这样下面两个带副作用的 import 完全不会进入服务端：

```ts
import "@lynx-js/web-elements/index.css"; // element styles
import "@lynx-js/web-core/client";         // registers <lynx-view> + runtime
```

`@lynx-js/web-core` 还需要安装 `@lynx-js/lynx-core`（它的后台线程会 import `@lynx-js/lynx-core/web`）。不需要 COOP/COEP 头。bundle 的请求发生在 web-core 的后台线程里：**内置**（`/…`）的 bundle 从 `public/` 同源提供，**在线**（`http(s)://…`）的 bundle 跨域获取，所以远端主机必须发送宽松的 CORS。BusyWeek 的源站在提供它的 `.web.bundle` 时带着 `Access-Control-Allow-Origin: *`。

三处保真细节让*任意的* Lynx 卡片（而不只是用内联样式写的 demo）都能正确渲染：

- **每个实例一个 `lynx-group-id`**，这样同时打开的窗口永远不会共用一个后台 Worker；
- **容器查询单位**（`container-type: size`、`--rpx-unit: calc(100cqw / 750)`、`--vh-unit` / `--vw-unit`、`transform-vh` / `transform-vw`），这样 Lynx 的 `rpx` / `vh` / `vw` 相对于*窗口*而不是视口来解析，一张真实的卡片会按它所在的窗口缩放；
- **来自窗口的 `SystemInfo`。** web-core 默认把 `pixelWidth` / `pixelHeight` 设为 `window.screen`，所以一张按"屏幕"坐标定位自己的卡片（逗猫棒的光球）在竖向窗口里会落到画布外面。player 先测量自己的容器，在 bundle 加载之前传入 `browser-config`。只有第一次测得的尺寸算数：`SystemInfo` 在 bundle 求值时就被快照下来了。

#### Shadow root 的布局 CSS

`web-core` 给每个 `<lynx-view>` 的 shadow root 加样式的方式，是以 Vite 的风格 import 它的布局 CSS（`import … from '…/in_shadow.css?inline'`，在锁定的 0.22.2 里仍是如此），再把这个字符串做成 Blob 放进一个 `<link>`。在 **Turbopack**（以及 Webpack）下，`?inline` *拿不到* CSS 字符串：模块的默认导出是 `undefined`，于是 Blob 变成字面上的文本 `"undefined"`，shadow root **没有**任何 web-elements 布局 CSS。flex 的默认值悄无声息地坏掉：一个 `<view>` 渲染成 `flex-direction: row`，而不是 Lynx 的 `column`。`in_shadow.css` 开头还有一句 `@import url("@lynx-js/web-elements/index.css")`，这种裸模块说明符在 Blob URL 样式表里本来就不可能解析。

这个仓库用 **Turbopack** 构建，所以 Webpack 惯用的修法（`NormalModuleReplacementPlugin` + `asset/source`）用不上。改为：

1. `pnpm lynx:shadow-css`（`scripts/lynx-shadow-css-bundle.mjs`）把 `in_shadow.css` 以及每一个 `@import`（裸的*和*相对的）递归展平成一个自包含的字符串，输出为 `systems/windows/lib/lynx-shadow-css.ts`（提交进仓库）。`predev` / `prebuild` 会重新生成它。
2. `lynx-player.tsx` 自己把这个字符串作为 `<style data-lynx-shadow>` 注入到每个 shadow root 里（作为第一个子元素，这样卡片自己的样式仍然优先）。这与打包工具无关，完全绕开了 web-core 的 `?inline` 路径。

为写这一页又核对了一次：打开 Cat Wand 时，注入的样式表有 244 条规则，shadow root 里一个新建的 `x-view` 计算出来是 `flex-direction: column`。

### App

App 写在 `content/apps.json` 里，也就是**内置注册表**。驱动窗口系统的字段（见 `lib/app-icon-core.ts` 里的 `AppLink`）：

- `runtime`：`"web"`（默认，一个 iframe）或 `"lynx"`（Lynx Player）。
- `flavor`：Lynx App 用，`"react"` 或 `"vue"`。只是外观上的：它给角标着色。
- `bundleUrl`：Lynx 的 `.web.bundle`，没有时退回 `url`。两种来源，一个字段：
  - `http(s)://…` 网址 → **在线**，打开时获取；
  - 本地 `/…` 路径 → **内置**（离线），从 `public/` 提供。
  player 对远端网址原样透传，对本地路径按源站解析。
- `size`：偏好的预设；Lynx 默认 `portrait`，Web 默认 `landscape`。
- `url`：Web App 窗口里嵌入的页面，也是每个 App"在外部打开"的目标（文件夹图标真正的 `href`；Web App 菜单里的 "Open in browser"）。
- `featured: false` 让 App 不出现在主屏文件夹里，但仍在 ⌘K 栏里。

```json
{
  "id": "busy-week",
  "title": "BusyWeek",
  "runtime": "lynx",
  "flavor": "vue",
  "bundleUrl": "https://huxpro.github.io/BusyWeek/main.web.bundle",
  "url": "https://huxpro.github.io/BusyWeek/",
  "size": "portrait",
  "featured": false
}
```

现在的两个 Lynx App 正好展示了两种来源：BusyWeek，一个 Vue Lynx 的待办 App，从它的 GitHub Pages 源站获取 bundle；Cat Wand（逗猫棒）把 `public/bundles/cat-toy.web.bundle`（Vue Lynx 的 `examples/touch-fx` playground）放在仓库里，所以它可以从本站离线运行。两者都是 `featured: false`，所以从 ⌘K 打开。其他任何 bundle 都可以按网址以**空中下发**（over-the-air）的方式打开（`openBundleUrl`；见"启动"）。

#### 运行时角标

每个图标都在角上戴着一个**角标**（`app-badge.tsx`），说明它怎么运行，就像 iOS 在轻 App / AR / 网页快捷方式图标上叠一个符号：

- **web** → 一个地球。
- **Lynx · React** → Lynx 的头像，染成 React 蓝（`#149eca`）。
- **Lynx · Vue** → Lynx 的头像，染成 Vue 绿（`#42b883`）。

flavour 只体现在颜色上，所以 React-Lynx 和 Vue-Lynx 不用第二个符号也能分得开。为了让静止的主屏保持干净，主屏文件夹**不会**一直盖着它：它在 hover / 键盘聚焦时淡入，文件夹处于抖动编辑模式时也会出现（触摸下通过长按进入）。⌘K 栏总是显示它（`revealBadge`）。运行时也写在窗口菜单的头部，并随着最小化后的 Dock 胶囊一起显示，所以藏起角标永远不会藏起运行时。

#### 启动

所有入口都经过 `useWindows()`：

- **文件夹。** `components/apps/app-folder.tsx` 里的图标仍然是指向各 App `url` 的真实链接，所以 ⌘/ctrl/shift/中键点击仍然会在新标签页里打开那个网站。普通的左键点击被拦截（`openApp`），改为打开窗口：这是渐进增强，与文件夹的拖动排序和分页溢出可以共存。
- **命令面板。** ⌘K 里的 Apps 栏（`CommandAppsStrip`，`systems/command/apps-launcher.tsx`）：一行没有标题的横向图标，浏览和搜索时都一样，没有匹配时隐藏。它的最后一格 **Load…** 会把面板变形成一个网址表单（`load-bundle-panel.tsx`；在手机上是一个叠放的 `command-bundle` sheet），调用 `openBundleUrl`。
- **空中下发。** `openBundleUrl(url)` 为任意 `.web.bundle` 网址打开一个临时的 Lynx 窗口（`ota:<url>`，除非另行指定，flavour 为 `react`）。Load… 是它唯一的调用方。
- **App 内浏览器。** `openUrl(url, { title })` 在一个窗口里打开任意网页，窗口的框架、pill 和菜单与 App 的一样，以网址为 key，所以同一个页面会聚焦已有的窗口，而不是再开一个。一次提交附带的链接卡片就是在这里打开的（[Attachments System](./system-attachments.md)）：在桌面上是一个窗口，在手机上则是叠在 `Visit` 所在附件 sheet 之上的窗口 sheet，就像手机 App 在自己的浏览器里打开链接，收起时回到下面那一屏。响应头拒绝被嵌入的页面永远到不了这里；它们去新标签页。菜单里的 "Open in browser" 是出口。

## 规则

下面每一条被打破，都会有看得见的问题。

| 规则 | 原因 | 打破之后 |
|---|---|---|
| 最小化永远不卸载。桌面：`WindowLayer` 继续渲染它；手机：sheet 上的 `keepMounted` | App 是跨域 iframe 或 Lynx 运行时；卸载就等于重新加载 | 每次收起 App 它都重新启动 |
| 手机 sheet 的关闭是 `minimize`，永远不是 `close`；Close 只是菜单里的破坏性操作（在桌面上还有红色圆点 / Esc） | 向下拖太容易误触 | 一次甩动就丢掉 App 的状态 |
| 手机窗口的内容区保留 `data-base-ui-swipe-ignore` | Lynx view 和加载转圈都在这个文档里；它们的触摸会变成滑动 | 跟着手指走的游戏把窗口拖走 |
| 把手只持有卡住也无害的状态（亮起，或静止），不持有任何需要靠手势结束来清除的东西 | 按下一旦变成滑动，Base UI 就捕获了指针，松开可能哪儿也到不了 | 控件消失，或者一个卡住的状态被 `keepMounted` 带进下一次打开 |
| 把手在松开之后（`setTimeout`）打开菜单，而不是在松开的处理过程中 | 在手势中途刷入的嵌套 drawer 会搞乱 sheet 的记账 | sheet 以为自己仍被按住 |
| 把手是一个带不可交互圆点的 `<div>`；按钮在它旁边，视觉上隐藏 | Base UI 从不从 `button` 或 `[role="button"]` 上开始滑动 | 把手拖不动 |
| sheet 菜单的行先关闭，在 `SURFACE_TRANSITION_MS` 之后再执行 | `close` 会卸载窗口，连同菜单 sheet 一起 | 菜单在动画中途消失 |
| 桌面手势写 DOM 节点、只提交一次；手势遮罩盖住内容区 | 每帧渲染会拖慢 iframe 和 Worker；iframe 会吃掉 `pointermove` | 拖动卡顿；拖到 App 上方时拖动冻住 |
| `isMobile` 保持由 `SURFACE_BREAKPOINTS.sm` 定义 | `soloOnPhone` 必须恰好在窗口是 sheet 时生效 | 两个 sheet 互相埋住，或者平板上的窗口被强制一次只开一个 |
| `lynx-player.tsx` 继续注入 `LYNX_SHADOW_CSS`；永远不要手改 `lynx-shadow-css.ts` | web-core 自己的 `?inline` 路径在 Turbopack 下得到 `undefined` | Lynx 布局塌成横排 |
| 每个 player 一个 `lynx-group-id`；`SystemInfo` 从容器读取 | 共用 Worker 会冲突；`window.screen` 不是窗口 | Lynx 窗口之间串扰；卡片落到画布外 |

## 可以自由选择的

- 预设尺寸、错开的步长、边距和 `DOCK_BAND`，只要窗口仍然避开 Dock。
- 手机 detent 的具体数值（最低和最高值有意取自 `SHEET_DETENTS`，这样叠在窗口上的 sheet 能停在同一高度）。
- 菜单提供哪些项，只要它仍是 `WindowMenuBody` 里的一份列表。
- pill 的外观，只要静止和亮起时都显示圆点，并且把手的点击区域与外观保持分离。
- 打开、关闭和最小化的动效曲线。
- 哪些 App 放在文件夹里，哪些只在 ⌘K 里。

## 做法

**添加一个 App。** 在 `content/apps.json` 里加一条（`id`、`title`、`url`，Lynx 的话还有 `runtime`、`flavor`、`bundleUrl`；默认尺寸不对就加 `size`），然后刷新图标快照（见 content-snapshots skill）。内置的 Lynx bundle 放进 `public/bundles/`；在线的需要它的主机提供 CORS。

**在新代码里用窗口打开一个页面。**
`useOptionalWindows()?.openUrl(url, { title })`，没有 provider 时用一个普通链接兜底。不要把窗口包进 `AdaptiveSurface`，也不要把它的 id 加进 devtool 的可拖动列表。

**修改把手或手机 sheet。** 先读 `window-grip.tsx` 的开头和 base-ui-drawer skill。然后在触摸设备上：点一下（菜单打开，pill 亮起，下一次点击照常），在三个 detent 之间拖动，向下拖进 Dock 再恢复（同一个 detent，同样的 App 状态），打开菜单选 Close。再用鼠标在手机宽度下：按住并拖动把手，在窗口外松开，确认 pill 在 4s 内回到静止状态。

**修改桌面 chrome。** 检查 pill 上的点击、长按、右键和拖动；从每条边和每个角调整大小；把窗口拖出每一条边，看它弹回来；最大化再缩放回来；最小化再恢复。

## 参考：DevTool 检查器

DevTool 面板（`systems/devtool/panel.tsx`，`WindowsModule`）有一个 **Windows** 区块：列出打开的窗口，最前面的在前，每个都带着聚焦 / 最小化状态和元数据（运行时和 flavour、来源、尺寸预设、重新加载次数、矩形，以及 bundle 或页面网址）。它只做检查；启动 App 和按网址加载 bundle 是命令面板的事（⌘K → Apps → Load…）。

## 历史：那个曾经变形的把手

留着它，是因为它是上面那些把手规则的由来，也是重新设计时第一个会想要找回来的东西。

圆点过去在 sheet 被拖动时会变成站内那根 36×4 的拖动条，前后用过三种驱动方式。第一种，按实时的拖动距离插值，而一个有 detent 的 sheet 每次落到 detent 上都会把它归零，所以会闪。第二种，把手里的一个阶段状态机，它必须知道手势何时结束，而它没法知道：除了触摸，Base UI 会为所有输入捕获指针，然后松开事件什么都到不了（`pointerup`、`pointercancel`、`lostpointercapture` 都没有，在 window、document、popup 上都没有），于是阶段卡住，`keepMounted` 又把它带进下一次打开 App。第三种，用 sheet 自己的手势状态：好一些，但离被卡住仍然只差一次嵌套 drawer 的刷入。

每个版本都是同一个形状：总得有什么东西去*清除*那个有意思的状态，而负责清除的东西可能被错过，被它清除的又恰恰是控件本身。把手从变形中得到的任何好处，都抵不过一个控件时有时无的窗口。所以没有东西会变形。如果变形回来，它必须是不可能残留的东西：一段总是在起点结束的动画，而不是一个需要有人去清除的状态。surface 系统对每个 sheet 都带着同样的教训：它不发布任何供把手跟随的手势状态。
