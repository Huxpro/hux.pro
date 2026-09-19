import type { ReactNode } from "react";
import type { DemoAction, PhoneReport } from "../config";
import { useT, type Text } from "../i18n";
import { Code } from "./Code";
import {
  BEZEL_PROPS,
  BEZEL_STATE,
  BOOT_STATE,
  CHROME_SYNC_OPTIONS,
  EXPORTS,
  SCROLL_PAGE_OPTIONS,
  type FieldDoc,
  type SectionId,
} from "./api";

// =============================================================================
// The documentation, one section per feature, in English and Chinese. Each
// section names the scenario the phone runs while it is on screen, explains
// the feature, and lists the part of the API it covers.
// =============================================================================

export interface DocSection {
  id: SectionId;
  /** Short label for the section switcher. */
  nav: Text;
  /** The API the section is about. Not translated. */
  eyebrow: string;
  title: Text;
  lede: Text;
  body?: Text<ReactNode>;
  code?: string;
  live?: (report: PhoneReport | null) => { label: Text; value: unknown } | null;
  actions?: { label: Text; run: DemoAction | "reload" }[];
}

type Live = NonNullable<DocSection["live"]>;
const themeColorLive: Live = (r) => r && { label: { en: "theme-color in the phone", zh: "手机里的 theme-color" }, value: r.themeColor };
const scrollLive: Live = (r) => r && { label: { en: "scroll · pageScrollTop()", zh: "滚动模式 · pageScrollTop()" }, value: `${String(r.state.scroll)} · ${r.scrollTop}px` };

const REBIND = `const { scroll } = useBezel();
useEffect(() => {
  const target = getScrollContainer() ?? window;
  target.addEventListener("scroll", onScroll, { passive: true });
  return () => target.removeEventListener("scroll", onScroll);
}, [scroll]);`;

