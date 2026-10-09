---
origin: "AI-translated from the original"
---

# 小组件滚动

小组件的列表在指针下会滚动，在手指下纹丝不动。用手指时，落在小组件上的每一次竖向滑动都归页面；列表只有在滚轮驱动的地方才可以自己滚动。这条规则看起来很随意，其实不是，本页讲的就是背后的道理。

## 做好了是什么样

在手机上，从写作卡片的列表行开始的一次滑动，滚动的是页面。列表行跟着卡片一起上移；卡片里面什么都没动。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-widget-scroll/phone-swipe-before.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的主屏，写作卡片位于屏幕中部，有五行。" />
  <img src="/img/docs/system-widget-scroll/phone-swipe-after.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="从写作卡片的列表行开始向上拖动 250px 之后的同一屏：整个页面上移了，卡片里仍是同样的五行，位置也没变。" />
</div>

从第四行开始向上拖动 250px 之前和之后（无头 Chromium，iPhone 15 Pro 视口）。页面移动了 235px；列表移动了 0px，标题下面的第一样东西仍然是它的第一行。

![1280px 宽桌面上的写作卡片：标题和五行，最后一行离卡片底边 20px，没有渐隐，也没有滚动条。](/img/docs/system-widget-scroll/desk-writing.png)

桌面上的同一张卡片。它显示同样的五行，同样是 238px，没有视窗（port）：列表短到用不着它（见下表），所以在这里，滚轮在它上面滚动的也是页面。等列表超过六行，视窗就会出现在这里，滚轮也就交给它。

## 原理

![小组件列表区上一个手势的判定：如果小组件没有传 port，列表区就是一个普通的堆叠，在任何设备上手势都归页面；如果传了，pointer-fine 设备得到一个会吸附、会渐隐、接管滚轮的视窗，手指则得到一个最多 TOUCH_ROWS 行的堆叠，滑动归页面。下方：手指按住不动，在卡片自己的表面上 400ms 后卡片浮起，按在行上则归这一行，漂移超过 10px 就取消。](/img/docs/system-widget-scroll/decision.svg)

**一个组件，一条媒体查询。** 每个小组件的列表区都是 `WidgetScrollBody`（`components/ui/widget.tsx`）。它的 class：

```
always       relative -mx-2 px-2 pb-3 overflow-hidden no-scrollbar
with port    pointer-fine:pb-7 pointer-fine:overflow-y-auto
             pointer-fine:snap-y pointer-fine:snap-mandatory pointer-fine:scroll-smooth
             pointer-fine:[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]
             + the port string itself (writing: pointer-fine:max-h-64)
```

列表区默认是普通堆叠，`port` 让某个列表重新可以滚动，且只在指针下。它之所以是一个 prop，是因为高度、滚动、渐隐以及渐隐需要的空间是同一个决定：没有视窗的列表区不能在最后一行上盖遮罩，也不能在它下面预留 28px。`no-scrollbar` 隐藏了滚动条，所以渐隐是视窗唯一的提示，让人发现它的是悬停。

**每个列表显示什么**，于是就成了一个挑选的问题，而不是截断的问题：

| | 触摸 | 指针 | 现状 |
|---|---|---|---|
| **projects**（`ProcessingWidget`） | `featured-projects` 分组，没有视窗 | 相同 | 5 行，238px |
| **writing**（`WritingWidget`） | `TOUCH_ROWS`（5）；超出的行带 `pointer-coarse:hidden` | 全部显示；只有 `rows.length > PORT_ROWS`（6）时才有视窗（`pointer-fine:max-h-64`） | 5 行（3 篇最新 + 2 篇精选），没有视窗，238px |

项目卡片读取自己的分组，就像演讲卡片读取 `featured-*-talks` 那些分组一样（`components/home/processing-widget.tsx`）：预览是对“展示什么”的选择，而截断的列表不是。写作没有这样的分组，所以按数量封顶（`components/home/writing-widget.tsx`）。

