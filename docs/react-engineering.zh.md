---
origin: "AI-translated from the original"
---

# React 约定

这个代码库在 React 自身规则之外给自己定下的规矩：开了哪些 lint 规则、各自认可的绕行方式，只有浏览器知道的值怎样读取才不会造成 hydration 不一致，持久化的偏好放在哪里，服务端状态怎样缓存，以及 provider 的嵌套顺序。

## 做好了是什么样

- `pnpm lint` 在你改过的文件里没有报出新问题。
- 服务端 HTML 和客户端第一次渲染一致：只有浏览器知道的东西（localStorage、`matchMedia`、平台、时间）在 hydration 之后才出现，绝不在 hydration 当中出现。
- 访客的一项偏好就是一行 `makeStore`，用它的 `use` hook 读取，不需要 effect，也不需要 provider。
- 读取另一个 provider 的 provider，在 `shared/providers.tsx` 里嵌套在那个 provider 之内。

## React Compiler 没有开启，它的 lint 规则开着

`next.config.ts` 里没有 `reactCompiler`，也没有安装 `babel-plugin-react-compiler`（它只作为 Next 的可选 peer 依赖出现在 `pnpm-lock.yaml` 里）。组件不会被自动 memo 化，所以在引用相等性会被观察到的地方，`useMemo` / `useCallback` 依然有用：

- context 的 value（各个 provider 都用 `useMemo` 包住自己的 value；ambient provider 拆成五个 context：location / weather / time / solar theme / wallpaper，这样消费者只会因为它读取的那部分而重新渲染）；
- 被某个库按引用比较的 prop（`systems/windows/components/window-sheet.tsx` 里的 `detents`：Base UI 按引用重新读取这个列表，拖动途中传入一个新数组会让它重新计算）。

开着的是：`eslint-config-next` 16 加载了 `eslint-plugin-react-hooks` 7，它的 recommended 预设包含了 compiler 的诊断。除 `exhaustive-deps`、`incompatible-library` 和 `unsupported-syntax`（警告）之外，全部是错误。实时的规则列表可以用 `npx eslint --print-config shared/providers.tsx` 查看。

