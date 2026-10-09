---
origin: "AI-translated from the original"
---

# Surface 系统

一种次级界面，四种形态。站内浮在页面之上的东西越来越多（音乐播放列表、壁纸选择器，以及之后的种种），每一个在不同尺寸下都想要不同的形态。过去它们各自重新决定这件事：各自的 `matchMedia` 监听、各自的 drawer 接线、各自的玻璃外壳、各自的标题栏，同一个判断被复制成好几份，可以各自走样。这个判断属于**视口**，而不属于功能，所以它只在这里写一次。

```
systems/surface/
├── presentation.ts       # SurfaceMode, the maps, useSurfaceMode()
├── adaptive-surface.tsx  # <AdaptiveSurface> (the policy), <SurfacePanel>
├── sheet.tsx             # <SurfaceSheet>, SHEET_DETENTS, detentHeight()
├── window.tsx            # <SurfaceWindow>: floating, draggable
├── chrome.tsx            # <SurfaceBody>: title bar, scroll area, footer
├── morph.tsx             # <SurfaceMorph>: a short sheet changing step
├── stack.ts              # which sheets are open, and which covers which
├── axis-lock.ts          # useSheetAxisLock: sideways scroller in a sheet
└── index.ts
```

## 做好了是什么样

壁纸选择器（`systems/ambient/components/wallpaper-sheet.tsx`）只声明了 `presentation={ADAPTIVE_PRESENTATION}`，关于形态别的什么都没写：

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-surface/picker-sheet.png" style={{ width: "calc(41% - 0.5rem)", margin: 0 }} alt="手机上的壁纸选择器：停在 0.7 detent 的底部 sheet，一行两张图，命令面板退到它身后。" />
  <img src="/img/docs/system-surface/picker-panel.png" style={{ width: "calc(59% - 0.5rem)", margin: 0 }} alt="同一个选择器在 820px 宽时：贴着尾侧边缘的全高 panel，旁边的页面照常可用。" />
</div>

640px 以下它是 sheet（393pt，从命令面板打开，面板退后一步，在 0.7 处与它齐平）；从 640px 起是贴在尾侧边缘的 panel（820px）。同样的玻璃、同样的标题栏、同样的两列网格。

![同一个选择器在 1280px 时：一个浮在顶部居中附近的窗口，一行三张图，四周的主屏照常可用。](/img/docs/system-surface/picker-window.png)

从 1024px 起它是 window（1280px）。网格变成三列，是因为内容读的是 `useSurfaceContext().isWindow`，而不是视口。

- 一个组件，三种形态，功能代码里没有按视口分支。
- 三种形态下，背后的页面都保持可用：没有遮罩，点外面也不会关闭。
- 手机上的 sheet 与每条边都隔着一段间距浮起，并从顶部长高。
- 在一个 sheet 上再打开一个 sheet，前一个会退后一步，变暗且不可交互。

## 原理

### 两层

形态通常由视口决定，`<AdaptiveSurface>` 就是这条规则。但它是规则，不是铁律：devtool 的形态是开发者把 sheet 从底边拉下来时自己选的。所以几种外壳放在它下面一层，可以单独使用：

```
primitives   <SurfaceSheet>   docked to the bottom edge, detents, stacking
             <SurfacePanel>   docked to the trailing edge
             <SurfaceWindow>  floating, draggable, morphs in
             <SurfaceBody>    the chrome all of them hold
policy       <AdaptiveSurface>  = viewport → primitive
             DevtoolFAB         = gesture  → primitive
```

有三个功能直接组合这些 primitive：命令面板，它的头部是一个搜索框而不是标题栏；Ask，它自带一套界面；还有 devtool，它的形态由手势决定（见 [Devtool System](./system-devtool.md)）。它们依然拿到同样的外壳、间距、detent 和堆叠。

### 四种形态

| Mode | 位置 | 理由 |
|------|-------|-----|
| `sheet` | 底边，下拉关闭，有拖动条 | 手机。拇指够得着。 |
| `panel` | 尾侧边缘，全高 | 平板。内容挨着内容。 |
| `window` | 浮动，可拖动，变形进入 | 桌面。可以挪开。 |
| `popover` | 挂在打开它的按钮上 | 比手机宽的任何屏幕，用于属于某一个控件的界面。 |

`window` 不是 drawer。它弹入时用的曲线和 `systems/windows` 从 shelf 上的图标打开 app 时的一样（`WINDOW_SPRING`），并通过共享的 `useDraggable` hook 用标题栏拖动，所以它和站内所有可拖动的东西一样，继承 devtool 里按实例设置的拖动选项。除非 `placement` 另有指定，它停在顶部居中附近；devtool 要的是 `top-right`，那是它一直在的位置，也不挡住它要观察的页面。

