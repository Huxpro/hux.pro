# Reactive Intents：事件、意图树与两条路

> reintent（来自 airtalk#818，`packages/reintent`）不只是"按屏幕自适应"的工具。把它当成一种 **Reactive Intents-Oriented Programming**：意图树是唯一的 state，任何事件（拖拽、resize、一句 prompt、一次编辑）都交给一个回调，回调要么直接 resolve 成一个 action（Flux），要么交给模型 infer（ReAct 式的 effect），结果走同一个 reducer，再单向地算出每个上下文里的样子。
>
> 原型：`/lab/intent`（`app/lab/intent/`），对象是 `/dream/forget`。这份文档是 brainstorm 和原型的结论。

## 一张图

```
           ┌──────────────── 意图树 + 决定 + 信念 = state（唯一的 source of truth）───────────────┐
           │                                                                                    │
           ▼                                                                                    │
  计算层（reintent）── 每个上下文一份 Assignment ── compile ──▶ props ──▶ 视图（stage，含临时状态）│
                                                                              │ 事件：拖拽 / prompt / 编辑 / resize
                                                                              ▼
                                                                        回调 handle(event)
                                                                              │
                                              ① 预设识别器认得 ── action ─────┤
                                              ② 认不得 ── 模型 infer（异步）── admit 校验 ──┴─▶ dispatch(action)
                                                                                                │
                                                     reduce(state, action) ◀────────────────────┘
```

| 这里 | 对应 | 原型里 |
| --- | --- | --- |
| state | Redux store / React state | `tree`（意图树，数据）、`store`（人的决定、偏好）、`beliefs`（模型的分布，缓存）|
| action | Flux action | `decide` / `forget` / `believe` / `add` / `replace`（`model.ts` 的 `Action`）|
| reducer | reducer | `lab.dispatch(action)` |
| selector / computed | `useMemo` / signals | `view(key, screen)`、`params(screen)`：reintent 的 computed，值不变就不往下传 |
| event callback | `onClick` | `handle(event)`：同一个回调接住拖拽、prompt、切换、回答 |
| effect | `useEffect` / thunk / ReAct 的 act | `infer(observation)`：模型观察（树、决定、事件、上下文）并写出一个 action |
| context | Context / 媒体查询 | 屏幕（`tallness` 是交叉的索引），以及之前的 prompts |
| view | 组件 | 真正的 `/dream/forget` 场景，按每块屏幕的尺寸装进盒子里跑 |

## 三条规则，原型里才想清楚的

1. **模型写的是数据，不是代码。** ② 的产出只能是那五种 action 之一；新意图是一个节点：闭集的 kinds，每个 kind 是一组 props 补丁。`admit` 拿舞台上实际有的旋钮（值、单位、范围）校验：不存在的实体、不存在的旋钮、越界的数、只有一个 kind、`resolve` 写错，都放不进来（`intent-lab.test.mjs` 里有一条把这五种错一次列全）。
2. **人的决定永远压过模型。** 一句"更伤感"不是一个选择，是一种情绪：它变成 `believe`，改的是模型对好几个意图的分布；人已经决定过的那个（尘"升起"）原样不动，模型因此变得够确定的那个（"按住时"0.8）从此不再问。这就是 reintent 的优先级（人 > 偏好 > 足够确定的模型 > 代码）在"reprompt"上的含义。
3. **每个新意图的第一个 kind 是"原样"，而且每个 kind 都写同一组旋钮。** 缺的由 `admit` 用场景写的值补齐。所以切回去永远等于撤销，模型加的意图和预设的意图一样可以切换、可以忘掉。

还有一条反过来的：**② 可以回答 "none"，而且应该说缺什么。** 把一个画面拖到另一个画面上（重排），没有任何旋钮能表达顺序，模型（和替身）都回答 none，并指出"这需要重新生成 kind，而不是做一个选择"。这正好划出了第三层：意图树之外，是改代码（重生成一个 kind）。

## User cases

图例：**①** 预设识别器就能 resolve，不调模型；**②** 要模型 infer；**✓** 原型里已经做了。"存什么"一栏只列会被持久化的东西（人的决定、模型写的意图），其他都是算出来的。

### A. 直接操作：手势就是事件

