---
origin: "AI-translated from the original"
---

# Ambient 系统

Ambient 系统让界面回应真实世界：访客在哪里、那里的天气如何、现在是一天中的什么时候。它负责页面背景（**壁纸**），壁纸的核心是一片实时天空，跟随真实的天气和太阳、月亮的真实位置；它在问候语里说出当前时段，在 Dock 里提醒日出和日落；它还让主题跟着太阳变化。代码：`systems/ambient/`。

这一页是入口：模型、数据流、时段、缓存。其余内容分在四个专题页面：

| 页面 | 内容 |
|---|---|
| [The Sky](./ambient-sky.md) | 天气壁纸是怎么画的：两套引擎、太阳和月亮、风和重力、陀螺仪倾斜、主题的基调和暮光外观 |
| [Ambient easter eggs](./ambient-easter-eggs.md) | 闪电、流星、阵风、擦雾、天空之窗及其下拉手势 |
| [Wallpapers](./wallpapers.md) | 天气样式和图片、浅色/深色对、位置和边框、图库及其文件、选择器（skill：`.claude/skills/wallpapers`） |
| [Legibility](./system-legibility.md) | 壁纸对其上文字和玻璃的影响 |

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-ambient/home-sunset.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="旧金山 18:40 的手机首页：从蓝灰到桃色的黄昏渐变，问候语 'Sun Is Setting'，顶部的 Dock 胶囊显示 18:42 和一个日落图标。" />
  <img src="/img/docs/system-ambient/home-night.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一屏幕在 22:30：深藏青色的星空，问候语 'Good Night'，页面处于深色主题。" />
</div>

同一个晴天的两个时段（旧金山，日出 07:11，日落 18:42；无头浏览器手机尺寸，天气预报为模拟数据）。18:40 的时段是 `sunset`：问候语这样说，Dock 显示日落时间，天空呈现地平线的颜色，因为太阳就在那里，而不是因为某个时段选了一套配色。到 22:30 时段变成 `night`，太阳已经沉得很低，星星出来了，在 Follow the Sun 下主题也已变暗。

- 加载时不向访客索要任何东西。位置先根据网络猜测，标明是猜测，只有在一次说明了原因的点击之后才会改进。
- 天空跟着分钟走；文字和 Dock 跟着时段走；主题跟着太阳本身越过地平线的时刻走。三个时钟，从不打架。
- 重新加载会立即显示上一次的天气（缓存），而过时的结果会在世界发生变化时刷新（标签页回到前台、网络恢复、预报的下一个时间间隔到来、午夜）。

## 原理

![位置（IP，或在允许时取得的精确定位）把 lat 和 lon 交给 Open-Meteo 天气预报和日月星历；预报里的日出日落时间和时钟得出时段；天气、太阳和月亮得出 WeatherScene；场景驱动 Sky 的 uniforms、Gradient 和 Classic，以及在 html 上设置 CSS 变量的可读性 profile。](/img/docs/system-ambient/data-flow.svg)

数据流，用的是真实的名字。从上往下读：