`popover` 也不是 drawer。它是一个 [Base UI Popover](https://base-ui.com/react/components/popover)，定位在 `anchor`（指向拥有它的元素的 ref）旁边，会翻转和平移以留在屏幕内。它穿着和其他形态一样的玻璃外壳、一样的标题栏，只是圆角更小，所以手机上的 sheet 和桌面上的卡片一眼就能认出是同一个东西。关闭时焦点回到 anchor，因为没有 Base UI 的 trigger，就没有别的地方可以把焦点交还。

前三种形态不会把页面拿走。没有遮罩，页面保持可交互，碰到页面也不会关闭界面；关闭靠的是关闭按钮、Escape 和拖动。这三种都是为背后的页面服务的，一个碰一下活页面就关掉的界面根本没法用。

（这就是 `modal={false}` 对 Base UI 的含义，而且是字面意义上的：它既不碰 `<body>` 的 pointer events，也不碰它的 position。非 modal 的界面还会传 `disablePointerDismissal`，因为在活页面上的按压属于页面。）

popover 是例外，理由相同：它是一个按钮的延伸，而不是为页面服务，而每个平台上的每个菜单都是按一下别处就收起。唯一不算数的是按在它的 anchor 上。Base UI 把这一下当作外部按压，所以这个形态会取消它，把手势留给按钮本身，否则按钮会在一次点击里先关闭再打开。

Base UI 自己也能做到这一点，用 `Popover.createHandle()` 加一个分离的 `Popover.Trigger`。这里没用，是因为四种形态里有三种根本没有 trigger 可当：手机上 `Popover.Root` 从不挂载，所以调用方的按钮无论如何都需要自己的 open 状态，而在 popover 模式下它又会和 Base UI 的状态赛跑。这个取消，是给一个接收 anchor 而不是 trigger 的系统做的适配，它属于这里，而不是功能代码。等需要锚定的界面多起来，该抽出来的是调用方这一侧，而不是 Base UI 的 trigger：一个 `useSurfaceTrigger()`，返回 `{ ref, onClick, "aria-expanded" }`，展开到任意按钮上。

另一个例外是启动器。命令面板的 sheet 是 modal 的：它打开时页面不再响应，按一下页面就会关闭它，这正是它桌面版 popover 的点外关闭。见下文 **Sheet primitive**。

### 声明 presentation

功能用一张断点映射表表达意图，然后就不用再管：

```tsx
<AdaptiveSurface
  id="surface-playlist"
  open={isOpen}
  onOpenChange={setOpen}
  presentation={ADAPTIVE_PRESENTATION}   // sheet → panel → window
  title="playlist"
  closeLabel={t(locale, "musicClosePlaylist")}
  windowWidth="min(94vw, 980px)"
>
  {content}
</AdaptiveSurface>
```

没写的断点沿用下一级，所以 `{ base: "sheet" }` 在所有宽度下都是 sheet，把一个界面换成另一种形态只要改一个词。`presentation.ts` 命名了不止一个界面共用的两张表；其余的都内联写（安装 sheet 是 `{ base: "sheet", lg: "window" }`，一个在任何宽度下都是 sheet 的小问题是 `{ base: "sheet" }`）：

```ts
ADAPTIVE_PRESENTATION  // { base: "sheet", sm: "panel", lg: "window" }
ANCHORED_PRESENTATION  // { base: "sheet", sm: "popover" }, owned by a button
```

用 `ANCHORED_PRESENTATION` 的界面不管视口如何都传 `popover={{ anchor }}`：形态是在渲染时决定的，所以不论当前视口是否用得上，都把 ref 交过去。

断点与 Tailwind 一致（`sm` 640、`lg` 1024，`SURFACE_BREAKPOINTS`），这样界面和它里面的内容在同一宽度响应，而不是差几个像素。

`useSurfaceMode()` 是一个类型限定为四种形态的 `useBreakpointValue()`。（有自己一套词汇的界面，比如命令面板的 sheet / popover，或 Ask 的 phone / desk，则对同一组断点使用通用版本。）它从 `base` 开始，让 SSR 和客户端首次渲染一致，然后在 effect 里落到真实视口上并实时跟踪。缩放窗口或旋转屏幕会把一个**已经打开**的界面直接换到新形态，而不是等下次打开。`{ immediate: true }` 则在首次渲染时就读视口，用于从不在服务端渲染、且绝不能先挂载错误形态的界面（app 窗口，它的形态里装着一个 iframe）。

### 会适配的内容

大多数内容不该关心自己落在哪种形态里。真要关心时（980px 的桌面窗口想把曲目列表分栏，手机 sheet 不想），去读它，而不是重新测量视口：

```tsx
const { mode, isWindow, close } = useSurfaceContext();
```

它只用来回答关于**容器**的问题：能放几列，一行该多紧凑。不要把它当作视口的代理。一个在 sheet 形态下隐藏某个设置的界面，等于让 presentation 映射表承担了行为，之后把这个界面换成 `panel`，功能提供的东西就会悄悄改变。要按约束本身来判断（CSS 已经命名的断点、某种能力），或者干脆不判断。

### 界面就是 chrome

`SHELL`（`sheet.tsx`）带有 `.system-chrome`，所以每种形态（sheet、panel、window、popover）以及其中的一切都是系统自己的 UI：不能选中文字，没有长按菜单，没有灰色点击闪烁。这是有意的，不是 class 列表的偶然，而且无论界面里装的是什么都成立。文本输入框是唯一的例外，写在 `globals.css` 里，让命令面板的搜索框和 devtool 的输入框保留光标。

目前每个界面都是 chrome，需要重新考虑的是内容型的界面：quick-look 里的一篇文章，panel 里预览的一个页面。给这样的内容加 `select-text` 能找回选中，却找不回被 `-webkit-touch-callout` 拿走的链接预览。所以它应该是第三种语态而不是一个覆盖，属于 `globals.css` 里的语态块，与另外两种放在一起。见 [Design System](./design-system.md#touch)。

### Sheet primitive

手机上的每种形态都是一个 `<SurfaceSheet>`（`sheet.tsx`）：一个 [Base UI Drawer](https://base-ui.com/react/components/drawer)、玻璃外壳、拖动条和边缘间距。`AdaptiveSurface` 在 sheet 模式下组合它，并加上标题栏和滚动区。头部不是标题栏的界面直接组合它（命令面板，头部是它的搜索框），依然拿到同样的外壳，所以不论装着什么，sheet 都是同一种 sheet。

```tsx
<SurfaceSheet id="command" open={isOpen} onOpenChange={…}
  modal                       // scrim: page blocked, tap outside dismisses
  snapPoints={SHEET_DETENTS}  // [0.7, 1]; opens at the first
  activeSnapPoint={snap} onActiveSnapPointChange={setSnap}
  label="Command palette">    // sr-only dialog name (or render a Drawer.Title)
  {content}
</SurfaceSheet>
```

**两个盒子。** `Drawer.Popup` 是一个透明的定位盒，高度等于 sheet 全部行程；玻璃外壳是它里面的 flex 子元素。Base UI 靠平移 popup 来移动 sheet，所以只有一个盒子的浮动 sheet 在较低的 detent 会把自己圆角的底部推出屏幕。popup 把同样的偏移量作为底部 padding，于是外壳始终立在底边上方 `BOTTOM_INSET`（Home 指示条，或 12px 的边缘间距）处，从顶部长高或缩短，静止时和手指拖动时都一样。越过最低的 detent（`--surface-detent-floor`）之后，padding 不再增加，sheet 整体滑走，因为这时的拖动是关闭，不是调整大小。

![三个手机画框。在最高 detent，虚线 popup 填满顶部 inset 以下的屏幕，带斜线的底部 padding 只有 inset 那么高。在 0.7，popup 向下平移了偏移量并超出屏幕底部，它的 padding 也增加了同样的偏移量，所以外壳变矮了，但底边没动。拖过最低 detent 时，padding 停在 floor，外壳整体下移。](/img/docs/system-surface/two-boxes.svg)

Base UI 移动的是虚线盒子；CSS（`app/globals.css` 的 "Secondary surface motion"）把同一个数变成 padding，所以在拖动变成关闭之前，玻璃只会改变高度。

**Detent。** `snapPoints` 是视口的比例，对应 iOS 的 medium 和 large；站内只有一组，`SHEET_DETENTS`（`[0.7, 1]`），所以叠在一起的 sheet 能齐平。带 detent 的 sheet，如果下面那个 sheet 所在的 detent 也是它自己的 detent 之一，就在那里打开（stack 会公布每个 sheet 的 `level`；固定高度的 sheet 用 `level` prop 说明自己的 level），否则在第一个打开。所以壁纸选择器叠在命令面板上时会与面板齐平地出现，也仍然能被拉到面板上方的最高处，就像 iOS 的子 sheet 可以比父 sheet 更高。Base UI 把当前的 detent 公布为 `--drawer-snap-point-offset`，把实时拖动公布为 `--drawer-swipe-movement-y`，都在 popup 上；读取它们的代码都在 `app/globals.css` 的一个块里，*Secondary surface motion*，使用站内自己的曲线（`stack.ts` 里的 `SURFACE_EASING`、`SURFACE_TRANSITION_MS`）。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-surface/detent-07.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上停在 0.7 detent 的命令面板：上方能看到问候语，sheet 的底部与屏幕边缘隔着一段间距。" />
  <img src="/img/docs/system-surface/detent-top.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个面板在点进输入框后升到最高 detent：玻璃到达顶部 inset；它的底边还在原来的位置。" />
</div>

命令面板在 0.7，以及点进输入框后在最高 detent。两张图里玻璃的底边位置相同；动的只有顶部。

**三种高度。** 装列表的 sheet 用 `snapPoints`，固定高度的用 `height`（默认 `80dvh`），只装一样短东西（一个表单、一个确认）的用 `fitContent`。固定高度的 sheet 如果要站在 detent sheet 站的位置，就用 `detentHeight(point)`：它减去同样的 `BOTTOM_INSET`，所以 `height={detentHeight(1)}` 与最高 detent 对齐（Ask，命令面板的 slash sheet）。`fitContent` 的 sheet 取它所装内容的高度，就像 iOS 按表单大小来定 form sheet，所以不会空出半截。它在一个以最高 detent 高度为上限的 popup 里是 `flex: 0 1 auto`：它自己测量，随内容长高缩短，只有内容超出屏幕时才缩到上限以下，所以由内容来限定自己的滚动区（在内容上加 `max-h-*`）。它不停在任何 detent，所以不取 `level`。短 sheet 都是这一种：load-bundle sheet、触屏上的窗口菜单（`systems/windows/components/window-menu.tsx`）、权限引导、安装 sheet、附件、身份卡片、阅读设置。键盘会像推其他 sheet 一样把它们推上去。

**出现。** sheet 应该升起，而且以它将要的大小升起。Base UI 新挂载的 sheet 会在 layout effect 里、绘制之前测量自己，所以第一帧时 detent 就已确定。需要帮忙的是 `keepMounted` 的 sheet（app 窗口），下面两个标记都以 `keepMounted` 为条件，所以在头半秒里开始的拖动依然能移动其他所有 sheet：

- 从 `display: none` 回来时没有盒子可以测量，所以在第一帧绘制时 Base UI 的偏移量是 `0`，而这*正是*最高 detent：sheet 先以全高落下，再滑到它的 detent。这个偏移量很好算（`popupHeight - detentHeight`），所以 popup 在 CSS 里以 `--surface-snap-fallback` 带着同样的算式，并在入场期间（`data-surface-entering`，仅限 detent sheet）以它为准。Base UI 自己的值会在标记移除之前落在下面，数值相同。
- 从 `display: none` 出来的东西不会有过渡。没有一个绘制过的"之前"可以出发，所以 Base UI 的起始样式不起作用，sheet 就直接出现了。`data-surface-arriving` 让它在底边先绘制一帧，sheet 再从那里升上去。这个属性在打开 sheet 的那次渲染中设置，两帧之后释放，因为 rAF 回调是在它自己那一帧*绘制之前*运行的。

**改变它说的内容：`SurfaceMorph`。** 一个分步骤推进的 `fitContent` sheet（先是一个提议，然后是结果）不能在步骤之间硬切：文字跳动，sheet 在一帧内突变到新高度。把会变的部分包进 `<SurfaceMorph step={…} render={(step) => …} />`（`systems/surface/morph.tsx`）：离开的步骤留在上层淡出，新的步骤稍后淡入，盒子在两个测得的高度之间以 `SURFACE_EASING` 缓动。sheet 的底边是固定的，所以它从顶部长高或缩短，和打开时一样。减弱动态效果时直接切换。`PermissionSheet`（`systems/ambient/components/permission-sheet.tsx`）用了它，所以基于它的每个引导都用了：陀螺仪的、定位的、sky window 的。

**Modal。** 遮罩就是 viewport。`Drawer.Viewport` 本来就是一个包含 popup 的透明全屏盒子，所以开启 `modal` 时它把页面拿走，按一下它就关闭；关闭时它是 `pointer-events: none`，只有 popup 接收指针。Base UI 的滚动锁定在 bezel 下是安全的，而 Radix 的不是：在 iOS 上它只给负责视口滚动的那个元素设置 `overflow: hidden`，从不给 `<body>` 设置 `position: relative`，而且当那个元素已经被锁定时它完全退让。这正是 `vitre` 在容器滚动期间留给页面的状态（`<html>` hidden，`<body>` 以 inset 0 fixed）。另外，bezel 让 `<body>` 保持 `overflow: clip` 而不是 `hidden`：`hidden` 是一个 `scrollIntoView` 仍然能移动的滚动容器，而一个停在较低 detent、底部伸出边缘的 sheet，正是它会为之滚动的那种溢出。

**让 sheet 保持存活。** `keepMounted` 让关闭的 sheet 的 DOM 留在原处（Base UI 隐藏 popup 而不是卸载它），用于收起后也必须继续运行的内容：手机上的 app 窗口（[system-windows.md](./system-windows.md)）是一个 sheet，关掉它否则会重新加载 iframe、丢失 app 的状态。

**自己的把手。** `grip` 替换拖动条，用于把手不只是在说"拖我"的 sheet：窗口把手，它同时也是窗口的菜单按钮。它渲染在拖动条的位置，在 `Drawer.Content` 之上，所以鼠标按在上面依然能开始拖动。`gripOverlay` 让它浮在内容之上而不是占一行，用于装的不是文档的 sheet：app 窗口的界面一直是浮在内容上的一个胶囊，从来不是标题栏。在那里做任何东西都会碰上两件事：Base UI 从不从 `<button>`（或 `a`、`input`、`select`、`textarea`、`label`、`[role="button"]`）开始 swipe，而一旦一次按压变成 swipe，它会捕获指针，之后的 move、up 或 click 都不会到达。见 `sheet.tsx` 顶部列表的第 8、9 条。

**那里不要有手势状态。** 一个随拖动而变化的把手，就是一个需要被改回来的把手，而 Base UI 手势的结束可能整个被错过。所以 sheet 不公布任何能让把手据以变化的东西，窗口把手只保留卡住了也无害的状态（被拇指按住时会亮起；从不改变形状）。`systems/windows/components/window-grip.tsx` 里记着做过这件事的五个版本的故事。如果将来某个把手必须随拖动而动，它应该是一段总在起点结束的动画，而不是一个需要别人来清除的状态。

**内容，不是把手。** 拖动条下面的一切都包在 `Drawer.Content` 里。没有它，*鼠标*按在 sheet 的任何地方都会开始 swipe，drawer 夺走指针，点击永远到不了被按下的那一行。触摸拖动仍然可以从任何地方关闭；Base UI 会识别滚动容器，所以在列表里拖动滚动的是列表。拖动属于自己的内容（app 窗口的主体）用 Base UI 的 `data-base-ui-swipe-ignore` 退出，这样把手就成了唯一的拖动把手。

**里面的横向滚动。** sheet 里的横向轨道（附件翻页器）在 iOS 上会被认领两次：浏览器平移轨道，Base UI 拖动 sheet，一次斜向滑动会同时移动两者。`useSheetAxisLock(trackRef, mode === "sheet")`（`axis-lock.ts`）在移动 3px 时按拖动的角度做决定，把手势交给其中一方。见 `sheet.tsx` 列表的第 10 条。

**关闭时的焦点。** sheet 会把焦点还给打开它的东西，除非 `restoreFocus={false}`。叠在一个含文本输入框的 sheet 之上的 sheet 要关掉它：交还给输入框的焦点，是一个有焦点却没有键盘的输入框，iOS 会在下一次随便触摸哪里时弹出键盘，不管那次触摸本来是要做什么。

**键盘。** `Drawer.VirtualKeyboardProvider` 包着每个 sheet，并公布 `--drawer-keyboard-inset`；外壳把它当作底部 margin，所以含输入框的 sheet 停在键盘上方而不是躲在键盘后面。没有输入框的 sheet 完全不受影响。sheet 里的输入框必须做什么、可以做什么，写在 [keyboard-input.md](./keyboard-input.md)。

**把 sheet 拉离边缘。** 拖动可以把 sheet 带过它的顶边，当松手时已超过顶边 `PULL_PAST_TOP_TRAVEL`（14）个真实像素，`onPullPastTop` 就会触发。一个有别处可去的界面可以把它理解为"离开边缘"。devtool 是这样做的；别的界面都不需要，不传这个 prop，越界部分就只是一段橡皮筋。

它测量的是**指针**，不是 popup。Base UI 用平方根衰减越界距离，而它开始 swipe 的阈值已经吃掉了手势的约 17px：在 iPhone 13 上测得，从 0.7 detent 拉 207px，公布出来的移动只有 1.6px。这个数画橡皮筋很好，拿来判断意图却很糟。手指给出的则是 `travelled up − the offset the sheet had to climb through`，所以一次连续的拉动既能调整 sheet 的大小，又能在它顶到天花板后继续计数。

阈值小，是因为预算小：一次拉动的大部分都花在调整大小上，剩下的只是从拖动条到玻璃顶部的距离，约二十像素。拉到顶就停的，依然吸附到全高 detent；只有继续拉的才会脱离，而外壳在两者之间带着 `data-pull-armed`，让区别看得见。怎么回来是功能自己的事，不是 sheet 的：devtool 把它的胶囊拖到底边的一个着陆区上。见 [Devtool System](./system-devtool.md)。

### 堆叠

iOS 会堆叠 sheet。从一个 sheet 打开另一个，会让前一个退后一步（更小、更暗、稍高一点、不可交互），当上面那个离开时再把它带回前面。每一步上移 8px、缩小 5%，并在玻璃上盖一层黑色而不是降低不透明度，让玻璃仍然是玻璃。这是界面之间的关系，而不是任何一方的属性，所以它在 `stack.ts` 里：一个模块级的 store（这些界面挂载在不同的子树里，而 store 不需要 provider 就能到达所有子树），每个打开的 sheet 按顺序在里面登记。在它之后又打开了别的 sheet 的那个，读到 `behind` 并后退；它在关闭时而不是卸载时注销，所以后面那个会随顶层 sheet 的退场同步回到前面。后退用的是它自己的曲线（`SURFACE_RECEDE_EASING`，ease-in-out）：sheet 在父 sheet 的深度变化后一帧才开始移动，而在行进曲线上，那一帧已经是后退过程的三分之一，父 sheet 会在子 sheet 到达之前先抖一下。

Base UI 有自己的嵌套 drawer，带 `data-nested-drawer-open` 和 `--nested-drawers`，但只有当一个 drawer 是另一个的 React 子元素时它才算嵌套。壁纸选择器、播放列表和命令面板都挂载在根 layout 的兄弟子树里，所以这些仍由 `stack.ts` 负责。当一个 sheet *确实*是嵌套的（命令面板的 slash sheet 和 load-bundle sheet），它用 `nestedIn="command"` 说明，父 sheet 的深度则改由 Base UI 提供：`--nested-drawers` 减去子 sheet 的 `--drawer-swipe-progress`，这样子 sheet 被往下拉时，父 sheet 在手指下跟着回到前面，并在 `data-nested-drawer-swiping` 设置期间关闭过渡。`nestedIn` 让 stack 不再把子 sheet 重复计数。两者都汇入外壳所依据的同一个 `--surface-depth`。

<img src="/img/docs/system-surface/stack-nested.png" style={{ width: "50%" }} alt="手机上命令面板之上的 slash sheet：命令面板已经退后一步，在 slash sheet 顶部上方露出一条更窄、更暗的玻璃边缘。" />

slash sheet（命令面板里的 `/`）叠在命令面板上：这是嵌套 sheet，由 Base UI 计数。命令面板的边缘在它上方露出来，更窄也更暗，在 slash sheet 离开之前不可交互。本页开头手机上的选择器是另一种：兄弟子树，由 `stack.ts` 计数。

每个叠在 sheet 上的 sheet 都是真正的堆叠：关掉上面的，下面的就回到前面。壁纸选择器下面的命令面板退后一步；slash sheet 和选择器下面的，退后两步。见 [Command System](./system-command.md)。

stack 的顺序也是绘制顺序。每个 viewport 都是同一层级的层叠上下文，所以兄弟 sheet 否则会按它们 portal 挂载的顺序绘制。只要每个 sheet 都在打开时挂载，这没问题；一旦有一个保持挂载就错了：一个收起的 app 窗口被重新带回到一个更新的 sheet 之上（比如附件 sheet，它的 `Visit` 恢复了这个窗口），会出现在那个 sheet 下面，而 stack 却说它在最上面。所以 sheet 把自己在 stack 中的位置作为 `layer`（`useSurfaceStack().rank`，`SurfaceViewport` 的 `layer`），而正在关闭的 sheet 保留它原来的 layer，从它原来所在的位置离开，而不是从它刚才盖住的东西下面离开。当前 stack 的读数是 `useSurfaceStackEntries()`，供附件实验页使用。

#### 是覆盖，而不只是更晚

第二个打开不等于覆盖。Dock 的 Live Activity 面板从顶边垂下，sheet 从底边升起，所以两者可以同时出现而谁也不遮谁。影院播放列表正好停在面板的底边，而从播放器卡片*打开*的队列，应该让那张卡片保持可用，而不是把它调暗、变得不可交互。

所以每个界面报告自己所在的带（`useSurfaceStack` 上的 `band`），只有与之重叠的界面才算在它上面。没报告带的视为覆盖一切，这正是在它们都能说明之前每个界面原有的行为。所以从不登记的形态（panel、window、popover：平板和桌面上没有东西会后退）不受影响，新的 sheet 在被测量之前也是正确的。

带是两个 Y 坐标而不是一个矩形，这是对 stack 成员的一个断言：每个成员都锚定在一条边上并横跨整个宽度，所以它在垂直方向上的位置就是它的全部位置。

两个结果，都在 iPhone 13 上测得：

- Dock 面板（8–269）和它下面的播放列表 sheet（277–652）恰好拼接：两者都不是 `data-behind`，都保持可用。
- 停在 0.7 detent 的命令面板（199–652）*确实*盖过了面板，所以它仍然让面板和 sheet 都退后，和以前完全一样。

**测量布局，绝不测量 rect。** 带所决定的后退，是加在被测元素本身上的 `scale()`，所以 `getBoundingClientRect` 会把自己的答案再喂回去。`useMeasuredBand` 负责这些管道：现在测一次，入场落定后（`SURFACE_TRANSITION_MS` 之后）再测一次，外壳每次尺寸变化（一个 `ResizeObserver`，detent 变化就是这个）或窗口尺寸变化时都再测。每种形态提供一个基于 `offsetTop` / `offsetHeight` 的读数：

| | 固定的边 | 所以测量结果 |
|---|---|---|
| sheet | 底边（popup 的 padding 在每个 detent 都把外壳撑在屏幕边缘之上） | 它的高度说明它的**顶部**在哪 |
| dock 面板 | 顶边（`popup.offsetTop`） | 它的高度说明它的**底部**在哪 |

因为 detent 变化是 popup 上的 padding，而不是外壳上的 transform，sheet 的带在拖动中实时更新：拼接在手势进行时就解决了，而不是之后。

一个必须绕开某个不属于自己的界面的界面，去读那个带，而不是从外面重新测量。`useSurfaceBandOf("dock-activity")` 就是播放器变成 Live Activity 时影院播放列表找到自己天花板的方式。这样每条边只有一个所有者，两者不可能互相矛盾。

## 规则

下面每一条被打破，都会有看得见的问题。

| 规则 | 原因 | 打破之后 |
|---|---|---|
| 用 `presentation` 映射表选形态，功能代码里绝不用 `matchMedia` 或宽度判断 | 这个判断属于视口，只写一次 | 界面在相差几个像素的宽度上变形态，并且逐渐走样 |
| `useSurfaceContext()` 只用于容器问题 | 映射表是布局选择，不是行为开关 | 把界面换成 `panel`，它提供的东西悄悄变了 |
| 能成为窗口的 `id` 要在 `DRAGGABLE_DEFAULTS`（是否可拖动）和 `DRAGGABLE_INSTANCES`（devtool 的列表）里，`systems/devtool/provider.tsx` | `useDraggable` 按 id 查找；未知 id 是 `draggable: false` | 一个挪不动的窗口，devtool 里也没有它的那一行 |
| 除非是启动器，否则非 modal | 这里的每个界面都是为背后的活页面服务的 | 一碰它所服务的页面就关闭的界面 |
| 用 `offsetTop` / `offsetHeight` 测量 sheet | 后退的 sheet 被 `scale()` 了 | 带把自己的后退又喂了回去 |
| 嵌套在另一个 sheet 里（React 子元素）的 sheet 传 `nestedIn` | Base UI 已经在父 sheet 上计过它了 | 一个子 sheet 让父 sheet 退后两步 |
| 叠在含文本输入框的 sheet 之上的 sheet 传 `restoreFocus={false}` | 在 iOS 上交还给输入框的焦点，是一个没有键盘的输入框 | 下一次触摸时键盘凭空弹出 |
| 堆叠的 sheet 用 `SHEET_DETENTS`、`detentHeight()` 或 `level` | 只有一组高度，子 sheet 才能齐平地出现 | 子 sheet 落在离父 sheet 差几个像素的地方 |
| popup 上不写 `transition: none`，不留需要手势结束来清除的状态，内容放在 `Drawer.Content` 里 | Base UI 的契约（下一节） | sheet 没有退场动画就消失，把手卡住，行点不动 |

### 与 Base UI 打交道

sheet 的动效是照着 Base UI Drawer 的契约（它公布的 data 属性和自定义属性）写的，而这份契约在它的文档、嵌套示例和源码里，不在它的类型里。修改 `sheet.tsx` 或 `globals.css` 里的 *Secondary surface motion* 块之前，先读 `systems/surface/sheet.tsx` 顶部那段编号列表；它记录的是已经踩过的坑。简要地说：

- `--drawer-swipe-progress` 只有在没有 detent 的 sheet 上才是"移出了多少"的比例；有 detent 时它是在 detent 之间的位置。父 sheet 必须跟随其 swipe 的 sheet 不设 detent。
- swipe 变量注册为不继承；后代要用 `--name: inherit` 主动继承。
- 当 `data-ending-style` 之后一帧 `popup.getAnimations()` 为空时，退场就结束了。popup 在那一帧绝不能带 `transition: none`；去掉时长，保留属性。
- 嵌套就是 React 嵌套；兄弟子树里的 sheet 用 `stack.ts`。
- 关闭的对话框会把焦点还给打开它的东西；如果那是触屏设备上的输入框，就 `restoreFocus={false}`。
- 每条手势路径单独测试：click、触摸点击、swipe 松手、程序设置焦点。

Base UI：https://base-ui.com/react/components/drawer（在 `package.json` 里固定为 1.8.0）。嵌套示例在它仓库的 `docs/src/app/(docs)/react/components/drawer/demos/nested/` 下。

## 可以自由选择的

- **映射表。** 任何 `BreakpointMap<SurfaceMode>`；只有当第二个界面也想要同一张时才给它命名。
- **手机上的高度模型：** detent、固定的 `height`，或 `fitContent`。
- **窗口大小和位置。** `windowWidth`、`maxHeight`；直接在 `SurfaceWindow` 上用 `placement`。
- **popover 的宽度和对齐**（`popover.width`、`popover.align`）。
- **头部附加内容。** 关闭按钮旁的 `actions`；组合外壳时 `SurfaceBody` 上的 `toolbar` / `footer`。
- **绘制层。** 给必须盖过更高层界面的界面设 `zIndex`（附件和身份卡片盖在 About 之上）。
- **在宽屏上仍是 sheet 的 sheet 的宽度上限**（`sheetMaxWidth`，共享语言的那个问题）。

## 添加一个界面

1. 选一个 presentation：为页面服务的界面用 `ADAPTIVE_PRESENTATION`，属于某个按钮的用 `ANCHORED_PRESENTATION`（加上 `popover={{ anchor }}`），或者内联写一张表。
2. 给它一个 `id`（`surface-…`）。如果它可以是窗口，把 id 加进 `DRAGGABLE_DEFAULTS` 和 `DRAGGABLE_INSTANCES`。
3. 选它在手机上的高度：列表用 `snapPoints={SHEET_DETENTS}`，一样短东西用 `fitContent`，其余用固定的 `maxHeight`。
4. 传入 `title`、`closeLabel`（都经过 `t()`）和内容。想要分栏的内容读 `useSurfaceContext()`。
5. 只挂载一次（大多数都在根 layout 的 provider 里），然后在任何地方通过它的 provider 的 `open…()` 打开。
6. 在 393、820 和 1280 宽度下检查它；在手机上，把它叠在命令面板上打开再关闭，并在 detent 之间拖动。

里面有文本输入框：见 [keyboard-input.md](./keyboard-input.md)。

## 参考

### 值得知道的 props

`AdaptiveSurface` 上：

| Prop | 用途 |
|------|-----|
| `id` | sheet 在 stack 中的 key，也是 window 模式下可拖动实例的 key。 |
| `title` / `actions` | 头部内容。`actions` 在关闭按钮左边。 |
| `windowWidth` | 仅限 window 模式（默认 `min(92vw, 560px)`）；drawer 按它们所贴的边来定尺寸。 |
| `popover` | `{ anchor, width?, align? }`：popover 形态的设置。放在一组里，是因为 `anchor` 是前提而不是调优：没有它卡片无法定位，所以它在对象里是必填的，而不是靠文字叮嘱。 |
| `maxHeight` | 限制 window 和 popover 的高度。在 sheet 形态下它是 sheet 的**固定高度**（`SurfaceSheet` 的 `height`），除非 `snapPoints` 或 `fitContent` 接管。 |
| `fitContent` | 按内容而不是按屏幕定尺寸。就是 sheet 的 `fitContent`（见**三种高度**）；popover 本来就在上限内按内容定尺寸。 |
| `snapPoints` | sheet 形态的 detent，从低到高；拖动会把它带到顶部。 |
| `zIndex` | 每种形态的绘制层（默认 60）。 |
| `sheetMaxWidth` | sheet 形态的宽度上限，居中。 |
| `contentClassName` | 覆盖滚动区的 padding，用于需要更宽出血的内容。 |
| `scrollRef` | 滚动容器，用于需要把某一行滚进视野的内容。 |

primitive 上有几个 prop 是策略层有意不往下传的。想要其中某个的界面，应该直接组合外壳：

| Prop | 所在 | 用途 |
|------|----|-----|
| `toolbar` | `SurfaceBody` | 头部和滚动区之间一条不会滚走的条带，比如内容的索引。 |
| `footer` | `SurfaceBody` | 滚动区下方一条不会滚走的条带。 |
| `placement` | `SurfaceWindow` | 拖动之前窗口停在哪：`center`（默认）或 `top-right`。 |
| `modal`、`activeSnapPoint`、`level`、`restoreFocus`、`nestedIn` | `SurfaceSheet` | 见 **Sheet primitive** 和**堆叠**。 |
| `keepMounted`、`grip`、`gripOverlay` | `SurfaceSheet` | app 窗口的 sheet。 |
| `onPullPastTop` | `SurfaceSheet` | 把 sheet 从它所贴的边上拉下来的那次拖动。 |
| `dragHost`、`initialFocus` | `SurfacePanel` | Ask 的侧边 panel。 |

### 使用者

| 界面 | Presentation | 说明 |
|---------|--------------|-------|
| 音乐播放列表 | `ADAPTIVE_PRESENTATION` | macOS 尺寸的窗口（`min(94vw, 980px)` × `min(78vh, 620px)`），曲目列表会分栏。没有 detent：手机上 `maxHeight` 就是 sheet 的高度 |
| 壁纸选择器 | `ADAPTIVE_PRESENTATION` | window 模式下三列图块网格；作为 sheet 时用 `SHEET_DETENTS` |
| 影院播放列表 | `ADAPTIVE_PRESENTATION` | 视频播放器的专辑和曲目。它的 detent 不是一对比例，而是播放器位置的函数（`playlistDetents`）：sheet 停在播放器当前形态的下方。那要么是画中画窗口（列表打开时 provider 把它停在屏幕顶部），要么是它收进去的 Dock 卡片（从那张卡片的带读取）。在手机上两者把屏幕一分为二而不是重叠，列表永远不用绕着视频。平板 panel 无法这样调整大小，所以在那里它止于窗口上方 |
| 附件 | `ADAPTIVE_PRESENTATION` | 一次 commit 的附件，分页显示（`useSnapPager`、`useSheetAxisLock`）。`fitContent`；560px 的窗口；盖在 About 之上（`zIndex`）。在手机上每个附件都在这里打开；在别处只有没有原生归宿的类型才会到这里。见 [Attachments System](./system-attachments.md) |
| 阅读设置 | `ANCHORED_PRESENTATION` | 文章页的 "Aa"。`fitContent` sheet，从那个 chip 起始对齐的 popover；只有设置会起作用的地方才出现对应的行，所以 sheet 比 popover 短 |
| 身份卡片 | `ANCHORED_PRESENTATION` | 谁签了一个 commit：一张给手指用的资料卡。有指针时，同样的资料是一个磁吸的悬停预览，这个界面从不打开。`fitContent`；popover 挂在被点的那个 `<handle>` 或 `Role:` 上，anchor 由它的 provider 存在一个 ref 里。见 [Identity System](./system-identity.md) |
| 语言注释 | `ANCHORED_PRESENTATION` | 语言图表上某门语言的注释（`components/languages/pl-chart.tsx`）。`fitContent`，从被按下的圆点居中对齐的 popover |
| 安装 | `{ base: "sheet", lg: "window" }` | "Add to Home Screen" 之前的说明（`systems/install`）。`fitContent`；400px 的窗口 |
| 权限引导 | 默认 `{ base: "sheet" }` | `PermissionSheet`：陀螺仪和 sky window 的提议，以及定位引导（`{ base: "sheet", sm: "window" }`，380px 的窗口）。`fitContent` 和 `SurfaceMorph` |
| 共享语言的问题 | `{ base: "sheet" }` | 一个以读者另一种语言分享的链接（`components/post/language-sheet.tsx`）。任何宽度下都是 sheet，`sheetMaxWidth` 400px，`fitContent` |
| Band 实验页读数 | `{ base: "sheet" }` | `/lab/band`。`fitContent`，400px 宽 |
| 命令面板 | 通过 `useBreakpointValue` 实现的 `{ base: "sheet", sm: "popover" }` | 直接用 `SurfaceSheet`，`SHEET_DETENTS`，modal；它的 slash sheet 和 load-bundle sheet 嵌套在它里面（`nestedIn="command"`）。它的宽屏形态是它自己的 Spotlight 卡片，不锚定任何东西，不是上面那种 `popover` 形态。devtool 的 "Phone palette" 可以在手机上强制使用这张卡片 |
| Ask | `useAskPlatform()`：phone → sheet，desk（从 640 起）→ panel | 直接用 `SurfacePanel` / `SurfaceSheet`（`height={detentHeight(1)}`、`restoreFocus={false}`），里面是以输入框为 `footer` 的 `SurfaceBody`；对话自己滚动。是停靠的而不是浮动的：它是挨着页面读的，从 1280px 起页面会为它让出位置。见 [Ask](./system-ask.md) |
| 触屏上的 app 窗口 | primitives | `SurfaceSheet`，有自己的三个 detent，`keepMounted`，浮在内容上的 `grip`（`gripOverlay`）；窗口菜单是一个嵌套的 `fitContent` sheet。见 [Windows](./system-windows.md) |
| Devtool 面板 | primitives，而非 `AdaptiveSurface` | 停靠时是 `SurfaceSheet`，浮动时是 `SurfaceWindow`，用哪个由开发者而不是视口决定：它是被手拉离边缘的。`onPullPastTop`，`placement="top-right"`，一个放模块栏的 `toolbar` 和一个放状态行的 `footer`。见 [Devtool System](./system-devtool.md) |
