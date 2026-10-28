---
origin: "AI-translated from the original"
---

# 在手机上打字

站内的输入框怎样遇上软键盘：Ask 的输入框为什么能稳稳停在键盘上方，同时外层玻璃面板跟着缩短；其中哪些是承重的，哪些可以自由选择；以及站内每一个输入框目前的状态。

## 做好了是什么样

手机上的 Ask（`systems/ask/surfaces.tsx`，`ask` 这个 sheet）：

- 输入框停在键盘上，和键盘之间的间距与玻璃面板离屏幕两侧的间距一样。没有东西藏在键盘后面，也没有东西悬空。
- 键盘升起时玻璃面板从底部缩短，键盘落下时再长回来，用的是 surface 的动效曲线。顶边、拖动条和标题栏始终不动。
- 对话区占据中间的空间：它会滚动，而不是被推出顶部。
- 底下的页面不会缩放、滚动或跳动。
- 输入框四周与玻璃面板保持同一个内边距（8px）：Home 指示条是外壳要处理的事，不是输入框的事。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/keyboard-input/ask-keyboard-down.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的 Ask，键盘收起：sheet 撑满全高，输入框在最底部。" />
  <img src="/img/docs/keyboard-input/ask-keyboard-up.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个 sheet 在 iPhone 上弹出键盘：顶边、拖动条和标题栏都没动；玻璃面板止于 Safari 的辅助栏上方，输入框停在那里。" />
</div>

键盘收起（无头浏览器，393pt 宽）和弹出（iPhone 上的 Safari）。顶边没有动；玻璃面板变矮了，让出高度的是推荐问题列表。

## 原理

五个部分，各在一处。

![外层 popup 高度不变；里面的 shell 把键盘高度当作 margin-bottom，从底部缩短，内容区让出空间，输入框停在键盘上。](/img/docs/keyboard-input/layers.svg)

1. **测量。** 每个 `SurfaceSheet`（`systems/surface/sheet.tsx`）外面都包着 Base UI 的 `Drawer.VirtualKeyboardProvider`。它监听 `visualViewport`（`resize`、`scroll`）和焦点；当*这个 drawer 内部*的键盘类输入框获得焦点时，它在 drawer 的 viewport 上写出 `--drawer-keyboard-inset`：`innerHeight - (visualViewport.offsetTop + visualViewport.height)`，也就是键盘（加上 Safari 辅助栏）占掉的整段高度。否则为 0。源码：`node_modules/@base-ui/react/drawer/virtual-keyboard-provider/`。
2. **形状。** `[data-surface-shell]` 把这个值作为自己的 `margin-bottom`，用 `--surface-duration` / `--surface-easing` 过渡（`app/globals.css` 的 "Secondary surface motion" 一节）。
3. **为什么是缩短而不是上移。** popup 的高度是固定的（一个 detent，或 `detentHeight(1)` 这样的 `height`），shell 是它的 `flex-1` 子元素。给固定高度盒子里的 flex 子元素加底部 margin，会从子元素身上扣掉高度：玻璃面板变矮，顶边不动。`fitContent` 的 sheet 则是 `flex: 0 1 auto`，同样的 margin 会把它整个抬起来：表单骑在键盘上（bundle sheet 就是这样）。
4. **内部布局。** `SurfaceBody`（`systems/surface/chrome.tsx`）是一列：header `shrink-0`、内容 `flex-1 overflow-y-auto`、footer `shrink-0`。输入框放在 footer，所以它总是 shell 底边上方的最后一样东西，让出高度的是内容区。
5. **滚动区里的输入框。** 如果输入框不在 footer，而在可滚动的内容里（比如编辑一条已发送的问题，`systems/ask/components/messages.tsx`），provider 会滚动最近的可滚动祖先，把输入框居中放在键盘上方的那段空间里，并临时加上 `padding-bottom` / `scroll-padding-bottom` 腾出位置。这一步不需要我们自己写任何代码。

## 约束

下面每一条被打破，都会有看得见的问题。