| # | 用户做了什么 | 事件 → 意图 | 路 | 存什么 |
| --- | --- | --- | --- | --- |
| A1 ✓ | 把一个画面拖出窗外 | drag(moment#i → 窗外) → `keep|moments#i = stays` | ① | 一条决定 |
| A2 ✓ | 把留住的画面拖回窗里 | drag(aside → 窗内) → `keep = goes`：它在原地化成尘 | ① | 一条决定 |
| A3 ✓ | 把窗横着拖 / 竖着拖 | drag(window, 水平) → `axis = across`，**在这块屏幕的形状上**挪交叉点 | ① | `{base, below, at}` |
| A4 ✓ | 把尘往下拉 | drag(dust, ↓) → `dust = settles` | ① | 一条决定 |
| A5 ✓ | 把一个画面拖到另一个画面上（想重排） | 没有预设，没有旋钮 → 模型回答 none，指出要重生成 kind | ② | 无 |
| A6 | 双指捏窗口 | pinch(window) → 一个新意图"窗多宽"，或已有的 `held`（窗里放几张） | ①/② | |
| A7 | 长按一个实体 | 列出它所有意图的 alternatives（reintent 的 `alternatives`：只翻一个，其余冻结）作为一键切换 | ① | 无 |
| A8 | 在空白处画一个圈 | 不认识的手势：模型把轨迹和树一起看，可能推断成"把尘聚到这里"（新意图 + 坐标作为补丁） | ② | 模型写的意图 |
| A9 | 编辑器里把元素拖到角落停靠（演说原型的"dock 到哪"） | drag → `anchor = pin` 或 `flow`；落点就是 kind | ① | 一条决定 |

### B. Reprompt 一个实体：选中它，说一句

| # | 说了什么 | 发生什么 | 路 |
| --- | --- | --- | --- |
| B1 ✓ | 选尘，说"落下" / "settles" | 正好是一个 kind 的名字：识别器直接 resolve，不调模型 | ① |
| B2 ✓ | 选画面，说"慢一些" | 没有意图管节奏 → 模型 `add` 一个 `pace|moments`（原样 / 慢一些，补丁是 `gap`），并决定"慢一些" | ② |
| B3 ✓ | 说"像雪一样落下" | 不是 kind 的名字，但等于一个已有的 kind → 模型 `decide dust=settles` | ② |
| B4 ✓ | 对整个梦说"更伤感" | 情绪 → `believe`：好几个意图的分布一起动，人的决定不动 | ② |
| B5 | 选一个画面，说"换成我外婆" | 内容的 reprompt：意图是"这个画面是谁"（闭集外），模型重画 sprite。这是 reintent 的 **lazy effect**：写出来的画按它写时的意图（`under`）缓存，意图变了就藏起来、改回来就回来 | ② + 缓存 |
| B6 | "这句结尾太直白了" | 结尾的字是一个 `words` 意图：原样 / 模型改写的几版；模型写的每一版记下 `under`；切回原样就是撤销 | ② |
| B7 | 对窗说"别那么规整" | 没有旋钮能表达 → none，并给出它需要的 kind 改动（例如 `jitter` 参数），交给第三层 | ② |
| B8 | 同一个 prompt 说两次 | 第二次命中 ② 的缓存（按树的哈希 + 事件签名）：**被模型推断过的映射可以升格成预设**，像 JIT 一样从 ② 变成 ① | ①（缓存后）|

### C. 用户编辑：手改的东西也是意图

| # | 编辑 | 建模 | 路 |
| --- | --- | --- | --- |
| C1 | 改结尾的那两句字 | 一个 `words` 意图多了一个 kind"你的"，并决定它；原文作为另一个 kind 留着，一键切回 | ① |
| C2 | 在检查器里把滑杆拖到某个预设 kind 的值附近 | 吸附：识别成那个 kind（`decide`），而不是一个裸数 | ① |
| C3 | 把滑杆拖到任何 kind 都不像的地方 | 新的"自定义"kind（数据），或者交给模型找一个名字和它的对立面 | ①/② |
| C4 | 改了中文版的字 | 英文版是模型写的、`under` 中文那一版的 lazy effect；中文一改它就过期，后台重写，写好之前显示旧的 | ② + 缓存 |
| C5 | 撤销 | 不是"反向操作"，是恢复 state 快照（树 + 决定 + 信念）；模型写的意图也一起回去 | ① |
| C6 | 两个人同时改 | 决定按 key 合并；同一个 key 冲突时保留两个人的，作为 alternatives 让人选 | ① |

### D. 上下文不只是屏幕

| # | 上下文 | 意图 | 怎么变 |
| --- | --- | --- | --- |
| D1 ✓ | 屏幕形状 | `axis`：按 `tallness` 交叉 | 拖窗或切换，交叉点挪到这块屏幕 |
| D2 | 用户说"我只有几秒钟" | `pace` 按"可用时间"索引：短于某个值就快 | prompt 先变成上下文，不是决定；之后所有按时间索引的意图都跟着 |
| D3 | 系统的"减少动态效果" | `motion`：完整 / 安静，按偏好 | 一个偏好，所有场景都用 |
| D4 | 夜里 | `glow`：按一天中的时间交叉（暗一点） | 不用人做任何事，代码按上下文算 |
| D5 | 观众（一个人 / 投到大屏上） | `scale`、`words` 的长短 | 编辑器里预览两种上下文 |
| D6 | 之前说过的话 | 模型 infer 时看到最近几句 prompt（原型已经传了） | "再慢一点"能接着上一句 |

> **resize 是上下文事件，不是意图事件。** 窗口变了，state 不变，只是同一份意图在新的上下文里重新算一次。只有当用户**在某个上下文里做了决定**（在横屏上把窗竖起来），才产生 action，而且这个 action 带着上下文（交叉点挪到这里）。

### E. 偏好：一次说清，到处适用

| # | 说了什么 | 建模 |
| --- | --- | --- |
| E1 | "图片永远保持原比例"（演说作者原话） | `prefer(fit, keep)`：这个类型的所有主语 |
| E2 | "留住所有和你有关的画面" | `keep` 类型的偏好；单个画面上的决定仍然压过它 |
| E3 | "所有梦都慢一点" | 跨场景的 `pace` 偏好：三个梦各有一个主语 |

### F. hux.pro 的其他系统，同一套东西

| # | 系统 | 事件 | 意图 |
| --- | --- | --- | --- |
| F1 | 主屏网格 | 拖一个 widget 到 Dock / 网格里 | 停靠位置是 kind；拖不到任何预设位置 → 模型重排整屏（`replace`）|
| F2 | 顶部带（Band Lab） | 横滑、点一个计数球 | 溢出策略（pill / ball / tray）就是闭集 |
| F3 | Ask（⌘K） | "说短一点""正式一点" | 回答的 tone / length 意图（reintent 测试里的"起草邮件回复"宿主）；reprompt 一条回答 = 改它的意图，不是重新生成 |
| F4 | Works 时间线 | 编辑一条日志的展示方式 | 封面 / 行内 / 折叠，按视口交叉 |
| F5 | 壁纸 | "晚上暗一点" | 按时间索引的意图 + 偏好 |
| F6 | Glow | 对着麦克风说话 | 上下文（音量）驱动的意图：光的强弱是 kind，不是一个裸数 |

### G. 回到 airtalk 的演说编辑器

| # | 事件 | 意图 |
| --- | --- | --- |
| G1 | 在手机预览上把三张卡片拖成一列 | `arrange = cols1`，交叉点挪到手机的形状（PR #818 已有）|
| G2 | 对一页说"这页太挤了" | 模型 `believe`：`paging` 偏向分屏、`fit` 偏向裁图；人的决定不动 |
| G3 | 对一张图说"别裁" | 识别器：正好是 `fit=keep`；作者级偏好就在这里问出来 |
| G4 | 把二维码拖到右下角 | `anchor = pin` |
| G5 | 主舞台改了一个字 | 不是意图事件：是 world 变了（`invalidate`），模型写过的布局按 `under` 校验，过期就后台重写 |

## 原型里做了什么

- `tree.ts`：意图树是纯数据（`IntentNode`：`type`、`of`、`kinds` 各带补丁、`prior`、`resolve`、`index`）；`typesOf` 把树变成 reintent 的类型；`compile` 合并补丁（列表取并集：所有留住的画面）；`admit` 校验并补齐模型写的节点。
- `forget.ts`：预设树（`axis`、`holding`、`letgo`、`dust`，以及五个 `keep|moments#i`）。
- `model.ts`：state 和唯一的 `dispatch`；reintent 在树或信念变化时重建，决定一直在 store 里。
- `events.ts`：`recognize`（①：拖拽和 prompt 的预设）、`accept`（②：模型的回答变成 action，或者说明为什么放不进来）、`infer`（调 `/api/intent`；没有模型时用一个标明是替身的规则集）。
- `app/api/intent/route.ts`：和 Ask 一样的模型选择（Vercel 上走 gateway）；只返回一个 JSON action。
- `/dream/forget` 的画面可以被留住（`kept`）：到了窗沿不化成尘，原样放到窗旁；之后再放手，就在原地化成尘。
- 验证：`scripts/tests/intent-lab.test.mjs` 9 条（① 的四种拖拽和 prompt、② 的新意图、坏意图、情绪不压过人、none、按屏幕的增量重算）；浏览器里拖、说、看日志。

## 还没回答的

- **② 升格成 ①。** 同一个事件签名被模型推断成同一个 action 几次之后，能不能自动写成识别器？需要一个"事件签名"的定义（实体、方向、落点所在的区域），以及让人确认的地方。
- **模型的 `replace` 怎么和人的决定合并。** 原型里只做了 `add`；整棵树换掉时，决定按 key 保留，但 key 被重命名的情况还没处理（sem 的 `renamedFrom` 可以借过来）。
- **lazy effect 落到场景上。** B5、B6、C4 都需要"模型写的世界按 `under` 缓存"，reintent 的 `effect()` 已经有了，场景这边还没有一个能放 sprite 和文字的槽。
- **代价。** ① 是亚毫秒；② 是一次模型调用（原型的替身约 0.5 s，真模型更久）。多少事件该进 ②，取决于预设覆盖了多少。