1. **位置**（`useLocationQuery`，`lib/queries.ts` + `lib/location.ts`）。一次 IP 查询（先 ipapi.co，再 ipwho.is）；或者在 Accurate 模式下、且仅当 `canTakeFix` 允许时，取一次粗略的 `navigator.geolocation` 定位，通过 Nominatim 反向地理编码。输出一个 `ResolvedLocation`，包含 `lat`、`lon`、城市和 `source`（`"ip"` 或 `"geolocation"`）。
2. **天气**（`useWeatherQuery` → `fetchCurrentWeather`，`lib/weather.ts`）。Open-Meteo 的 `current` 数据块加上 `daily=sunrise,sunset`，规整成一个 `NormalizedWeather`（[见下文](#天气模型)）。
3. **时钟**（`useAmbientTime().nowMs`）：墙上时钟，在每个整分钟边界、以及 `visibilitychange` / `pageshow` 时重新读取；或者是 devtool 的时间旅行。
4. **太阳和月亮**（`lib/solar.ts`）：`lat, lon` 处在 `nowMs` 时刻的高度角和方位角，以及月亮的位置和月相。
5. **时段**（`deriveAmbientPhase`，`lib/phase.ts`）：拿 `nowMs` 和预报里的日出日落比较。一个标签，由问候语、Dock 和 Classic 配色读取（[见下文](#时段)）。
6. **场景**（`deriveWeatherScene`，`lib/scene.ts`）：天气 × 太阳 × 月亮 × `wallpaperTheme` → 一个 `WeatherScene`（[见下文](#场景)）。
7. **绘制**：Sky 的 `WallpaperRenderer.setScene()` 把场景平滑过渡成 shader uniforms；`sceneToCssGradient` 和 `getClassicGradient(scene, phase)` 推出 CSS 图层。见 [The Sky](./ambient-sky.md) 和 [Wallpapers](./wallpapers.md)。
8. **可读性**：正在绘制的东西的 profile（Sky 和 Gradient 用 `profileFromScene`；Classic 和图片用测量好的 `wallpaper-profiles.json`）经过 `resolveLegibility`，再由 `applyLegibility` 在 `<html>` 上设置文字和玻璃读取的 CSS 变量。见 [Legibility](./system-legibility.md)。

此外，太阳给主题的答案（`solarThemeAt`）交给 `<SolarThemeSync />` 和主题服务（[见下文](#主题跟随太阳)）。

一个 provider，`AmbientProvider`（`provider.tsx`），持有全部这些，并暴露五个 hook：`useLocation`、`useWeather`、`useAmbientTime`、`useSolarTheme`、`useWallpaper`（[参考](#参考)）。

### 时段

```typescript
type AmbientPhase = "sunrise" | "morning" | "afternoon" | "evening" | "sunset" | "night";
```

![旧金山 10 月 7 日的一条日程条：06:26 之前是 night，06:26–07:56 是 sunrise，到 12:00 是 morning，到 17:57 是 afternoon，17:57–19:27 是 sunset，到 22:27 是 evening，之后是 night。上方是 Dock 活动，覆盖提前的 90 分钟加上每个窗口。下方是 Follow the Sun 主题，恰好在 07:11 和 18:42 切换。](/img/docs/system-ambient/phase-timeline.svg)

一天中的六个时段，以及由同样的日出日落事件计时的两件事：上方是 Dock 的活动，下方是 Follow the Sun 下的主题。注意各自在哪里变化：时段在窗口的边缘变化，主题在事件本身、也就是窗口中间变化。

边界（`deriveAmbientPhase`，`lib/phase.ts`），按生效时钟计算：

| 时段 | 从 | 到 |
|---|---|---|
| `sunrise` | 日出 − 45 分钟 | 日出 + 45 分钟 |
| `morning` | 日出 + 45 分钟 | 当地 12:00 |
| `afternoon` | 12:00 | 日落 − 45 分钟 |
| `sunset` | 日落 − 45 分钟 | 日落 + 45 分钟 |
| `evening` | 日落 + 45 分钟 | 3 小时之后 |
| `night` | evening 结束 | 下一个日出窗口开始 |

窗口长度是 `lib/sun.ts` 里的 `DEFAULT_SUN_EVENT_WINDOW_MINUTES`（45）；两个窗口重叠时（高纬度地区），离得近的事件胜出。在预报带来日出日落时间之前，没有事件时段，只有固定的钟点（`getTimeOfDay()`，`lib/greeting.ts`）：morning 5–12，afternoon 12–17，evening 17–21，其余是 night。没有时段覆盖：时段总是从 `nowMs` 推导出来，所以 devtool 通过移动时钟来改变它。

谁读取时段：`<AmbientGreeting />`（`getAmbientGreetingKeyFromPhase`）、`<AmbientPhaseActivity />`，以及 Classic 样式的配色和 profile。Sky 和 Gradient **不**读：它们按分钟跟随太阳的高度角。

### 时段通知

日出或日落即将到来的提醒，以 **Dock Live Activity** 的形式出现（`<AmbientPhaseActivity />`，挂载在根布局；见 [Dock](./system-dock.md)）：

- **胶囊**：一个日出日落图标和事件的确切时间（上面截图里的 `18:42`）。
- **面板**：展开为共享的 `<WeatherNow />` 主体，也就是首页天气小组件使用的那块读数。

它从窗口开始前 90 分钟（`lib/notification.ts` 中的 `DEFAULT_NOTIFICATION_LEAD_MINUTES`）显示到窗口结束，然后交给问候语。它读取生效时钟，所以要看到它，就把 devtool 的 Sky 时钟移到提前期之内（拖动播放头，或点击时间轴下方的 **Sunrise** / **Sunset**）。它只根据时钟渲染，所以在图片壁纸下也会显示。

### 天气模型

Open-Meteo 的 `current` 数据块被规整成一个粗略的天气状况，外加天空要渲染的那些测量值：

```typescript
type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";

type NormalizedWeather = {
  temperatureC: number;
  condition: WeatherCondition;      // normalizeWeatherCode(weather_code)
  isDay?: boolean;
  cloudCover?: number;              // 0..1, also cloudCoverLow / Mid / High
  visibilityM?: number;
  dewPointC?: number;
  capeJkg?: number;
  precipitationIntensity?: number;  // 0..1, from mm/h (or cm/h snow) + WMO code
  precipitationType?: "none" | "rain" | "snow";
  windSpeedKmh?: number;
  windGustsKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
  observedAtMs?: number;            // current.time; with intervalS, times the next poll
  // …
};
```

六种状况有意保持粗略（它们为图标和标签定下情绪基调）；更细的 WMO 区分则以测量值的形式保留下来，所以 40 % 的云量和 95 % 的阴天看起来不一样，毛毛雨不是倾盆大雨，风会把雨吹斜。

**测量值优先，profile 其次。** 每种状况在 `scene.ts` 里都有一份手调的 profile（`PROFILES`）。它是兜底：预报带来的每个测量值都会替换 profile 里对应的值；只有状况本身时（devtool、可读性图库、profiler），画出来的就正好是 profile。

| 场景值 | 来自预报 | 没有时 |
|---|---|---|
| 降水类型 | `rain + showers` 对比 `snowfall`（7 cm 雪 ≈ 10 mm 水），从 0.1 mm/h 起算；只有 *cloudy* 的天气代码会被测量值升级 | 状况 |
| 云量 | 测量的云量；只有在有东西落下时才设下限（0.4 + 0.45 × 强度）；雾保留其 profile 的下限 | profile |
| 云的密度 | 分层云量（低 0.95，中 0.7，高 0.3），加上降水和不稳定度：80 % 的卷云是一层薄纱，80 % 的层云是一个盖子 | profile |
| 云的暗度 | 低云和中云量、降水、不稳定度；雪天减半，雾天大多被抬亮 | profile + 降水 |
| 雾 | 能见度按对数刻度（10 km → 0，200 m → 1），雾的天气代码至少保留 0.5，露点相差约 2 °C 以内会增加霾；有东西落下时压在 `WIPE_MIN_FOG` 以下，所以擦雾和阵风永远不会同时启用 | profile + 湿度 + 降水 |
| 闪电 | 0.55–1：冰雹代码（96/99）为 1，否则看 CAPE | 1 |
| 风 | 平均风速 + 向阵风靠近 ⅓ | 平均风速 |

**日出日落时间用纪元秒。** 预报以 `timeformat=unixtime` 请求。Open-Meteo 默认的 ISO 字符串是*该地点*的墙上时间，不带时区偏移，而 `new Date()` 会按*浏览器*的时区去读，于是相差一个时区的地点，日出就挪了一个小时。

### 场景

`deriveWeatherScene()` 是数据与每个渲染器之间唯一的纯函数：

| 字段 | 携带什么 |
|-------|-----------------|
| `sun` | 高度角、方位角、屏幕位置、日光系数、`isDay` |
| `moon` | 高度角、方位角、月相、照亮比例、可见度、屏幕位置、月光 |
| `sky` | 天顶 / 地平线颜色，太阳光晕的颜色和强度（按高度角设关键帧，按状况着色） |
| `clouds` | 云量、密度、风暴程度、受光 / 背光颜色、漂移速度 |
| `precipitation` | 类型 + 强度 |
| `wind` | 屏幕空间方向 × 强度 |
| `windWorld`、`celestial` | 同一股风的东向 / 北向分量；纬度、当地恒星时和磁偏角，供天空之窗使用 |
| `fog`、`lightning`、`stars`、`clarity` | 0..1 的量；`clarity` 只看云量和雾（流星要问的问题） |
| `behind` | 前面没有雾或雾层时的星星和月亮（擦雾所揭开的东西） |
| `veil`、`exposure`、`flat` | 主题向页面的混合、亮度，以及那些从不使用曝光的绘制器所用的颜色 |

其中每一种颜色都已经处于主题的基调里，所以深色主题下的白天是一片深邃的天空，而不是一片被蒙上遮罩的明亮天空（[The Sky](./ambient-sky.md#the-sky-and-the-theme)）。

### 主题跟随太阳

**Follow the Sun 是一种 Appearance**（`services/theme.tsx`），也是默认值。四种是 Follow the Sun、Light、Dark 和 Follow the System；命令面板的 `A` 在它们之间循环，起点是太阳当前给出的主题，所以从 Follow the Sun 出发的第一次按键一定会改变页面。在它之下，太阳升起时应用是 Light，太阳落下后是 Dark；另外三种顾名思义。devtool 的 Sky 模块在时间轴旁边有一个 Follow the Sun 开关。

**切换发生在太阳本身越过地平线的时刻**，也就是 ±45 分钟窗口的中间，这时天空变化最快：切换落在运动之中最不显眼。`solarThemeAt()`（`lib/solar-theme.ts`）就是这条朴素的规则：日出到日落之间是 light，之外是 dark，日出日落时间未知时为 null（此时什么都不切换）。

**交接**也把切换点放在一段短动画的中间（`SOLAR_HANDOVER`）：

```
0           the sky starts moving to the new theme: the wallpaper stack
            crossfades over skyMs (3000) instead of its usual 0.7 s, and the
            Sky's shader is put on the same clock by setThemeEase.
chromeAtMs  (1500) the chrome changes: one commit inside a view transition,
            so the page crossfades as one composited image.
skyMs       the sky settles, and the notice lands.
```

让天空能够先行的是 `wallpaperTheme`：场景、wash 的权重、图片显示哪一半以及 profile 读取它，而 chrome（页面底色、边框、文字）读取 `chromeTheme`。整个暮光期间，场景在两种主题下完全相同（[暮光外观](./ambient-sky.md#the-sky-and-the-theme)），所以交接中天空的那一半什么也不跨越。在没有 view transition 的地方（Firefox、减少动态效果），chrome 直接切换。

`<SolarThemeSync />`（根布局）在每一种 Appearance 下都把太阳的答案交给主题服务（通过 `useSunThemeSlot` 调用 `setSunTheme`），所以一选 Follow the Sun 就立刻落到它上面。在 Follow the Sun 下，它以两种方式改变页面：

1. **一次访问的第一个答案，悄悄地。** 在预报到来之前，Follow the Sun 信任系统设置（边框的启动脚本对第一帧也是这么做的）。如果之后太阳给出不同答案，页面交叉淡化一次，不发通知。太阳的答案不会被保存。
2. **实时看到的一次越过，分步上演**：先交接，然后一行通知说出当前模式。在天空变化期间选择另一种 Appearance，会取消整个交接；时钟倒回越过分界线也一样。

devtool 的时间旅行会真实地越过它：在 Sky 模块里播放一天，主题会在日出和日落时切换，和真实时钟完全一样。

### 权限

有三个邀请挡在浏览器的权限弹窗之前：倾斜（雨和雪）、天空之窗、位置。它们共用一条流水线：

```
provider facts            gyro state · geolocation permission · the place in use
  → lib/permissions.ts    status per kind: ready | askable | refused | unsupported
  → usePermissions(kinds) { status, askable, request() }; request asks in order
  → the feature's policy  shouldOfferTilt · skyOpenAction · skyAsksPlace · once-flags
  → PermissionSheet       usePermissionOffer (offer → asking → outcome) + the sheet
```

- **状态从实际生效的东西读取。** 当读数可以流入时，运动是 `ready`（`motionStatus`，来自 `gyro.reachable`）；只有当一次定位就是当前使用的位置时，位置才是 `ready`（`locationStatus`）。原始事实在边界情况下互相矛盾：Safari 在允许之后仍读出 `prompt`，`granted` 的位置也可能因为定位失败而仍在用 IP，而 WebKit 的运动权限根本没有查询接口。
- **`request()` 按唯一可行的顺序询问**：先运动，而且是同步的，因为 WebKit 只在点击本身的任务里打开它的权限；然后是位置，它会等运动的结果，而不是叠上第二个对话框。直接从按下事件里调用它，之前不要 await 任何东西。
- **策略属于各个功能自己**：是否邀请、多久邀请一次（倾斜的终身一次 `weatherGyroPrimed`，天空之窗的每会话一次 `skyLocationOffered`）。权限从不决定这些。
- **sheet**（`PermissionSheet`）不知道自己代表的是哪一种权限：`ask(fn)` 运行功能自己的 `request()` 调用，并落到它所映射的结果上。

新功能只有在浏览器守护着某种新东西时才新增 `PermissionKind`；否则它挑选自己需要的 kind，写好自己的策略，渲染一个 `PermissionSheet`。

### 位置、缓存与新鲜度

**缓存。** query client 及其持久化器在 `lib/query.ts`（localStorage 键 `hux_query_cache`，24 小时 `gcTime`），由 `shared/providers.tsx` 中的 `PersistQueryClientProvider` 包在一切外面，所以回访的访客在任何请求之前就能拿到上一次的位置和天气。天气的键带一个版本段（`queryKeys.weather`：`["weather", "v4", lat.toFixed(2), lon.toFixed(2)]`）：只要数据的形状变了就递增它，否则之前持久化的条目会被当成完整的数据返回。两个查询在新键加载期间都把上一个答案保留在屏幕上（`placeholderData`），所以从 IP 切到 Accurate，或者在新城市定位，旧的卡片和天空会一直留着，直到新的到来。

**新鲜度。** provider 和标签页一样长寿，所以光有过期时间什么也不会刷新；总得有东西去问：

| 数据 | 多久后过期 | 何时重新请求 |
|------|-------------|------------------|
| IP 位置 | 30 分钟 | 挂载、标签页回到前台（`visibilitychange`）、网络恢复、从往返缓存恢复 |
| GPS 位置 | 30 分钟 | 挂载和标签页回到前台，且仅在可以取定位时，所以重新请求永远不会弹出权限弹窗 |
| 天气 | 15 分钟 | 以上全部；一次按 Open-Meteo 下一个时间间隔定时的轮询（`current.time + interval` + 2 分钟，限制在 5–60 分钟，仅可见标签页；`nextWeatherPollMs`）；当地午夜（预报只有一天，昨天的日出日落时间会让一切都过时） |
| 时钟 | 不适用 | 每个整分钟边界，以及 `visibilitychange` / `pageshow` 时立即读取（锁屏的手机上计时器不运行） |

**IP 定位错了。** IP 数据库会把整个运营商定位错（圣何塞的一部手机可能被定位到达拉斯，Private Relay 或 VPN 也是如此）。浏览器的时区是一个免费的第二意见：如果某个提供方给出的地址处于不同的 UTC 偏移，它就会被怀疑，转而询问下一个；如果全都不一致，就保留第一个答案并标上 `timezoneMismatch: true`。devtool 的 Sky 部分会显示是谁给你定的位、多久之前，以及被标记时的 `tz≠`。

**请求真实位置。** 没有任何东西会自己弹出浏览器的权限弹窗（加载、聚焦、重新请求都不会）：

- 在 Accurate 模式下，只有 `canTakeFix` 允许时才取定位：权限读出 `granted`（或者浏览器无法告知），或者过去一天内记录过一次来自引导页或命令面板的定位（`locationGrantedAt`，`GRANT_MEMORY_MS`），因为 iOS Safari 在允许之后仍持续读出 `prompt`。否则这个查询*就是* IP 查询（同一个键，同一份缓存），所以 Safari 一夜之间重置的权限会退化为网络的猜测，而不是在加载时弹出弹窗。定位失败会退回 IP；被拒绝则清除记录。
- 定位是粗略的（`enableHighAccuracy: false`，`maximumAge` 10 分钟）：天气是一个城市尺度的问题，而且这样在 iOS 关闭"精确位置"时也能工作。
- 只有点击一个说明了原因的东西才会弹出权限弹窗：**位置引导页**（`LocationPrimerSheet`）、命令面板的 Geolocation 一行（`/` 然后 `C`；在那里被拒绝会打开引导页，说明去哪里撤销），或[天空之窗的邀请](./ambient-easter-eggs.md#asking-for-the-window)。
- **IP 位置在天气卡片里总是标为猜测**：城市名带一个 `ip` 标签（上面两张截图都是），定位得到的则显示箭头，城市和标签是同一个按钮，通向引导页。有 `timezoneMismatch` 时城市显示为 "Dallas?"。不会主动发出通知：时区检查漏掉了大多数定位错误，而每次猜测的访问都弹一个 toast，会比问题本身更吵。
- 权限变化会被实时跟踪（`PermissionStatus` 的 `change`）：访问期间做出的授权会切换到 Accurate；页面加载时就已有的授权则不会，因为那时选择 IP 是有意为之。来自引导页的授权会用刚取得的定位预填 Accurate 查询。

## 约束

| 约束 | 原因 | 打破之后 |
|---|---|---|
| 除了点击一个解释了原因的东西，没有任何东西会弹出浏览器权限弹窗 | 拒绝在哪里都是终局的；没有理由的弹窗会被拒绝 | 第一次访问就永久失去定位或运动权限 |
| `request()` 在按下事件中同步调用，先运动后位置 | WebKit 只在点击的任务里打开运动权限 | iOS 上永远拿不到运动权限，或者两个对话框叠在一起 |
| 权限状态从实际生效的东西读取，绝不从意愿或权限字符串读取 | 这些事实互相矛盾（Safari 允许后的 `prompt`；定位失败时的 `granted`） | 天空之窗没经询问就在 IP 所在城市上空打开 |
| 日出日落时间以 `unixtime` 请求 | ISO 字符串是该地点的墙上时间，不带偏移 | 另一个时区的地点日出差一个小时 |
| 数据含义变化时递增天气键的版本 | 缓存会持久化一天 | 旧条目被当成完整的数据返回 |
| 时段从 `nowMs` 推导，绝不直接设置 | 天空、文字和 Dock 共用一个时钟 | devtool 的时段与天空不一致（以前确实有过） |
| 天空读取太阳高度角，而不是时段 | 分钟级精度 | 一天里能看出六个台阶 |

## 参考

### 文件

```
systems/ambient/
├── provider.tsx                  # AmbientProvider: location, weather, time, solar theme, wallpaper
├── components/
│   ├── surface.tsx               # AmbientSurface: the bezel (vitre) + the full-page wallpaper mount
│   ├── wallpaper-background.tsx  # Full-page wallpaper (image / Sky / CSS), the egg listeners
│   ├── wallpaper.tsx             # <WeatherWallpaper />: the Sky's WebGL canvas shell
│   ├── wallpaper-sheet.tsx       # The wallpaper picker (an AdaptiveSurface)
│   ├── gradient-stack.tsx        # CSS crossfade renderer (full-page + widgets)
│   ├── greeting.tsx              # AmbientGreeting
│   ├── weather-widget.tsx        # The home weather card (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── weather-line.tsx          # One-line weather, lock-screen style
│   ├── weather-icon.tsx          # Condition icons
│   ├── phase-activity.tsx        # AmbientPhaseActivity (Dock Live Activity)
│   ├── solar-theme.tsx           # SolarThemeSync
│   ├── permission-sheet.tsx      # PermissionSheet + usePermissionOffer
│   ├── use-permissions.ts        # usePermissions: status, and one press that asks in order
│   ├── location-primer-sheet.tsx # The offer before the location prompt
│   ├── tilt-primer-sheet.tsx     # The tilt's offer (rain and snow)
│   ├── sky-window-sheet.tsx      # The sky window's offer: motion, and the place with it
│   ├── sky-pull-cue.tsx          # The light at the top while the home is pulled down
│   ├── sky-body-hints.tsx        # Edge hints toward an off-screen sun or moon
│   ├── body-glyph.tsx            # Solid sun and moon-phase glyphs
│   └── settle-spinner.tsx        # The top-right ring while the sky settles
└── lib/
    ├── location.ts               # IP providers, geolocation, reverse geocode, tz check
    ├── weather.ts                # Open-Meteo fetch + condition model
    ├── queries.ts                # useLocationQuery, useWeatherQuery, canTakeFix, poll timing
    ├── sun.ts · phase.ts         # Sun-event windows; deriveAmbientPhase
    ├── greeting.ts               # Time-of-day fallback, greeting keys
    ├── notification.ts           # Upcoming sun event (lead + window)
    ├── solar.ts                  # Sun and moon ephemerides, moon phase
    ├── magnetic.ts               # WMM2025 declination (the sky window's true north)
    ├── solar-theme.ts            # solarThemeAt, SOLAR_HANDOVER
    ├── scene.ts                  # deriveWeatherScene, staging, THEME_KEY, TWILIGHT_LOOK
    ├── gradient.ts               # sceneToCssGradient, getClassicGradient
    ├── color.ts · format.ts      # Colour maths; display formatting
    ├── wallpaper/                # The Sky: shader.ts, renderer.ts, stir.ts, support.ts
    ├── gyroscope.ts              # deviceorientation → gravity; motion access
    ├── sky-window.ts             # The phone as a window: view, projection, compass
    ├── sky-pull.ts               # The pull gesture; skyOpenAction, skyAsksPlace
    ├── sky-bodies.ts             # Per-frame channel: where the bodies are in the window
    ├── settle.ts                 # Named settle reasons (the spinner)
    ├── poke.ts                   # Tapped eggs: arming, cooldown, isBackgroundClick, holdCallout
    ├── wipe.ts                   # The fog wipe's stroke and hand
    ├── tilt-primer.ts            # The tilt primer's press and shouldOfferTilt
    ├── permissions.ts            # motionStatus, locationStatus
    ├── wallpaper.ts              # Kinds, styles, catalog, families, opacity
    ├── wallpaper-play.ts         # Shuffle / Loop
    ├── wallpaper-profile(s).ts   # Profile types; lookups into wallpaper-profiles.json
    ├── legibility.ts             # Profile → CSS variables (docs/system-legibility.md)
    ├── reading-surface.ts        # Which routes are reading pages
    ├── bezel.ts · platform.ts    # Bezel settings and family edges; edge masks, platform checks
    ├── fixed-bg-tracker.ts       # iOS background-attachment polyfill
    ├── settings.ts               # Persisted preferences (hux_ambient_settings)
    └── route-config.ts           # Form-factor types
```

### Hooks

完整的类型是 `provider.tsx` 里的各个 `*ContextType` 接口。

```typescript
const {
  locationMode,            // "ip" | "accurate" (the wish)
  location,                // ResolvedLocation | null (source: "ip" | "geolocation")
  permission,              // "granted" | "prompt" | "denied" | "unknown" | null, live
  usingGps,                // Accurate is in effect (false while a wish runs on the IP)
  isLoading, isFetching, error,
  setLocationMode,
  requestAccurateLocation, // may raise the prompt: call from a tap
  refresh,
  isLocationPrimerOpen, openLocationPrimer, closeLocationPrimer,
} = useLocation();

const {
  weather,                 // NormalizedWeather | null
  scene,                   // WeatherScene
  sceneWeather,            // the scene's weather input, for deriving other times
  isLoading, isFetching, error,
  debugOverride, setDebugOverride,     // devtool: { condition } | null
  sceneOverrides, setSceneOverrides,   // devtool Tune: cloud / precip / wind / veil
  refresh,
} = useWeather();

const {
  nowMs,                   // the effective clock: real, or time-travelled
  realNowMs,               // the wall clock
  phase,                   // always derived from nowMs
  sunriseMs, sunsetMs,     // for the effective day
  timeScrubMinutes, setTimeScrubMinutes, // devtool: minutes past midnight, or null
  dayOffset, setDayOffset, // devtool: whole days (moves the moon)
  isTimeTravelActive, resetTimeTravel,
} = useAmbientTime();

const {
  sunTheme,                // "light" | "dark" at the effective clock, or null
  beginThemeHandover,      // stage the next theme change (sky, then chrome)
} = useSolarTheme();
```

`useWallpaper()` 的概要见 [Wallpapers](./wallpapers.md#usewallpaper)。devtool 的覆盖项（状况、时间、微调）只在 devtool 启用时生效。

### 组件

- `<AmbientSurface>` 包裹页面内容：外面是边框（`vitre`），全页位置开启时后面是 `<WallpaperBackground />`。
- `<AmbientGreeting />` 说出当前时段（"Good Morning"、"Sun Is Setting"；`lib/i18n.ts` 中的 `greeting*` 键）。
- `<WeatherWidget />` 是首页卡片：城市（带 `ip` 标签或定位箭头）、温度、天气状况、日出日落时间。`<WeatherLine />` 是首页可以改为显示在问候语上方的单行形式。
