---
origin: "AI-translated from the original"
---

# 动效

站点的动效语言：三条曲线、几档时长、什么会移动而什么只淡入淡出，以及减弱动态效果时各自变成什么。具体机制（sheet、Dock 面板、页面转场、命令面板）各有自己的文档，文末的表格逐一指向它们。这一页讲的是它们共有的部分，也是新动画应当对齐的标准。

动效是功能性的，不是表现性的：它说明一样东西从哪里来、到哪里去，或者某个状态变了。如果一段动效什么都没解释，就删掉它。

## 做好了是什么样

- sheet 以高速离开、长长地落定，没有回弹。在前五分之一的时间里走完三分之二的路程，看起来是在回应点按，而不是在表演。
- 新 sheet 出现时，退到后面的那个 sheet 起步很轻，所以在新 sheet 到达之前它不会先抖一下。
- 在一个不动的容器里变化的内容（primer 的步骤、命令面板的模式、浮动按钮的文字）交叉淡变，同时盒子缓动到新的尺寸。没有硬切，也没有东西凭空滑进来。
- 换页时整页交叉淡变；只有 `λhux` 和 Ask 球会位移，因为它们在两个页面上是同一个东西。
- 悬停和按下是颜色变化，而且很短。按下在手指触到的那一帧生效，松开时缓出。
- 在减弱动态效果下，每个状态依然会变，只是立即完成。

## 曲线

![三条曲线的路程随时间变化图。Travel（蓝色）起步很陡，在五分之一时间处已到 66%；Fade（绿色）在 50%；Standard（橙色）起步平缓，在 13%。下方图例列出每条曲线的取值、承载它的常量或 class，以及用途。](/img/docs/motion/curves.svg)

虚线是一个 500ms sheet 的前 100ms。到那时 Travel 已经走完三分之二的距离，所以用它的 surface 感觉很即时；Standard 才刚起步，这正是后退用它的原因：后退比到达的 sheet 晚一帧，而在 Standard 上这一帧看不出来。

- **Travel**，`cubic-bezier(0.32, 0.72, 0, 1)`：iOS 式的快起步、长落定，用于去往某处或改变尺寸的东西。sheet 的到达、离开和切换 detent；Dock 面板和它的 pill；浮动按钮的形变；`SurfaceMorph` 的高度；窗口最小化；`/works` 上签名的裁剪；hash 落点滚动；Vitre 的 chrome 形变。写法：`SURFACE_EASING`（`systems/surface/stack.ts`，从 `@/systems/surface` 导出），surface popup 上的 `--surface-easing`，class 里的 `ease-[cubic-bezier(0.32,0.72,0,1)]`，Motion 里的 `ease: [0.32, 0.72, 0, 1]`。
- **Standard**，`cubic-bezier(0.4, 0, 0.2, 1)`：用于回应指针（颜色、透明度、按下后的回弹），以及位于另一样东西后面的运动（sheet 的后退，`site-identifier` 和 `ask-ball` 这两个 view-transition group）。写法是 `SURFACE_RECEDE_EASING` / `--surface-recede-easing`；它也是 Tailwind 中没有 `ease-*` class 的 `transition-*` 的默认曲线，以及它的 `ease-in-out`，所以 `transition-colors duration-200` 本来就在这条曲线上。
- **Fade**，`ease-out`：只用于透明度（页面交叉淡变、签名的各行）。Tailwind 的 `ease-out` 是 `cubic-bezier(0, 0, 0.2, 1)`；CSS 关键字则是 `cubic-bezier(0, 0, 0.58, 1)`。命令面板的 popover 也在这条曲线上切换模式，尺寸变化也包括在内（`duration-300 ease-out`）。
- **Spring**：桌面窗口的到达（`systems/surface/window.tsx` 里的 `WINDOW_SPRING`：stiffness 520、damping 34、mass 0.7），以及任何被手松开后在视口内落定的东西（`useDraggable`，500 / 30）。