| 约束 | 原因 | 打破之后 |
|---|---|---|
| 输入框在 `SurfaceSheet` 里面 | provider 只测量自己 drawer 内部的焦点 | 没有 inset：输入框被键盘挡住 |
| 输入框是键盘类：`textarea`，或 type 为 text、search、email、url、password、number、tel（或不写）的 `input` | 这是 provider 自己判断"这里会弹出键盘"的标准 | 其他类型不会有 inset；反正它们也不弹键盘 |
| 手机上字号至少 16px（`text-[16px] sm:text-sm`） | iOS Safari 在聚焦字号小于 16px 的输入框时会放大页面，而 `visualViewport.scale !== 1` 时 provider 会放弃测量 | 页面被放大，然后没有 inset |
| popup 高度固定、shell 是 `flex-1`（或者 sheet 是 `fitContent`） | 正是这一点让底部 margin 变成缩短（或抬起） | 高度由内容决定的 shell 会长出屏幕 |
| shell 内部是一列：内容 `min-h-0 flex-1` 可滚动，输入框 `shrink-0` 跟在后面 | 让出高度的是内容区 | 没有 `min-h-0`，内容区不肯缩，输入框被挤到键盘下面 |
| shell 里不写 `env(safe-area-inset-bottom)`，也不自己算 `visualViewport` | shell 已经站在 Home 指示条上方（`BOTTOM_INSET`），也已经站在键盘上方（inset）；再算一次就是多出来的空隙（输入框下面曾经有约 34px，而两侧只有 8px） | 双重间距，或者两套测量互相打架导致输入框跳动 |
| 叠在含输入框的 sheet 之上的 sheet，设置 `restoreFocus={false}` | 在 iOS 上把焦点还给一个输入框，等于留下一个有焦点却没有键盘的输入框，下一次随便点哪里都会弹出键盘 | 关掉一个 sheet 之后键盘莫名其妙弹出来 |
| 不要和 provider 的滚动对着干：聚焦时不调 `scrollIntoView`，sheet 里不放 `position: fixed` 的输入框 | 它已经负责把输入框带进视野，在 modal drawer 中还接管了 window 的滚动 | 两套滚动互相竞争；sheet 底下的页面跟着动 |
| 保持 `app/layout.tsx` 的 viewport 设置不变（不加 `interactive-widget`） | 测量依赖 `resizes-visual`（iOS 唯一的行为，也是默认值）：layout viewport 高度不变，`visualViewport` 变小 | layout viewport 一旦跟着变，`100dvh` 和 inset 会同时变化 |

## 可以自由选择的

- **高度模型。** detents（`snapPoints={SHEET_DETENTS}`）、一个固定高度（`height={detentHeight(1)}`，Ask 用的就是这个），或者 `fitContent`（短表单）。前两种会缩短，最后一种会抬起。
- **聚焦时要不要拉高 sheet。** 命令面板在点击输入框时会升到最高的 detent（`systems/command/sheet.tsx` 里的 `onFieldTap`）；Ask 本来就是全高。
- **拖动时键盘怎么处理。** 命令面板被拖到最高 detent 以下时会让输入框失焦；别的 sheet 可以保留焦点。
- **内边距。** 设计想要多少都行，只要四周是同一个思路，而且其中不包含 Home 指示条。
- **是否 modal。** modal 的 sheet 在键盘弹出期间还会锁住 window 的滚动；Ask 不是 modal，也不需要。
- **动效。** `--surface-duration` / `--surface-easing` 是站内统一的曲线；键盘自己的动画属于系统，读不到。
- **输入框放在哪里。** footer（输入框、搜索）、header（命令面板的输入框就是它的 header），或者内容区（就地编辑）。只有 footer 和 header 能在不滚动的情况下保持不动。

## 做法

sheet 底部的输入框：

```tsx
<SurfaceSheet id="…" open={open} onOpenChange={…} height={detentHeight(1)} restoreFocus={false}>
  <SurfaceBody
    title="…"
    contentClassName="flex min-h-0 flex-col overflow-hidden"
    footer={<div className="p-2 pt-0">{/* the field, text-[16px] sm:text-sm */}</div>}
  >
    {/* the list, min-h-0 flex-1 overflow-y-auto */}
  </SurfaceBody>
</SurfaceSheet>
```