| 规则 | 拒绝什么 | 认可的绕行方式 |
|------|---------|-------------------|
| `set-state-in-effect` | 在 effect 主体里同步调用 `setState` | [只有浏览器知道的值](#只有浏览器知道的值)中的某种写法；或者在渲染中调整 state（见下文） |
| `refs` | 在渲染中读写 `ref.current`，包括通过某个 hook 返回的、持有 ref 的对象 | 在没有依赖项的 effect 里赋值（`useEffect(() => { ref.current = value; })`），或者用 `useEffectEvent` |
| `purity` | 在渲染中调用 `Date.now()`、`Math.random()` 之类 | 在 effect 或事件处理函数里读取 |
| `set-state-in-render` | 在渲染中无条件地 `setState` | 加上条件：`if (prev !== prop) { setPrev(prop); … }` |

它们怎样报错，这一点在阅读或屏蔽它们时很重要：

- `set-state-in-effect` 每个 effect 只报一次，报在第一个同步的 `setState` 上。disable 注释写在这个调用的前一行，并覆盖这个 effect 的其余部分（`services/glass.tsx` 用一条注释设置了两个 state）。
- compiler 规则在一个组件里遇到第一个错误就停下。修好一个，下一个可能才冒出来。
- disable 注释要写明它屏蔽的规则。写在 effect 依赖数组上的 `// eslint-disable-line react-hooks/exhaustive-deps` 并不能屏蔽其中的 `set-state-in-effect`（`components/home/prompt-widget.tsx`）。
- 不要用 `setTimeout(…, 0)` 绕开规则。它把更新推迟到下一个任务，还多出一个时序上的边界情况。

CI 不跑 lint（`.github/workflows/ci.yml`），所以 main 上可能带着错误；在认定是你造成的之前，先和 main 对比。

### 在渲染中调整 state

当 state 跟随某个 prop 变化时（sheet 关闭时关掉它的菜单；步骤切换时让旧步骤开始离场），在带来这次变化的那次渲染里设置它，而不是在晚一帧的 effect 里。这是 React 文档里的写法，用在 `systems/windows/components/window-sheet.tsx`、`systems/surface/morph.tsx` 和 `systems/dock/components/dock-notice.tsx`：

```tsx
const [wasOpen, setWasOpen] = useState(open);
if (wasOpen !== open) {
  setWasOpen(open);
  if (!open) setMenuOpen(false);
}
```

## 只有浏览器知道的值

页面是静态预渲染的，所以服务端渲染时没有 `window`。只有浏览器知道的值不能改变客户端的第一次渲染，否则 hydration 就会不一致。三种写法，按优先顺序：

1. **`useSyncExternalStore`**，以服务端快照作为后备值。React 在 hydration 时渲染后备值，紧接着渲染真实值，不需要 effect。`makeStore`（见下文）就是这种写法，用于一个持久化的字符串；`useMounted()`（`components/ui/use-mounted.ts`）也是这种写法，用于“是否已经 hydrate”，取代在 effect 里设置的 `mounted` state。
2. **先用默认 state，再用 effect** 读取浏览器并设置它，加上认可的注释，写明原因：

   ```tsx
   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
     setMaterialState(readStored());
   }, []);
   ```

   目前在用的原因：`hydration-safe: localStorage read`、`hydration-safe: platform read`、`browser-only WebGL probe after mount`、`sync: clear a stale readout`。要写出原因；光秃秃的 disable 对下一个读代码的人什么也没说。
3. **绝不使用读取 `localStorage` 或 `window` 的 `useState` 惰性初始化函数。** 它在 hydration 期间于客户端运行，返回服务端没有返回的东西，而 lint 抓不到它。

静态渲染路由上的 `useSearchParams()` 上方需要一个 `<Suspense>`（没有它构建会失败），而这个边界之下的一切都在客户端渲染。每个读取它的视图都在自己的路由处被包住，边界里没有别的东西：`app/works/layout.tsx`、`app/prompt/page.tsx`、`app/writing/page.tsx`。

## 持久化的偏好：`makeStore`

`components/post/persisted-setting.ts` 里的 `makeStore` 是一个 localStorage 值、一个变更事件和一个 `useSyncExternalStore` hook：

```ts
const store = makeStore<RulerSide>(
  "hux_ruler_side",   // localStorage key
  "hux:ruler-side",   // window event that set() dispatches
  "right",            // server snapshot, and the value when storage fails
  (raw) => (raw === "left" ? "left" : "right") // parse: any string or null to a valid T
);
export const useRulerSide = store.use; // also store.get, store.set
```

- **值是字符串**（`T extends string`）。`get` 在每次渲染和每次变更时都会运行；字符串和自身相等，而每次重新解析出的对象并不相等，`useSyncExternalStore` 会因此陷入循环。
- **`parse` 就是校验器。** 它把 `null` 以及任何过期或外来的值映射为一个合法值。
- 它也监听 `storage` 事件，所以另一个标签页里的修改也会同步过来。
- 不需要 provider：在用到的地方直接 import 这个 store。多个 store 可以共用一个事件（`systems/ask/lib/prefs.ts` 里的 `hux-ask-prefs`）。

在用的地方：阅读设置（`components/post/reading-settings.ts`）、标尺位置（`ruler-settings.ts`）、作品书架（`components/log/project-shelf.tsx`）、Ask 的模型和推理强度（`systems/ask/lib/prefs.ts`）、语音模型和视觉效果（`systems/voice/prefs.ts`）。有结构的设置不用 `makeStore`：ambient 设置是一个 JSON 对象 `hux_ambient_settings`（`systems/ambient/lib/settings.ts`），由它的 provider 读取。

## 服务端状态：TanStack Query

只有 ambient 系统的 location 和 weather 用到它（`systems/ambient/lib/queries.ts`：`useLocationQuery`、`useWeatherQuery`）。client 和 persister 在 `lib/query.ts`：

- 默认值：`staleTime` 5 分钟、`gcTime` 24 小时、`retry: 1`、`refetchOnWindowFocus: false`（这两个 ambient 查询又把聚焦和重新联网时的重新请求打开了）；
- 整个缓存以 `hux_query_cache` 为键持久化到 localStorage（`shared/providers.tsx` 里的 `PersistQueryClientProvider`），所以回访的访客在发出任何请求之前就能看到上一次的天气；
- 键来自 `queryKeys`。**当持久化数据的结构变化时，要升级它键里的版本段**（`["weather", "v4", lat, lon]`），否则旧条目会被当作完整数据从存储里取出来；
- 两个查询在新键加载期间都保留上一次的结果（`placeholderData: (previousData) => previousData`）。

新鲜度、轮询和权限见 [Ambient System，Freshness](./system-ambient.md#freshness)。

## Provider 树

`shared/providers.tsx` 就是整棵树；`app/layout.tsx` 把它挂在页面以及所有应用级界面（Dock、sheet、`CommandPalette`……）的外层。

![shared/providers.tsx 里的嵌套关系，从最外层开始，标出每个 provider 负责什么、读取外层哪个 provider。](/img/docs/react-engineering/providers.svg)

方框的嵌套方式与 JSX 一致，最外层在前。蓝色的 `↑` 线说明了顺序为什么是这样：每一条都是某个 provider 对其上层某个 provider 调用的 hook。`GlowPaletteBridge` 不是包裹层，而是 `AmbientProvider` 的一个子组件，什么也不渲染。

- **读取另一个 provider 的 provider，嵌套在那个 provider 之内。** 把它挪到它所读取的 provider 之上会抛错（`use… must be used within …`），如果通过 `useOptional…` hook 读取，则会悄无声息地拿到 `undefined`。
- **当一个 provider 需要另一个 provider 的值作为 prop 时**，由 `shared/providers.tsx` 里的一个小包裹组件读取并传下去：`AmbientWrapper`（把 `useTheme()` 传给 `AmbientProvider theme`）和 `DevtoolWrapper`（把 `useCommand()` 传给 `DevtoolProvider isCommandOpen closeCommand`）。
- **只有某个子树需要其状态的 provider，就挂在那个子树上。** `DockProvider` 由 `<Dock>` 挂载（`systems/dock/components/dock.tsx`），而不是在这里。
- 没有 UI 的简单全局状态放在 `services/`（从 `services/index.ts` 导出）；有 UI、状态和逻辑的功能是 `systems/` 下的一个文件夹。见 [Architecture](./architecture.md)。