在 surface 之外，travel 曲线没有统一的 CSS token：每处都完整写出（`--sig-ease`，`systems/dock/components/dock.tsx` 里的 `MOVE`，`systems/dock/components/use-band-occupant.ts` 里的 class 字符串）。要一字不差地写；差一点就是第二条曲线。在 TypeScript 里，凡是字符串能用的地方就导入 `SURFACE_EASING`。

还有少数几条局部曲线，各只服务于一个手势（`globals.css` 里的长按放大和 widget 抬起、窗口的吸附、tilt primer）。它们属于各自的机制，不是一套可以随便挑的调色板。

## 时长

越远越长，访客要等的东西都不超过 500ms。

| 时长 | 用于 | 站内实例 |
|----------|-----|-------------|
| 100–150ms | 在指针处出现的小东西 | 菜单、tooltip、hover card、select（`components/ui`，`duration-100`）；拖动 Ask 时的放置目标（`duration-150`）；窗口关闭（0.15s） |
| 200ms，`duration-200` | 回应指针的颜色、透明度、小幅变换 | 行和 chrome 上的 `transition-colors duration-200`；页面交叉淡变；命令面板卡片的 `zoom-in-95` 出现 |
| 300ms，`duration-300` | 原地的布局变化：宽、高、grid 行、内边距 | 命令面板 popover 的模式切换；band 占位者的宽度；`PinnedSlot`；`λhux` 和 Ask 球的位移；Dock 面板的弹出（`--dock-pop-duration`）和它的 pill（`MOVE`，0.32s） |
| 400–500ms | 跨越屏幕的位移 | `SURFACE_TRANSITION_MS`（500）：每个 sheet 的到达、离开、detent 切换和后退；浮动按钮的形变（0.4s）；`SurfaceMorph` 的高度（420ms）；窗口最小化（0.42s） |
| 500–700ms | 没人在等的环境变化 | 壁纸和主题的淡变（`duration-500`、`duration-700`） |

`SURFACE_TRANSITION_MS` 同时也是一个时钟：需要等 sheet 结束的代码（`window-menu.tsx` 在 sheet 关闭后执行操作，`window-sheet.tsx` 卸载，`stack.ts` 重新读取 band）都等这么久。在 `stack.ts` 和 surface 的 CSS（通过 `--surface-duration`）里改它，这些等待会跟着变，只有一处副本例外：页面为侧边的 Ask 让出空间（`#vitre-scroll`，`globals.css` 里写死的 `500ms`）。Dock 面板的弹出刻意更短，有自己的 `--dock-pop-duration`。

## 什么移动，什么淡变

