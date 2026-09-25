import type { ReactNode } from "react";
import type { DemoAction, PhoneReport } from "../config";
import { useT, type Text } from "../i18n";
import { Code } from "./Code";
import {
  VITRE_PROPS,
  VITRE_STATE,
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

const REBIND = `const { scroll } = useVitre();
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
        [{ en: "Scroller", zh: "滚动元素" }, { en: "The document", zh: "document" }, { en: "A container inside the bezel", zh: "bezel 里的容器" }],
        [{ en: "Safari's toolbar", zh: "Safari 工具栏" }, { en: "Collapses and expands with scroll", zh: "随滚动收起和展开" }, { en: "Stays expanded", zh: "保持展开" }],
        [same(<code>getScrollContainer()</code>), same(<code>null</code>), { en: "The container", zh: "容器" }],
        [{ en: <><code>window.scrollY</code>, <code>scrollTo</code>, <code>scroll</code> event</>, zh: <><code>window.scrollY</code>、<code>scrollTo</code>、<code>scroll</code> 事件</> }, { en: "The page", zh: "页面" }, { en: "Not the page's scroll", zh: "不是页面的滚动" }],
        [same(<code>animation-timeline: scroll(root)</code>), { en: "The page", zh: "页面" }, { en: "Silent. Use --page-scroll", zh: "不生效，改用 --page-scroll" }],
        [{ en: "Tap on the status bar", zh: "点击状态栏" }, { en: "Back to the top", zh: "回到顶部" }, { en: "Back to the top, on iOS", zh: "回到顶部（iOS）" }],
        [{ en: <>Full-screen fixed layers: <code>body &gt; .fixed</code>, <code>VITRE_LAYER_ATTRIBUTE</code></>, zh: <>全屏 fixed 图层：<code>body &gt; .fixed</code>、<code>VITRE_LAYER_ATTRIBUTE</code></> }, same("fixed"), same("absolute")],
        [{ en: <><code>position: sticky</code>, IntersectionObserver, <code>scrollIntoView</code>, anchors</>, zh: <><code>position: sticky</code>、IntersectionObserver、<code>scrollIntoView</code>、锚点</> }, { en: "Work", zh: "正常" }, { en: "Work", zh: "正常" }],
      ]}
    />
  );
}

function NeedTable() {
  return (
    <Table
      head={[{ en: "Your page", zh: "你的页面" }, { en: "Use", zh: "用什么" }]}
      rows={[
        [{ en: <>Only <code>position: sticky</code>, IntersectionObserver, <code>scrollIntoView</code> and anchors</>, zh: <>只用 <code>position: sticky</code>、IntersectionObserver、<code>scrollIntoView</code> 和锚点</> }, { en: "Nothing", zh: "什么都不用" }],
        [{ en: "Always window scroll", zh: "只用 window 滚动" }, same(<code>window</code>)],
        [{ en: "Always container scroll", zh: "只用 container 滚动" }, { en: <><code>getScrollContainer()</code>, as any scroll container</>, zh: <><code>getScrollContainer()</code>，当作普通滚动容器</> }],
        [{ en: "Switches mode live, or can't know which one the host uses", zh: "会实时切换模式，或者不知道宿主用哪种" }, { en: "The page helpers", zh: "页面滚动工具函数" }],
        [{ en: "Scroll-driven CSS", zh: "滚动驱动的 CSS 动画" }, same(<><code>animation-timeline: --page-scroll</code></>)],
        [{ en: "A library that takes a scroll element", zh: "需要传入滚动元素的库" }, { en: <><code>getScrollContainer()</code>, bound again on <code>useVitre().scroll</code></>, zh: <><code>getScrollContainer()</code>，随 <code>useVitre().scroll</code> 重新绑定</> }],
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
        same(f.default ? <code>{f.default}</code> : null),
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
    eyebrow: "Vitre",
    title: { en: "Safari's glass, in your colours", zh: "让 Safari 的玻璃，显示你的颜色" },
    lede: {
      en: "Vitre brings theme-color back to iOS 26. It tints Safari's glass toolbar and status bar live, draws a bezel around the page, and scrolls the page in a container so the edges hold still. The phone on the left runs the demo, and each section below drives it.",
      zh: "窗玻璃（Vitre）让 theme-color 在 iOS 26 上重新生效：实时给 Safari 的玻璃工具栏和状态栏着色，给页面画一圈 bezel，再让页面在容器里滚动，边缘就稳住了。左边的手机跑的就是 demo，下面每一节都会驱动它。",
    },
    body: {
      en: (
        <>
          <p><em>Vitre</em> is French for windowpane. Safari on iOS 26 draws its bars as glass over the edges of the page, and tints them from whatever is there. Vitre is the frame and the glass at those edges.</p>
          <p>It looks after three things:</p>
          <ul>
            <li><strong>bezel</strong>: the border around the page. A band on each edge, rounded inner corners, one colour.</li>
            <li><strong>chrome</strong>: Safari&apos;s status bar and toolbar. They show the bezel colour while the bezel is on, and the page&apos;s ground while it is off.</li>
            <li><strong>scroll</strong>: where the page scrolls. The window, or a container while the window holds still.</li>
          </ul>
          <p>Everything else is named after the library: <code>&lt;Vitre&gt;</code>, <code>useVitre</code>, <code>data-vitre-*</code>.</p>
          <p>The phone&apos;s bars are simulated from <code>theme-color</code>. On an iPhone, the real ones follow.</p>
        </>
      ),
      zh: (
        <>
          <p><em>Vitre</em> 是法语的“窗玻璃”。iOS 26 的 Safari 把状态栏和工具栏画成一层玻璃，盖在页面边缘，颜色取自底下的内容。窗玻璃管的就是边缘上这一圈框和玻璃。</p>
          <p>它照看三样东西：</p>
          <ul>
            <li><strong>bezel</strong>：页面四周的边框。每条边一条 band，内侧圆角，一个颜色。</li>
            <li><strong>chrome</strong>：Safari 的状态栏和工具栏。bezel 开着时显示 bezel 的颜色，关着时显示页面底色（ground）。</li>
            <li><strong>scroll</strong>：页面在哪里滚动。要么是 window，要么 window 不动，页面在容器里滚。</li>
          </ul>
          <p>其余的都用库名：<code>&lt;Vitre&gt;</code>、<code>useVitre</code>、<code>data-vitre-*</code>。</p>
          <p>左边手机的状态栏和工具栏是按 <code>theme-color</code> 模拟的。用 iPhone 打开这页，能看到真的 Safari 跟着变色。</p>
        </>
      ),
    },
    code: `import { Vitre, BEZEL_INSET, VITRE_LAYER_ATTRIBUTE } from "vitre";

<Vitre
  enabled={on}
  color="#000000"
  band={0}
  radius={16}
  scroll={on ? "container" : "window"}
  ground={dark ? "#1a1a1a" : "#ffffff"}
  backdrop={<Wallpaper {...{ [VITRE_LAYER_ATTRIBUTE]: "" }} style={BEZEL_INSET} />}
>
  {page}
</Vitre>`,
  },
  {
    id: "enabled",
    nav: { en: "On & off", zh: "开关" },
    eyebrow: "<Vitre enabled>",
    title: { en: "On and off, live", zh: "实时开关" },
    lede: {
      en: "enabled draws or removes the bezel without a reload. The chrome shows the bezel colour while it is on, and the ground while it is off.",
      zh: "enabled 开关 bezel，不用刷新。开着时 chrome 显示 bezel 的颜色，关着时显示页面底色。",
    },
    body: {
      en: (
        <>
          <p><code>null</code> means the host doesn&apos;t know yet, usually because it hasn&apos;t read its settings on the client. The bezel keeps what the boot script painted, so a page that loaded with a bezel keeps it.</p>
          <p>If something strips the attributes <code>&lt;Vitre&gt;</code> wrote to <code>&lt;html&gt;</code>, as React 19 does after a failed hydration, they are back before the next paint.</p>
          <Fields fields={VITRE_PROPS} />
        </>
      ),
      zh: (
        <>
          <p><code>null</code> 表示宿主还不知道，一般是客户端还没读到设置。这时 bezel 保持启动脚本画好的样子，带着 bezel 加载的页面不会闪一下就没了。</p>
          <p><code>&lt;Vitre&gt;</code> 写在 <code>&lt;html&gt;</code> 上的属性被清掉时（React 19 在 hydration 失败后就会这么干），下一帧绘制前就会补回来。</p>
          <Fields fields={VITRE_PROPS} />
        </>
      ),
    },
    code: `<Vitre enabled={settingsLoaded ? wantsBezel : null} … />`,
  },
  {
    id: "band",
    nav: { en: "Band", zh: "边框厚度" },
    eyebrow: "band",
    title: { en: "The band", zh: "Band" },
    lede: {
      en: "The thickness of the bezel's top and bottom edges, in px. The page ends where the band begins, and so do layers that spread BEZEL_INSET.",
      zh: "bezel 上下两条边的厚度，单位 px。页面到 band 为止，展开了 BEZEL_INSET 的图层也一样。",
    },
    body: {
      en: <p>The sides follow the safe area: 0 in portrait, the notch in landscape.</p>,
      zh: <p>左右两边跟随安全区：竖屏为 0，横屏是刘海的宽度。</p>,
    },
    code: `<Vitre band={clampBezelBand(settings.band ?? DEFAULT_BEZEL_BAND)} … />`,
  },
  {
    id: "radius",
    nav: { en: "Radius", zh: "圆角" },
    eyebrow: "radius",
    title: { en: "The corners", zh: "圆角" },
    lede: {
      en: "Rounded inner corners in the bezel colour, the way iOS rounds every app window.",
      zh: "band 内侧的圆角，用 bezel 的颜色画，和 iOS 给每个 App 窗口的圆角一样。",
    },
    code: `<Vitre radius={clampBezelRadius(24)} … />`,
  },
  {
    id: "color",
    nav: { en: "Colour", zh: "颜色" },
    eyebrow: "color",
    title: { en: "Any colour", zh: "任意颜色" },
    lede: {
      en: "Any CSS colour, live. Safari's bars follow every change.",
      zh: "任意 CSS 颜色，实时生效。每次变色，Safari 的状态栏和工具栏都会跟上。",
    },
    body: {
      en: <p>Black is ryOS&apos;s choice and the usual one. On a phone, a saturated colour makes the sync easy to see.</p>,
      zh: <p>黑色是 ryOS 的选择，也最常用。在手机上换个饱和的颜色，更容易看清同步的效果。</p>,
    },
    live: themeColorLive,
  },
  {
    id: "theme",
    nav: { en: "Light & dark", zh: "深浅色" },
    eyebrow: "ground · theme",
    title: { en: "Light and dark", zh: "深色与浅色" },
    lede: {
      en: "ground is the page's own colour, which the chrome shows while the bezel is off. The bezel colour can follow the theme too.",
      zh: "ground 是页面自己的底色，bezel 关着时 chrome 显示它。bezel 的颜色也可以跟着主题走。",
    },
    body: {
      en: <p>Here the <em>Theme</em> colour mode passes the ground as the bezel colour: white in light mode, <code>#1a1a1a</code> in dark. Flipping the theme changes <code>color</code>, and the chrome follows.</p>,
      zh: <p>demo 里的 <em>Theme</em> 颜色模式直接把 ground 当作 bezel 的颜色：浅色是白色，深色是 <code>#1a1a1a</code>。切换主题会改变 <code>color</code>，chrome 跟着变。</p>,
    },
    code: `const ground = dark ? "#1a1a1a" : "#ffffff";
<Vitre color={tint === "theme" ? ground : tint} ground={ground} … />`,
    live: (r) => r && { label: { en: "theme · ground", zh: "主题 · ground" }, value: `${r.theme} · ${String(r.state.ground)}` },
  },
  {
    id: "scroll",
    nav: { en: "Scroll", zh: "滚动" },
    eyebrow: "<Vitre scroll>",
    title: { en: "Where the page scrolls", zh: "页面在哪里滚动" },
    lede: {
      en: "scroll picks the page's scroller: the window, or a container inside the bezel while <html> and <body> hold still. <Vitre> writes the choice to <html>, and everything else reads it there.",
      zh: "scroll 决定谁来滚动页面：window，或者 bezel 里的一个容器，这时 <html> 和 <body> 不动。<Vitre> 把选择写在 <html> 上，其他地方都从那里读。",
    },
    body: {
      en: (
        <>
          <ModeTable />
          <p>Switching keeps the scroll position and notifies page scroll listeners. <code>scroll</code> is independent of <code>enabled</code>, <code>color</code> and <code>band</code>. Use container scroll while the bezel is on.</p>
          <p>Switch the phone to window scroll and scroll it. The toolbar collapses and expands like Safari&apos;s.</p>
          <h3>Window scroll on iOS Safari</h3>
          <ul>
            <li><strong>Edge leak.</strong> Each time the toolbar collapses or expands, up to about 50px of the page shows below the bottom band for about 200ms. Safari is still drawing fixed elements at the old viewport size.</li>
            <li><strong>Live changes.</strong> A toolbar collapse makes Safari sample the edge again. Now and then the chrome ends up on the wrong colour until a reload.</li>
          </ul>
        </>
      ),
      zh: (
        <>
          <ModeTable />
          <p>切换时滚动位置保留，并通知页面的滚动监听。<code>scroll</code> 和 <code>enabled</code>、<code>color</code>、<code>band</code> 互不相干。开着 bezel 时用 container 滚动。</p>
          <p>把手机切到 window 滚动，滚一下，工具栏会像 Safari 一样收起、展开。</p>
          <h3>iOS Safari 上的 window 滚动</h3>
          <ul>
            <li><strong>边缘漏出。</strong>工具栏每次收起或展开，底部 band 下面会漏出最多约 50px 的页面，持续约 200ms，因为这时 Safari 还在按旧的视口尺寸画 fixed 元素。</li>
            <li><strong>实时变更。</strong>工具栏收起会让 Safari 重新取一次边缘的颜色，偶尔会停在错误的颜色上，刷新才恢复。</li>
          </ul>
        </>
      ),
    },
    code: `<Vitre scroll={bezelOn ? "container" : "window"} … />`,
    live: scrollLive,
  },
  {
    id: "statusTap",
    nav: { en: "Status bar", zh: "状态栏" },
    eyebrow: '<Vitre scroll="container">',
    title: { en: "Tap the status bar, back to the top", zh: "点状态栏，回到顶部" },
    lede: {
      en: "On iOS, tapping the status bar takes the page to the top. It still works in container scroll, and the page eases up.",
      zh: "在 iOS 上点状态栏，页面会回到顶部。container 滚动时也一样，页面会平滑地滚回去。",
    },
    body: {
      en: (
        <>
          <p>iOS gives the gesture only to the window&apos;s scroll view. So while the page is away from the top, Vitre parks the window a few pixels down, which nobody sees because <code>&lt;body&gt;</code> is fixed. When Safari scrolls it back to 0, that was the tap. The container then eases to the top in 280–640ms, depending on distance. With reduced motion it jumps, and a touch stops it.</p>
          <p>Container scroll on iOS turns it on, with nothing to call. While a sheet or dialog holds a scroll lock, the tap waits until it closes.</p>
          <p>Click the phone&apos;s status bar to try it.</p>
        </>
      ),
      zh: (
        <>
          <p>iOS 只把这个手势交给 window 的滚动视图。所以页面离开顶部时，窗玻璃把 window 往下挪几个像素（<code>&lt;body&gt;</code> 是 fixed 的，看不出来），等 Safari 把它滚回 0，就知道用户点了状态栏。然后容器按距离在 280–640ms 内滚回顶部。开了减弱动态效果就直接跳过去，手指一碰就停。</p>
          <p>iOS 上用 container 滚动就自带这个功能，什么都不用调。sheet 或对话框锁着滚动时，要等它关掉才生效。</p>
          <p>点一下左边手机的状态栏试试。</p>
        </>
      ),
    },
    live: scrollLive,
  },
  {
    id: "backdrop",
    nav: { en: "Backdrop", zh: "背景层" },
    eyebrow: "backdrop · BEZEL_INSET · VITRE_LAYER_ATTRIBUTE",
    title: { en: "Layers inside the bezel", zh: "bezel 里的图层" },
    lede: {
      en: "backdrop renders behind the page. Spread BEZEL_INSET so a layer stops at the bezel, and mark it with VITRE_LAYER_ATTRIBUTE so it turns absolute in container scroll.",
      zh: "backdrop 画在页面后面。展开 BEZEL_INSET，图层就停在 bezel 边上；再加上 VITRE_LAYER_ATTRIBUTE，container 滚动时它会变成 absolute。",
    },
    code: `backdrop={
  <div
    {...{ [VITRE_LAYER_ATTRIBUTE]: "" }}
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
      en: "iOS 26 Safari reads its chrome colour from the root background only at load, and ignores theme-color. It does follow fixed content at the viewport edge live, from 6px thick.",
      zh: "iOS 26 的 Safari 只在加载时从根背景色取 chrome 的颜色，theme-color 直接无视。但贴着视口边缘、6px 以上的 fixed 内容，它会实时跟随。",
    },
    body: {
      en: (
        <>
          <p>So Vitre shows each change to Safari as a morph. A fixed bezel in the new colour grows from the current band to <code>CHROME_MORPH_PX</code> (160ms), holds while Safari samples it (440ms), and shrinks back (280ms). Each band is its own fixed element, because a transparent container with coloured children doesn&apos;t register. The bands are children of <code>&lt;html&gt;</code>, so they stay fixed in container scroll. <code>theme-color</code> is set too, for iOS 18. <code>&lt;Vitre&gt;</code> calls <code>syncChrome</code> whenever the chrome colour should change.</p>
          <Fields fields={CHROME_SYNC_OPTIONS} />
        </>
      ),
      zh: (
        <>
          <p>所以每次变色，窗玻璃都做一次变形给 Safari 看：新颜色的 fixed bezel 从当前 band 长到 <code>CHROME_MORPH_PX</code>（160ms），停住让 Safari 取色（440ms），再收回去（280ms）。每条 band 都是单独的 fixed 元素，透明容器里套彩色子元素是不行的。它们挂在 <code>&lt;html&gt;</code> 下，container 滚动时依然是 fixed。<code>theme-color</code> 也会顺手设上，给 iOS 18 用。chrome 该变色时，<code>&lt;Vitre&gt;</code> 就会调用 <code>syncChrome</code>。</p>
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
    eyebrow: "vitreBootScript · readVitreBoot",
    title: { en: "The first frame", zh: "第一帧" },
    lede: {
      en: "Safari picks its chrome colour at load, before any component renders. The boot script paints the first frame from your settings: the stylesheet, the <html> attributes and theme-color.",
      zh: "Safari 在加载时就定好了 chrome 的颜色，那时组件还没渲染。启动脚本按你的设置画出第一帧：样式表、<html> 上的属性和 theme-color。",
    },
    body: {
      en: (
        <>
          <p>The resolver is a function body, as source, that returns a <code>VitreBootState</code>. It runs before React and can&apos;t import, so interpolate your constants into it. This demo&apos;s resolver reads the saved devtool settings.</p>
          <Fields fields={BOOT_STATE} />
        </>
      ),
      zh: (
        <>
          <p>resolver 是一段函数体的源码，返回 <code>VitreBootState</code>。它跑在 React 之前，不能 import，常量要直接拼进去。这个 demo 的 resolver 读的是 devtool 存下的设置。</p>
          <Fields fields={BOOT_STATE} />
        </>
      ),
    },
    code: `<script dangerouslySetInnerHTML={{ __html: vitreBootScript(\`
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
      en: "The page scroll API reads and drives the page's scroll wherever it happens. Code written against it works in both modes, across a live switch, and outside React.",
      zh: "页面滚动 API 在页面真正滚动的地方读写滚动。基于它写的代码两种模式都能用，实时切换不出错，React 之外也行。",
    },
    body: {
      en: (
        <>
          <h3>What your page needs</h3>
          <NeedTable />
          <h3>The scroller</h3>
          <p><code>getScrollContainer()</code> returns the container in container scroll, and <code>null</code> in window scroll. <code>null</code> is how the platform names the viewport, as in an IntersectionObserver&apos;s <code>root</code>. Pass it to anything that takes a scroll element, and bind again when the mode changes:</p>
          <Code code={REBIND} />
          <h3>The page</h3>
          <p>The helpers read the mode on every call. Without <code>&lt;Vitre&gt;</code> they act on the window. <code>scrollPageTo</code> takes the platform&apos;s scroll behaviour:</p>
          <Fields fields={SCROLL_PAGE_OPTIONS} />
        </>
      ),
      zh: (
        <>
          <h3>你的页面该用什么</h3>
          <NeedTable />
          <h3>滚动元素</h3>
          <p><code>getScrollContainer()</code> 在 container 滚动时返回容器，window 滚动时返回 <code>null</code>。<code>null</code> 是平台对视口的叫法，IntersectionObserver 的 <code>root</code> 也是这样。把它传给需要滚动元素的地方，模式变了就重新绑定：</p>
          <Code code={REBIND} />
          <h3>页面</h3>
          <p>这些工具函数每次调用都会读当前的模式。没有 <code>&lt;Vitre&gt;</code> 时作用于 window。<code>scrollPageTo</code> 接受平台的滚动行为参数：</p>
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
    nav: { en: "useVitre", zh: "useVitre" },
    eyebrow: "useVitre",
    title: { en: "What Vitre resolved", zh: "窗玻璃解析出的状态" },
    lede: {
      en: "useVitre() returns what Vitre is showing. Outside <Vitre> it returns a disabled default.",
      zh: "useVitre() 返回窗玻璃当前显示的状态。在 <Vitre> 外面，返回一个关闭状态的默认值。",
    },
    body: same(<Fields fields={VITRE_STATE} />),
    live: (r) => r && { label: { en: "useVitre() in the phone", zh: "手机里的 useVitre()" }, value: r.state },
  },
  {
    id: "api",
    nav: { en: "API", zh: "API" },
    eyebrow: "reference",
    title: { en: "Every export", zh: "全部导出" },
    lede: {
      en: "The whole public API. It is type-checked against the package's contract, so no export is missing.",
      zh: "完整的公开 API。它和包的类型契约一起做类型检查，一个导出都不会漏。",
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
      zh: "在 iOS 26.5 模拟器里读截图像素测出来的，也在真机上核对过。",
    },
    body: same(<SafariTable />),
  },
];