短表单：sheet 用 `fitContent`，表单自己的滚动区用 `min-h-0 overflow-y-auto`（`systems/command/sheet.tsx` 里的 bundle sheet）。

不在任何 sheet 里的输入框：

- 在页面自身的文档流里（比如 lab 的面板）：除了字号什么都不用做，浏览器会把获得焦点的输入框滚进视野。
- 不在 sheet 里却钉在屏幕底部：别这么做。如果某个 surface 非这样不可（Dock 顶部锚定的 Ask 面板），就按 `systems/ask/components/activity.tsx` 发布 `--ask-viewport` 的方式，用 `visualViewport.height` 来定尺寸，并在键盘弹出时实测。

## 检查一个输入框

1. 手机宽度下字号 16px 或以上（`text-[16px] sm:…`）？
2. 在 `SurfaceSheet` 里，还是在页面文档流里？两者都不是，就是个问题。
3. sheet：固定高度或 `fitContent`；内部内容区 `min-h-0 flex-1`，输入框 `shrink-0`？
4. 在 sheet 里没有额外加 `env(safe-area-inset-bottom)` / `visualViewport` / `scrollIntoView`？
5. 叠在它上面的 sheet 设置了 `restoreFocus={false}`？
6. 在真机上（Playwright 弹不出 iOS 键盘）：点击输入框，确认顶边不动、键盘上方的间距与两侧一致；打字、滚动内容、拖动 sheet、收起键盘。

## 站内每一个输入框

以写这一页时的排查为准（2026-10）。

| 输入框 | 手机上在哪里 | 状态 |
|---|---|---|
| 命令面板搜索，`systems/command/sheet.tsx` | `command` sheet，有 detents，输入框在 header | 良好；点击时升到最高 detent |
| 命令面板搜索，`systems/command/popover.tsx` | 只在桌面（手机上只有通过 devtool 才会出现） | 不在范围内；手机上照样是 16px |
| Load bundle 网址，`systems/command/load-bundle-panel.tsx` | `command-bundle` sheet，`fitContent`，叠放 | 良好；原来 13px，手机上已改为 16px |
| Ask 输入框，`systems/ask/components/composer.tsx` | `ask` sheet，footer | 参照标准 |
| Ask 上下文搜索，同一文件 | 同一个 sheet，在输入框上方 | 良好；原来 14px，手机上已改为 16px |
| Ask 编辑已发送的问题，`systems/ask/components/messages.tsx` | 同一个 sheet，在滚动区里 | 良好；provider 会把它滚进视野 |
| Dock 里的 Ask，`systems/ask/components/activity.tsx` | 手机上默认不出现（预设） | 用 `--ask-viewport` 定尺寸，没有 provider |
| Lab 文本框、颜色 hex，`systems/lab/components/controls.tsx` | `/lab/icon`，页面文档流 | 良好；原来 14px / 12px，手机上已改为 16px |
| Lab API 过滤框，`systems/lab/components/library.tsx` | `/lab/vitre/api`，页面文档流里的吸顶栏 | 良好；原来 12px，手机上已改为 16px |
| Works 编辑器、tag 编辑器，`app/lab/works/` | 只在桌面（1024px 以下关闭检查器） | 不在范围内 |
| Legibility 导出框，`app/lab/legibility/view.tsx` | 只读，不弹键盘 | 不在范围内 |

## 待定

- **添加到主屏幕后键盘上方的间距。** shell 停在屏幕底部上方 `max(env(safe-area-inset-bottom), 12px)` 的位置，键盘的 inset 再叠加在上面。在 Safari 里这个 inset 很小，间距与两侧一致。在添加到主屏幕的 App 里，Home 指示条的 34px 仍然留在 `env()` 里，而键盘已经盖住了它，所以玻璃面板会停在键盘上方约 34px，而两侧只有 12px。一个候选方案（未经真机测试）：`margin-bottom: max(0px, var(--drawer-keyboard-inset, 0px) - (max(env(safe-area-inset-bottom), var(--surface-gap)) - var(--surface-gap)))`。