**长按是手指能在卡片上做的另一个手势。** 网格的 `SortableMasonryItem`（`components/ui/sortable-masonry.tsx`）只在按住时才让卡片浮起：dnd-kit 的 `TouchSensor` 配合 `TOUCH_ACTIVATION`（`{ delay: 400, tolerance: 10 }`，`components/ui/sortable-order.ts`），所以普通的滑动永远归页面。`usePressHold` 在按住过程中让卡片放大，漂移超过 10px 或发生任何滚动时结束。按在行上归这一行（`components/ui/widget-surface.ts` 里的 `landsOnOwnAction`：`a` 就是它自己的动作），所以按住一行永远不会让卡片浮起。主屏的文本选择锁（`useLockTextSelection`）防止这次按住变成 iOS 的整页选择。涉及的 class，`press-hold`、`system-surface` 和 `system-voice`，见 [Design System: Touch](./design-system.md#touch)。

## 约束

**手指下没有任何小组件列表区会滚动。** 视窗是嵌在页面自身竖向滚动里的一个竖向滚动区。用滚轮时这没问题：滚轮交给光标下面的东西。用手指时，赢的永远是小组件：

- 在手机上卡片占了屏幕的大部分，所以一次本想滚页面的滑动没有别处可落。
- `snap-mandatory` 让列表停在手势结束的地方。
- 在*同一次*手势里，滚动不会传回给页面。iOS 只在下一次手势**开始**时才传递，而且前提是内层滚动区已经到底，所以第一次滑动就白费了。
- 在手机上，页面本身在 vitre 的容器里滚动（`#vitre-scroll`，见 `packages/vitre`），所以这是容器套容器。

从写作列表中部做同样的 250px 拖动测得（无头 Chromium，iPhone 15 Pro 视口，`Input.dispatchTouchEvent`）：

| | 页面移动 | 列表移动 |
|---|---|---|
| 在触摸下强制开启视窗（一个 120px 的视窗，用于测试） | **0px** | 88px（它的全部可滚距离；拖动剩下的部分丢掉了） |
| 堆叠，即现在上线的样子 | **235px** | 0px |

第一次测量是在项目卡片还有 256px 视窗的时候，在 iPhone 13 视口上结果形状一样：页面 0px，列表 204px。

**在 CSS 里问，而不是在 JS 里检测。** 调参修不好这个问题。`overscroll-behavior` 没法把进行中的手势交还回去，也没有哪个 `touch-action` 能让滚动区不滚动。这个手势只能去掉，没法仲裁。竖轴已经被占了，把它挪到别处去都只能是生造。`pointer: fine` 是一个诚实的问题（“主要的输入工具是光标吗？”），而在 CSS 里问意味着同一份 markup 两边都能用：没有 hook，没有水合分支，什么都不用测量，在服务端就是对的。小组件代码里没有任何地方为此读取 `pointerType`。

**按行数，而不是固定高度。** 两者都能消除冲突；只有一个的尺寸是可预测的。固定高度会裁掉它下面的东西，于是卡片能说多少取决于标题碰巧有多长。一个中文标题和一个英文标题可能差出整整一行。按行数则反过来：行数固定，高度随之而定，这就是为什么两张卡片在两种语言下、在桌面和手机上都是 238px。代价是标题没有第二行：写作的行会截断，就像项目名一直以来那样。完整标题点一下就能看到。

**不溢出就没有视窗。** `PORT_ROWS` 是 `max-h-64`（256px）扣掉渐隐的 28px 之后最多能放下的行数：每行 36px，共六行。行数不超过它时，写作卡片不传视窗，因为一个不可能溢出的列表，不应该在最后一行下面为一个永远不会出现的渐隐预留空间。

**堆叠以 `pb-3` 结尾，而不是卡片的 `pb-5`，** 因为每行自带 `py-2`：12 + 8 让最后一行离底边 20px，正好是 header 的 `pt-5` 让标题离顶边的距离。

## 可以自由选择的

- **挑选还是封顶。** 有天然分组的小组件（项目、演讲）显示这个分组；没有的（写作）用 `pointer-coarse:hidden` 按数量封顶。两种都行；在随便哪个高度切断的列表不行。
- **数字。** `TOUCH_ROWS`、`PORT_ROWS` 和 `LATEST_COUNT` 是写作卡片的口味。`PORT_ROWS` 由视窗高度推出；其他的不由任何东西推出。
- **固定还是增长的视窗。** `port="pointer-fine:h-64"` 固定高度；`pointer-fine:max-h-64`（写作用的这个）只在列表超出时才显示视窗。
- **点击去哪里。** 卡片的表面打开完整列表（`/writing`、`/works?type=project`）；项目的一行打开它那条 commit 的永久链接（`/works#<hash>`，见 `components/log/use-commit-anchor.ts`）。跳转会带上卡片自己的筛选条件，因为一张讲项目的卡片把你丢进一列二十五条 commit 里，等于让你把它已经做过的筛选再做一遍。

## 给小组件加一个列表

1. 用 `WidgetScrollBody` 渲染，永远不要用带 `overflow-y-auto` 的 `div`：一个无条件的滚动区会在手机上困住页面的滑动。
2. 给行加 `snap-start` 和悬停出血 `-mx-2 px-2`，并让每一行都是它自己的动作（链接或按钮），这样按住它仍然归这一行。
3. 决定手指看到什么：一个挑选过的分组，或者一个数量，超出的行加 `pointer-coarse:hidden`。保持每行一行。
4. 只有列表可能超出视窗时才传 `port`，并且像写作那样根据行数来算。
5. 检查：在手机视口上，从列表中部拖动，读页面滚动区和列表的 `scrollTop`。只有页面应该动。在无头 Chromium 里，用 CDP 的 `Input.dispatchTouchEvent` 驱动拖动；`Input.synthesizeScrollGesture` 在这里没能让页面移动。

## 背景：各平台怎么做

- **iOS**：WidgetKit 小组件不滚动，哪个方向都不。[Widgets][hig-widgets] 页面里根本没有出现 “scroll” 这个词；交互就是点击加上按钮和开关，*“当人们在小组件上不是按钮或开关的区域进行交互时，这次交互会打开你的 app。”* 内容放不下，答案是更大的小组件尺寸，或者 app 本身。
- **Android**：正好相反。集合类小组件*可以*竖向滚动，而且“*小组件唯一可用的手势是触摸和竖向滑动*”，因为主屏是**横向**翻页的，把竖轴空了出来。HarmonyOS 也是同样的形状（`List` 和 `Swiper` 在 ArkTS 卡片里都能用，主屏横向翻页）。
- 所以这三者都负担得起它们允许的东西，因为**它们的宿主界面从不竖向滚动**。网页是唯一会竖向滚动的宿主。在竖向滚动的页面里放竖向列表没有平台先例，这也是为什么 HIG 在 [Scroll views][hig-scroll] 里说：*“**避免把一个滚动视图放进另一个同方向的滚动视图里。** …… 不过，把横向滚动视图放进竖向滚动视图（或者反过来）是可以的。”*

于是触摸落在了 Apple 已经在的位置：卡片是固定几行的预览，点击打开真正的列表。

## 试过并放弃的

这些都能用。它们都把滑动交给了页面。之所以放弃，是因为每一个都为此付出了按行数方案没有的代价，也因为六种可切换的行为不是设计。

| 放弃的 | 原因 |
|---|---|
| **expand**：一个 `more` 控件让卡片就地展开 | 卡片改变自己的高度是 *Live Activity* 的行为，不是小组件的；而且在 CSS 多列网格里，它会让旁边的列重新平衡。 |
| **page**：横向滑动 / 圆点翻页这一列 | 交叉轴翻页是 HIG 认可的嵌套，也有真实先例（Android `StackView`、HarmonyOS `Swiper`），但一个让一列内容向下移动的横向手势，恰恰是 [Gestures][hig-gestures] 页面警告的那种“*用独特的手势执行标准操作*”，而圆点是它唯一的提示。 |
| **drift**：这一列随页面自身的滚动前进 | 讨喜，但没法控制：你停不到某一行上，而且滚一样东西有两样东西在动。 |
| **rail**：沿尾边的一条滚动轨 | 最强的亚军：一个标准操作（iOS 可以从滚动指示器拖动定位；visionOS 把在它上面的拖动变成 jog bar），完整列表，固定占地。代价是每行标题少了 32px，而且卡片上多了第二样会响应按压的东西。 |

它们的共同点是：都在花交互预算，去保住一个卡片本来就不该装的列表。卡片是预览；页面才是列表。

[hig-widgets]: https://developer.apple.com/design/human-interface-guidelines/widgets
[hig-scroll]: https://developer.apple.com/design/human-interface-guidelines/scroll-views
[hig-gestures]: https://developer.apple.com/design/human-interface-guidelines/gestures