- **移动**（沿路径的变换）：当它有来处和去处时。sheet 从它的边缘进来，`λhux` 和 Ask 球在页面之间移动，Dock 的 pill 重新排布，窗口从它在 shelf 上的图标出来。
- **淡变**：当盒子不动、里面的东西变了时。页面主体、命令面板的模式、`SurfaceMorph` 的步骤、浮动按钮的文字。离开比到达快，新内容在旧内容消失后隔一拍再进来（`SurfaceMorph`：淡出 180ms，延迟 90ms 后淡入 280ms）。
- **缩放**：当没有可以出发的地方时。Dock 面板从 0.94 弹出，因为它的 pill 就在正上方；菜单和命令面板卡片用 `zoom-in-95`。后退的 sheet 每被一个 sheet 盖住，就上移 8px、缩小 5%。
- **高度到 `auto`**：要么在 `0fr` 和 `1fr` 之间切换 `grid-template-rows`（命令面板 popover），要么测量高度后用 travel 曲线缓动（`SurfaceMorph`）。两者都不在合成器上运行：内容要保持轻量。
- **手指优先于曲线。** sheet、Dock 面板或窗口被拖动时，它跟着指针走，不带缓动（drawer 上用 `transition-duration: 0ms`，绝不用 `transition: none`；原因见 base-ui-drawer skill）；松手后曲线恢复，甩得越用力离开得越快（`--drawer-swipe-strength`）。
- **不在模糊上做。** 在 `backdrop-filter` surface 上做变换，会让合成器每一帧重新模糊，所以首页搜索栏按下时用颜色蒙层而不缩放（`systems/command/fab.tsx`）。不是玻璃的 chrome 按钮按下时用 `active:scale-95`；媒体封面则变暗（`COVER_WASH`，[Design System](./design-system.md#touch)）。
- **不在小号等宽字上做。** 被变换的图层会重新栅格化 12px 的等宽字，于是它会闪烁、晚一个像素才落定。`/works` 上的签名用 `clip-path` 逐行显现，从不用变换。

## 减弱动态效果

每段动效都把它的减弱路径写在旁边；在 `prefers-reduced-motion: reduce` 下状态依然变化，只是去掉了位移。站内没有任何地方全局处理这件事：

- **CSS**：紧跟在规则后面写一个 `@media (prefers-reduced-motion: reduce)` 块，里面是 `transition: none` 或 `animation: none`（`globals.css` 里 surface、Dock 和 view-transition 的块是范例）。
- **Tailwind**：在 class 上加 `motion-reduce:`（`systems/surface/morph.tsx` 里的 `motion-reduce:!transition-none` 和 `motion-reduce:animate-none`，按下缩放用 `motion-reduce:active:scale-100`）。`tw-animate-css` 的 `animate-in` 自己不检查这个设置。
- **Motion**（`motion/react`）：`useReducedMotion()`，然后用零时长或不做动画（`lib/use-hash-landing.ts`、`components/ui/use-notice-yield.ts`）。根部没有 `MotionConfig`，所以除非组件自己询问，`motion.*` 元素照样会动。

把它变成什么：

- **立即完成**，默认如此。
- **用 `0.01ms`，不用 `none`**，当有东西在等这段动画时：标题和 commit 的高亮（`[data-hash-target]`、`[data-commit-target]`）在 `animationend` 时移除，而 `animation: none` 永远不会触发它。
- **静态提示**，当动效本身承载了含义时：Ask 的交接脉冲变成一圈固定的 `--ring` 描边。
- **暂停**，用于循环演示（tilt 和 sky primer）：第一帧依然能说明问题。

## 添加动效

1. 说清它解释了什么。如果什么都没有，就别加。
2. 按移动的是什么来选曲线（travel、standard、fade），按距离远近来选时长，参照上面几节。
3. 一字不差地写出曲线，能用 `SURFACE_EASING` 就用它。
4. 在同一处写好减弱路径，并决定它属于四种中的哪一种。
5. 如果手指能拖动它，拖动期间关掉过渡。
6. 不在玻璃上、不在小号等宽字上做变换。
7. 如果它是 sheet、Dock 面板或页面转场，那已经写好了：去它自己的块里改（见下文），不要在旁边另写。

## 各机制所在

| 机制 | 文档 | 代码 |
|-----------|-----|------|
| 页面转场：`root` 交叉淡变、`site-identifier`、`ask-ball`，以及它们的减弱动态效果 | [Navigation](./navigation.md#page-transitions) | `app/globals.css`，"View Transition API Styles" |
| Sheet：到达、离开、detent、拖动、栈的后退、`SurfaceMorph` | [Surface System](./system-surface.md)；skill `.claude/skills/base-ui-drawer` | `app/globals.css`，"Secondary surface motion"；`systems/surface/sheet.tsx`、`stack.ts`、`morph.tsx` |
| Dock 面板的弹出和 pill | [Dock System](./system-dock.md) | `app/globals.css`，"Dock panel motion"；`systems/dock/components/live-activity.tsx`、`dock.tsx` |
| 命令面板的模式和浮动按钮的形变 | [Command System](./system-command.md) | `systems/command/popover.tsx`、`fab.tsx` |
| 桌面窗口 | [Window System](./system-windows.md) | `systems/windows/components/window.tsx`、`systems/surface/window.tsx` |
| 按下、封面蒙层、长按 | [Design System](./design-system.md#touch) | `.pressable`、`.press-hold`、`COVER_WASH` |
| iOS 的 chrome 形变和状态栏点按 | skill `.claude/skills/vitre` | `packages/vitre/src/chrome.ts`、`status-tap.ts` |