function Table({ head, rows }: { head: Text[]; rows: Text<ReactNode>[][] }) {
  const t = useT();
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h.en}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{t(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const same = (node: ReactNode): Text<ReactNode> => ({ en: node, zh: node });

function ModeTable() {
  return (
    <Table
      head={[{ en: "", zh: "" }, { en: "window", zh: "window" }, { en: "container", zh: "container" }]}
      rows={[
        [{ en: "Scroller", zh: "滚动者" }, { en: "The document", zh: "document" }, { en: "A container inside the bezel", zh: "bezel 里的容器" }],
        [{ en: "Safari's toolbar", zh: "Safari 工具栏" }, { en: "Collapses and expands with scroll", zh: "随滚动收起和展开" }, { en: "Stays expanded", zh: "保持展开" }],
        [same(<code>getScrollContainer()</code>), same(<code>null</code>), { en: "The container", zh: "容器" }],
        [{ en: <><code>window.scrollY</code>, <code>scrollTo</code>, <code>scroll</code> event</>, zh: <><code>window.scrollY</code>、<code>scrollTo</code>、<code>scroll</code> 事件</> }, { en: "The page", zh: "页面" }, { en: "Not the page's scroll", zh: "不是页面的滚动" }],
        [same(<code>animation-timeline: scroll(root)</code>), { en: "The page", zh: "页面" }, { en: "Silent; use --page-scroll", zh: "不生效，改用 --page-scroll" }],
        [{ en: "Tap on the status bar", zh: "点击状态栏" }, { en: "Back to the top", zh: "回到顶部" }, { en: "Back to the top, on iOS", zh: "回到顶部（iOS）" }],
        [{ en: <>Full-screen fixed layers: <code>body &gt; .fixed</code>, <code>BEZEL_LAYER_ATTRIBUTE</code></>, zh: <>全屏 fixed 图层：<code>body &gt; .fixed</code>、<code>BEZEL_LAYER_ATTRIBUTE</code></> }, same("fixed"), same("absolute")],
        [{ en: <><code>position: sticky</code>, IntersectionObserver, <code>scrollIntoView</code>, anchors</>, zh: <><code>position: sticky</code>、IntersectionObserver、<code>scrollIntoView</code>、锚点</> }, { en: "Work", zh: "正常" }, { en: "Work", zh: "正常" }],
      ]}
    />
  );
}

function NeedTable() {
  return (
    <Table
      head={[{ en: "Your page", zh: "你的页面" }, { en: "Use", zh: "使用" }]}
      rows={[
        [{ en: <>Only <code>position: sticky</code>, IntersectionObserver, <code>scrollIntoView</code> and anchors</>, zh: <>只用 <code>position: sticky</code>、IntersectionObserver、<code>scrollIntoView</code> 和锚点</> }, { en: "Nothing more", zh: "不需要额外的 API" }],
        [{ en: "Always window scroll", zh: "始终 window 滚动" }, same(<code>window</code>)],
        [{ en: "Always container scroll", zh: "始终 container 滚动" }, { en: <><code>getScrollContainer()</code>, as any scroll container</>, zh: <><code>getScrollContainer()</code>，当作普通滚动容器</> }],
        [{ en: "Switches mode live, or a component that does not know the host's mode", zh: "模式会实时切换，或组件不知道宿主用哪种模式" }, { en: "The page helpers", zh: "页面滚动工具函数" }],
        [{ en: "Scroll-driven CSS", zh: "滚动驱动的 CSS 动画" }, same(<><code>animation-timeline: --page-scroll</code></>)],
        [{ en: "A library that takes a scroll element", zh: "需要传入滚动元素的库" }, { en: <><code>getScrollContainer()</code>, bound again on <code>useBezel().scroll</code></>, zh: <><code>getScrollContainer()</code>，随 <code>useBezel().scroll</code> 重新绑定</> }],
      ]}
    />
  );
}

const HEAD: Text[] = [
  { en: "Name", zh: "名称" },
  { en: "Type", zh: "类型" },
  { en: "Default", zh: "默认值" },
  { en: "Description", zh: "说明" },
];

export function Fields({ fields }: { fields: Record<string, FieldDoc> }) {
  return (
    <Table
      head={HEAD}
      rows={Object.entries(fields).map(([name, f]) => [
        same(<code>{name}</code>),
        same(<code>{f.type}</code>),
        same(f.default ? <code>{f.default}</code> : "—"),
        f.summary,
      ])}
    />
  );
}

function ExportsTable() {
  return (
    <Table
      head={[{ en: "Export", zh: "导出" }, { en: "Signature", zh: "签名" }, { en: "Description", zh: "说明" }]}
      rows={Object.entries(EXPORTS).map(([name, d]) => [
        same(
          <>
            <code>{name}</code>
            <span className="docs-kind">{d.kind}</span>
          </>,
        ),
        same(<code>{d.signature}</code>),
        d.summary,
      ])}
    />
  );
}

function SafariTable() {
  const rows: [Text, Text][] = [
    [
      { en: "Chrome colour at load", zh: "加载时的 chrome 颜色" },
      { en: "The root background, or fixed content spanning the viewport edge", zh: "根背景色，或贴着视口边缘的 fixed 内容" },
    ],
    [{ en: "Root background changed later", zh: "之后修改根背景色" }, { en: "Not re-read", zh: "不会重新读取" }],
    [
      { en: "theme-color", zh: "theme-color" },
      { en: "Ignored (iOS 18.5 follows it live)", zh: "忽略（iOS 18.5 会实时跟随）" },
    ],
    [
      { en: "Fixed content at the edge, added later", zh: "之后加入的贴边 fixed 内容" },
      { en: "Followed live from 6px, and kept after it is removed", zh: "从 6px 起实时跟随，移除后颜色保留" },
    ],
    [
      { en: "Transparent fixed container at the edge", zh: "贴边的透明 fixed 容器" },
      { en: "Copies what is composited beneath it, not its children", zh: "复制它下方合成出来的像素，而不是它的子元素" },
    ],
    [
      { en: "Toolbar collapse", zh: "工具栏收起" },
      { en: "When the user scrolls the document down; scrolling up expands it. A script's scroll leaves it, except that reaching the top expands it", zh: "用户向下滚动文档时收起，向上滚动时展开。脚本触发的滚动不改变它，但滚到顶部会展开" },
    ],
    [{ en: "Safe-area insets in portrait", zh: "竖屏时的安全区" }, { en: "All 0", zh: "全部为 0" }],
  ];
  return <Table head={[{ en: "Behaviour", zh: "行为" }, { en: "iOS 26.5", zh: "iOS 26.5" }]} rows={rows} />;
}

export function SectionCovers({ id }: { id: SectionId }) {
  const names = Object.entries(EXPORTS)
    .filter(([, d]) => d.section === id)
    .map(([n]) => n);
  if (names.length === 0) return null;
  return (
    <p className="docs-covers">
      {names.map((n) => (
        <code key={n}>{n}</code>
      ))}
    </p>
  );
}

export const SECTIONS: DocSection[] = [
  {
    id: "intro",
    nav: { en: "Overview", zh: "概览" },
    eyebrow: "vitre",
    title: { en: "Safari's glass, in your colours", zh: "让 Safari 的玻璃，显示你的颜色" },
    lede: {
      en: "vitre brings theme-color to iOS 26: it tints Safari's glass toolbar and status bar live, draws a bezel around the page, and scrolls the page in a container so its edges hold still. The phone on the left is the demo site; every section below drives it.",
      zh: "vitre 让 theme-color 在 iOS 26 上重新可用：实时给 Safari 的玻璃工具栏和状态栏着色，在页面四周画一圈 bezel，并让页面在容器里滚动，边缘保持稳定。左边的手机就是 demo 站点，下面每一节都会驱动它演示。",
    },
    body: {
      en: (
        <>
          <p><em>Vitre</em> is French for a windowpane: the glass set in a frame. Safari on iOS 26 draws its bars as glass over the edges of the page and tints them from what it finds there. vitre is the frame and the pane at those edges.</p>
          <p>Three words, each meaning one thing:</p>
          <ul>
            <li><strong>bezel</strong> — the border drawn around the page: a band on each edge and rounded inner corners, in one colour.</li>
            <li><strong>chrome</strong> — only the browser&apos;s own UI: Safari&apos;s status bar and toolbar.</li>
            <li><strong>scroll</strong> — where the page scrolls: the window, or a container inside a locked window.</li>
          </ul>
          <p>The phone&apos;s bars are simulated from <code>theme-color</code>. Open this page on an iPhone to see the real ones follow.</p>
        </>
      ),
      zh: (
        <>
          <p><em>Vitre</em> 是法语的“窗玻璃”，指镶在框里的那块玻璃。iOS 26 的 Safari 把状态栏和工具栏画成盖在页面边缘上的玻璃，并从边缘的内容里取色。vitre 就是这些边缘上的框和玻璃。</p>
          <p>三个词，各自只有一个含义：</p>
          <ul>
            <li><strong>bezel</strong>：画在页面四周的边框，每条边一条 band，内侧是圆角，统一一个颜色。</li>
            <li><strong>chrome</strong>：只指浏览器自己的界面，也就是 Safari 的状态栏和工具栏。</li>
            <li><strong>scroll</strong>：页面在哪里滚动，window，或者锁住 window 之后的一个容器。</li>
          </ul>
          <p>左边手机的状态栏和工具栏是根据 <code>theme-color</code> 模拟的。用 iPhone 打开这个页面，可以看到真实的 Safari 跟着变色。</p>
        </>
      ),
    },
    code: `import { Bezel, BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "vitre";

<Bezel
  enabled={on}
  color="#000000"
  band={0}
  radius={16}
  scroll={on ? "container" : "window"}
  ground={dark ? "#1a1a1a" : "#ffffff"}
  backdrop={<Wallpaper {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }} style={BEZEL_INSET} />}
>
  {page}
</Bezel>`,
  },
  {
    id: "enabled",
    nav: { en: "On & off", zh: "开关" },
    eyebrow: "<Bezel enabled>",
    title: { en: "On and off, live", zh: "实时开关" },
    lede: {
      en: "enabled draws the bezel or takes it away without a reload. The chrome takes the bezel colour while it is on and the ground while it is off.",
      zh: "enabled 可以不刷新就画出或去掉 bezel。开启时 chrome 显示 bezel 的颜色，关闭时显示页面底色。",
    },
    body: {
      en: (
        <>
          <p><code>null</code> means the host does not know yet — typically before it has read its settings on the client. The bezel then holds whatever the boot script painted, so a page that loaded with a bezel keeps it.</p>
          <p><code>&lt;Bezel&gt;</code> keeps its attributes on <code>&lt;html&gt;</code>: when something strips them, as React 19 does after a failed hydration, they are back before the next paint.</p>
          <Fields fields={BEZEL_PROPS} />
        </>
      ),
      zh: (
        <>
          <p><code>null</code> 表示宿主还不确定，通常是在客户端读到设置之前。这时 bezel 保持启动脚本画出的状态，所以带着 bezel 加载的页面不会闪掉。</p>
          <p><code>&lt;Bezel&gt;</code> 会守住它写在 <code>&lt;html&gt;</code> 上的属性：被清空时（比如 hydration 失败后的 React 19），会在下一次绘制前恢复。</p>
          <Fields fields={BEZEL_PROPS} />
        </>
      ),
    },
    code: `<Bezel enabled={settingsLoaded ? wantsBezel : null} … />`,
  },
  {
    id: "band",
    nav: { en: "Band", zh: "边框厚度" },
    eyebrow: "band",
    title: { en: "The band", zh: "Band" },
    lede: {
      en: "The top and bottom edges of the bezel, in px. The page ends where the band begins, and layers spread BEZEL_INSET stop there too.",
      zh: "bezel 上下两条边的厚度（px）。页面在 band 开始的地方结束，展开了 BEZEL_INSET 的图层也停在那里。",
    },
    body: {
      en: <p>The sides follow the safe area instead: zero in portrait, the notch in landscape.</p>,
      zh: <p>左右两边跟随安全区：竖屏时为 0，横屏时是刘海的宽度。</p>,
    },
    code: `<Bezel band={clampBezelBand(settings.band ?? DEFAULT_BEZEL_BAND)} … />`,
  },
  {
    id: "radius",
    nav: { en: "Radius", zh: "圆角" },
    eyebrow: "radius",
    title: { en: "The corners", zh: "圆角" },
    lede: {
      en: "Rounded inner corners, drawn in the bezel colour at the band's inner edge, the way iOS rounds every app window.",
      zh: "在 band 内侧用 bezel 的颜色画出圆角，就像 iOS 给每个 App 窗口加的圆角一样。",
    },
    code: `<Bezel radius={clampBezelRadius(24)} … />`,
  },
  {
    id: "color",
    nav: { en: "Colour", zh: "颜色" },
    eyebrow: "color",
    title: { en: "Any colour", zh: "任意颜色" },
    lede: {
      en: "The bezel colour is any CSS colour and changes live. Each change is shown to Safari so its bars follow.",
      zh: "bezel 的颜色可以是任意 CSS 颜色，并且实时生效。每次变化都会让 Safari 重新取色，状态栏和工具栏随之改变。",
    },
    body: {
      en: <p>Black is ryOS&apos;s choice and the usual one. A saturated colour makes the chrome sync easy to see on a phone.</p>,
      zh: <p>黑色是 ryOS 的选择，也最常用。在手机上用饱和一点的颜色，更容易看出 chrome 同步的效果。</p>,
    },
    live: themeColorLive,
  },
  {
    id: "theme",
    nav: { en: "Light & dark", zh: "深浅色" },
    eyebrow: "ground · theme",
    title: { en: "Light and dark", zh: "深色与浅色" },
    lede: {
      en: "ground is the page's own colour: what the chrome takes while the bezel is off. A host can also give the bezel a colour that follows the theme.",
      zh: "ground 是页面自己的底色，bezel 关闭时 chrome 显示这个颜色。宿主也可以让 bezel 的颜色跟随主题。",
    },
    body: {
      en: <p>In this demo the <em>Theme</em> colour mode passes the ground as the bezel colour, so the bezel is white in light mode and <code>#1a1a1a</code> in dark. Flipping the theme changes the colour prop, and the chrome syncs.</p>,
      zh: <p>这个 demo 的 <em>Theme</em> 颜色模式把 ground 作为 bezel 的颜色：浅色模式下 bezel 是白色，深色模式下是 <code>#1a1a1a</code>。切换主题会改变 color 属性，chrome 随之同步。</p>,
    },
    code: `const ground = dark ? "#1a1a1a" : "#ffffff";
<Bezel color={tint === "theme" ? ground : tint} ground={ground} … />`,
    live: (r) => r && { label: { en: "theme · ground", zh: "主题 · ground" }, value: `${r.theme} · ${String(r.state.ground)}` },
  },
  {
    id: "scroll",
    nav: { en: "Scroll", zh: "滚动" },
    eyebrow: "<Bezel scroll>",
    title: { en: "Where the page scrolls", zh: "页面在哪里滚动" },
    lede: {
      en: "scroll picks the page's scroller: the window, or a container inside the bezel with <html> and <body> held still. <Bezel> writes the choice to <html>, and everything else reads it from there.",
      zh: "scroll 决定页面的滚动者：window，或者 bezel 里的一个容器，此时 <html> 和 <body> 固定不动。<Bezel> 把这个选择写到 <html> 上，其他地方都从那里读取。",
    },
    body: {
      en: (
        <>
          <ModeTable />
          <p>Switching carries the scroll position across and notifies page scroll listeners. <code>scroll</code> is independent of <code>enabled</code>, <code>color</code> and <code>band</code>; container scroll is the one to use while the bezel is on.</p>
          <p>Switch the phone to window scroll and scroll it: its toolbar collapses and expands as Safari&apos;s does.</p>
          <h3>Window scroll on iOS Safari</h3>
          <ul>
            <li><strong>Edge leak.</strong> Each time the toolbar collapses or expands, a strip of page content up to about 50px shows below the bottom band for about 200ms, while Safari still draws fixed elements at the old viewport size.</li>
            <li><strong>Live changes.</strong> A toolbar collapse makes Safari sample the edge again, and in rare cases the chrome keeps the wrong colour after a live change until a reload.</li>
          </ul>
        </>
      ),
      zh: (
        <>
          <ModeTable />
          <p>切换模式时会带上滚动位置，并通知页面滚动的监听者。<code>scroll</code> 与 <code>enabled</code>、<code>color</code>、<code>band</code> 相互独立；开启 bezel 时用 container 滚动。</p>
          <p>把手机切到 window 滚动再滚一滚：它的工具栏会像 Safari 一样收起和展开。</p>
          <h3>iOS Safari 上的 window 滚动</h3>
          <ul>
            <li><strong>边缘漏出。</strong>工具栏每次收起或展开，底部 band 下方会露出最高约 50px 的页面内容，持续约 200ms，这段时间 Safari 仍按旧的视口尺寸绘制 fixed 元素。</li>
            <li><strong>实时变更。</strong>工具栏收起会让 Safari 重新取边缘的颜色，极少数情况下实时变更后 chrome 会停在错误的颜色上，刷新后恢复。</li>
          </ul>
        </>
      ),
    },
    code: `<Bezel scroll={bezelOn ? "container" : "window"} … />`,
    live: scrollLive,
  },
  {
    id: "statusTap",
    nav: { en: "Status bar", zh: "状态栏" },
    eyebrow: '<Bezel scroll="container">',
    title: { en: "Tap the status bar, back to the top", zh: "点状态栏，回到顶部" },
    lede: {
      en: "On iOS, tapping the status bar takes the page back to the top. In container scroll the gesture reaches the container too, and the page eases back up.",
      zh: "在 iOS 上，点击状态栏会让页面回到顶部。container 滚动时这个手势同样会传到容器，页面平滑地回到顶部。",
    },
    body: {
      en: (
        <>
          <p>iOS hands the gesture to the window&apos;s scroll view. While the page is away from the top, vitre parks the window a few pixels down — invisible, because <code>&lt;body&gt;</code> is fixed — and Safari scrolling it back to 0 is the tap. The container then eases to the top in 280–640ms, by distance. With reduced motion it jumps, and a touch stops it where it is.</p>
          <p>It is on wherever container scroll is on iOS, with nothing to call. While a sheet or dialog holds a scroll lock, the tap waits until it closes.</p>
          <p>Click the phone&apos;s status bar to try it.</p>
        </>
      ),
      zh: (
        <>
          <p>iOS 把这个手势交给 window 的滚动视图。页面离开顶部时，vitre 把 window 往下停几个像素，因为 <code>&lt;body&gt;</code> 是固定的，所以看不出来；Safari 把它滚回 0，就是这次点击。随后容器在 280–640ms 内（按距离）平滑回到顶部。开启减弱动态效果时直接跳到顶部，手指一碰就停在当前位置。</p>
          <p>只要在 iOS 上使用 container 滚动，这个能力就会自动开启，不需要调用任何东西。sheet 或对话框持有滚动锁时，点击会等到它关闭后才生效。</p>
          <p>点一下左边手机的状态栏试试。</p>
        </>
      ),
    },
    live: scrollLive,
  },
  {
    id: "backdrop",
    nav: { en: "Backdrop", zh: "背景层" },
    eyebrow: "backdrop · BEZEL_INSET · BEZEL_LAYER_ATTRIBUTE",
    title: { en: "Layers inside the bezel", zh: "bezel 里的图层" },
    lede: {
      en: "backdrop renders behind the page. Spread BEZEL_INSET so a layer stops where the bezel begins, and mark it with BEZEL_LAYER_ATTRIBUTE so container scroll makes it absolute.",
      zh: "backdrop 渲染在页面后面。展开 BEZEL_INSET 让图层停在 bezel 的边缘，再加上 BEZEL_LAYER_ATTRIBUTE，container 滚动时它就会变成 absolute。",
    },
    code: `backdrop={
  <div
    {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }}
    style={{ position: "fixed", zIndex: -1, background: wallpaper, ...BEZEL_INSET }}
  />
}`,
  },
  {
    id: "chrome",
    nav: { en: "Chrome sync", zh: "Chrome 同步" },
    eyebrow: "syncChrome",
    title: { en: "Keeping Safari's bars in step", zh: "让 Safari 的状态栏和工具栏跟上" },
    lede: {
      en: "iOS 26 Safari reads its chrome colour from the root background only at load, and ignores theme-color. It does follow fixed content at the viewport edge, live, from 6px thick.",
      zh: "iOS 26 Safari 只在加载时从根背景色读取 chrome 颜色，并且忽略 theme-color。但它会实时跟随贴着视口边缘、至少 6px 厚的 fixed 内容。",
    },
    body: {
      en: (
        <>
          <p>So a change is shown to Safari as a morph: a fixed bezel in the new colour grows from the band on screen to <code>CHROME_MORPH_PX</code> (160ms), holds while Safari samples it (440ms), and eases back (280ms). Each band is its own fixed element — a transparent container with coloured children does not work — and they are children of <code>&lt;html&gt;</code>, so container scroll leaves them fixed. <code>theme-color</code> is set too, for iOS 18. <code>&lt;Bezel&gt;</code> calls it whenever the colour the chrome should show changes.</p>
          <Fields fields={CHROME_SYNC_OPTIONS} />
        </>
      ),
      zh: (
        <>
          <p>所以每次变色都用一次“变形”告诉 Safari：一个新颜色的 fixed bezel 从当前 band 长到 <code>CHROME_MORPH_PX</code>（160ms），停留让 Safari 取色（440ms），再缓缓收回（280ms）。每条 band 都是独立的 fixed 元素（透明容器里放彩色子元素是不行的），并且挂在 <code>&lt;html&gt;</code> 下，container 滚动时不会被改成 absolute。同时也会设置 <code>theme-color</code>，照顾 iOS 18。只要 chrome 应该显示的颜色变了，<code>&lt;Bezel&gt;</code> 就会调用它。</p>
          <Fields fields={CHROME_SYNC_OPTIONS} />
        </>
      ),
    },
    code: `syncChrome("#c1440e", { band: 0, radius: 16 });`,
    live: themeColorLive,
  },
  {
    id: "boot",
    nav: { en: "First frame", zh: "第一帧" },
    eyebrow: "bezelBootScript · readBezelBoot",
    title: { en: "The first frame", zh: "第一帧" },
    lede: {
      en: "Safari picks its chrome colour at load, before any component renders. The boot script paints the first frame from your settings: stylesheet, <html> attributes, theme-color.",
      zh: "Safari 在加载时、任何组件渲染之前就选定了 chrome 颜色。启动脚本按你的设置画出第一帧：样式表、<html> 属性和 theme-color。",
    },
    body: {
      en: (
        <>
          <p>The resolver is the body of a function, as source, that returns a <code>BezelBootState</code>. It runs before React, so it cannot import; interpolate your constants into it. This demo&apos;s resolver reads its saved devtool settings.</p>
          <Fields fields={BOOT_STATE} />
        </>
      ),
      zh: (
        <>
          <p>resolver 是一个函数体的源码，返回一个 <code>BezelBootState</code>。它在 React 之前运行，不能 import，常量需要插值进去。这个 demo 的 resolver 读取的是 devtool 保存的设置。</p>
          <Fields fields={BOOT_STATE} />
        </>
      ),
    },
    code: `<script dangerouslySetInnerHTML={{ __html: bezelBootScript(\`
  var s = JSON.parse(localStorage.getItem("settings") || "{}");
  return { enabled: !!s.bezel, color: "#000", band: 0,
           scroll: s.bezel ? "container" : "window", ground: "#fff" };
\`) }} />`,
    actions: [{ label: { en: "Reload the phone", zh: "刷新手机" }, run: "reload" }],
  },
  {
    id: "pageScroll",
    nav: { en: "Page scroll", zh: "页面滚动" },
    eyebrow: "getScrollContainer · usePageScroll · scrollPageTo · …",
    title: { en: "Page scroll, in either mode", zh: "两种模式下的页面滚动" },
    lede: {
      en: "The page scroll API reads and drives the page's scroll wherever it happens, so code written against it works in both modes, across a live switch, and outside React.",
      zh: "页面滚动 API 在页面实际滚动的地方读取和控制滚动，所以基于它写的代码在两种模式下、实时切换时、以及 React 之外都能工作。",
    },
    body: {
      en: (
        <>
          <h3>What your page needs</h3>
          <NeedTable />
          <h3>The scroller</h3>
          <p><code>getScrollContainer()</code> returns the container in container scroll and <code>null</code> in window scroll — <code>null</code> being the platform&apos;s value for the viewport, as in an IntersectionObserver&apos;s <code>root</code>. Hand it to anything that takes a scroll element, and bind again when the mode changes:</p>
          <Code code={REBIND} />
          <h3>The page</h3>
          <p>The helpers are built on the scroller and read the mode at every call. Without <code>&lt;Bezel&gt;</code> they act on the window. <code>scrollPageTo</code> takes the platform&apos;s scroll behaviour:</p>
          <Fields fields={SCROLL_PAGE_OPTIONS} />
        </>
      ),
      zh: (
        <>
          <h3>你的页面需要什么</h3>
          <NeedTable />
          <h3>滚动者</h3>
          <p><code>getScrollContainer()</code> 在 container 滚动时返回容器，在 window 滚动时返回 <code>null</code>。<code>null</code> 是平台表示视口的值，和 IntersectionObserver 的 <code>root</code> 一致。把它交给任何需要滚动元素的地方，模式变化时重新绑定：</p>
          <Code code={REBIND} />
          <h3>页面</h3>
          <p>这些工具函数建立在滚动者之上，每次调用都读取当前模式。没有 <code>&lt;Bezel&gt;</code> 时作用于 window。<code>scrollPageTo</code> 接受平台的滚动行为参数：</p>
          <Fields fields={SCROLL_PAGE_OPTIONS} />
        </>
      ),
    },
    code: `usePageScroll(() => setProgress(pageScrollTop() / (pageScrollHeight() - pageViewportHeight())));
scrollPageTo(pageOffsetOf(heading) - 96, { behavior: "smooth" });`,
    live: (r) => r && { label: { en: "pageScrollTop() in the phone", zh: "手机里的 pageScrollTop()" }, value: `${r.scrollTop}px` },
    actions: [
      { label: { en: "Scroll to top", zh: "滚到顶部" }, run: "scroll-top" },
      { label: { en: "Scroll to bottom", zh: "滚到底部" }, run: "scroll-bottom" },
    ],
  },
  {
    id: "state",
    nav: { en: "useBezel", zh: "useBezel" },
    eyebrow: "useBezel",
    title: { en: "What the bezel resolved", zh: "bezel 解析出的状态" },
    lede: {
      en: "useBezel() returns the state the bezel is showing. Outside <Bezel> it returns a disabled default.",
      zh: "useBezel() 返回 bezel 当前显示的状态。在 <Bezel> 之外返回一个关闭状态的默认值。",
    },
    body: same(<Fields fields={BEZEL_STATE} />),
    live: (r) => r && { label: { en: "useBezel() in the phone", zh: "手机里的 useBezel()" }, value: r.state },
  },
  {
    id: "api",
    nav: { en: "API", zh: "API" },
    eyebrow: "reference",
    title: { en: "Every export", zh: "全部导出" },
    lede: {
      en: "The whole public API. This list is type-checked against the package's contract, so it cannot miss an export.",
      zh: "完整的公开 API。这份列表会和包的类型契约做类型检查，不会漏掉任何导出。",
    },
    body: same(<ExportsTable />),
  },
  {
    id: "safari",
    nav: { en: "Safari", zh: "Safari" },
    eyebrow: "why",
    title: { en: "What iOS Safari does", zh: "iOS Safari 的实际行为" },
    lede: {
      en: "Measured in the iOS 26.5 simulator by reading screenshot pixels, and checked on a phone.",
      zh: "在 iOS 26.5 模拟器里通过读取截图像素测得，并在真机上核对过。",
    },
    body: same(<SafariTable />),
  },
];
