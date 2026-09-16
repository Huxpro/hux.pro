"use client";

// =============================================================================
// Lab strings — both languages, keyed, local to the lab.
//
// The lab is a devtool, so its copy lives beside it rather than in the site
// dictionary (`lib/i18n.ts`), which holds the strings visitors see. Lever
// labels are keyed by the config path they edit (`moon.discSize`), so the
// sections in controls.tsx name a path and nothing else, and the label a
// lever shows can never drift from the field it writes.
// =============================================================================

import { t } from "@/lib/i18n";
import { useLocale } from "@/services";
import { getWeatherConditionLabel, type WeatherCondition } from "@/systems/ambient/lib/weather";
import type { MoonPhaseName } from "@/systems/ambient/lib/solar";
import type { WeatherStyle } from "@/systems/ambient/lib/wallpaper";
import { WEATHER_STYLE_LABEL } from "@/systems/ambient/lib/wallpaper";
import type { SweepScale } from "./model";

const STRINGS = {
  en: {
    title: "sky engine lab",
    booting: "sky engine lab…",
    unsaved: "unsaved",
    changes: (n: number) => `${n} change${n > 1 ? "s" : ""} from committed`,
    active: "active",
    inForce: "tuned config in force on the site",

    // Stage
    engines: "engines — one scene, three renderings; the page behind is the stage",
    engineSky: "Sky · WebGL",
    engineSkyDown: (reason: string) => `Sky · WebGL unavailable (${reason})`,
    engineGradient: "Gradient · CSS fallback",
    engineClassic: (phase: string) => `Classic · ${phase}`,

    // Clock
    clock: "clock — one instant feeds everything below",
    scale: { day: "Day", month: "Month", year: "Year" } as Record<SweepScale, string>,
    scaleHint: {
      day: "00:00 → 24:00 · the sun's arc, twilight, the moon at today's phase",
      month: "30 days at a fixed clock · the moon ~50 min later each day",
      year: "365 days at a fixed clock · the analemma and day-length change",
    } as Record<SweepScale, string>,
    play: "Play",
    pause: "Pause",
    stepBack: "Step back",
    stepForward: "Step forward",
    loop: "Loop",
    loopHint: "Loop the sweep",
    hold: (time: string) => `Hold ${time}`,
    holdHint: "Hold the month and year sweeps — and the analemma — at this time of day",
    now: "Now",
    nowHint: "Back to the real instant",
    held: (time: string, from: string, to: string) => `clock held at ${time} · ${from} → ${to}`,
    keys: "space plays · ← → step",

    // The day
    day: "day — the sky, and the moon's share of it",
    realNow: "The real time of day",
    scrub: "Scrub the day",
    moonTrack: "Moon visibility across the day",
    sunNeverSets: "sun never sets",
    sunNeverRises: "sun never rises",

    // Plots
    dome: "sky dome · azimuth × elevation",
    domeHorizon: "horizon",
    domeNight: "−18° astronomical night",
    screen: "screen space · where it is drawn",
    screenBand: "page content · widget grid",
    legendSun: "sun",
    legendMoon: "moon",
    legendMoonShown: "moon (shown)",
    legendMoonHidden: "moon (staged, hidden)",
    portrait: "portrait",
    landscape: "landscape",
    analemma: "analemma",
    analemmaHint: (time: string) => `${time} · every day of a year`,
    analemmaFooter: (minEl: string, maxEl: string, minAz: string, maxAz: string) =>
      `Elevation ${minEl} → ${maxEl}, azimuth ${minAz} → ${maxAz} at the same clock time.`,
    month: "month · phase and transit height",
    monthPeak: (deg: string) => `peak ${deg}`,
    monthTile: (date: string, lit: number, transit: string) =>
      `${date} · ${lit}% lit · transit ${transit}`,

    // Derived scalars
    scalars: "derived scalars — across the day",
    scalarsNote:
      "Moon visibility is up × sky × clear, and the three are plotted separately above it — a moon that went out has a culprit, not a mystery.",
    series: {
      daylight: ["daylight", "Sun elevation mapped across the twilight window."],
      glow: ["glow", "The keyframed glow strength, after cloud cover mutes it."],
      skyDark: ["sky darkness", "Gate 2 of moon visibility: how dark the sky is, from the sun alone."],
      moonUp: ["moon up", "Gate 1: the moon's elevation."],
      moonClear: ["moon clear", "Gate 3: cloud cover and fog."],
      moonVisible: ["moon visible", "The product of the three gates — what the shader is handed."],
      stars: ["stars", "Night × clear × (1 − moonlight wash)."],
      fog: ["fog", "Profile fog, plus humidity and precipitation."],
      cover: ["cloud cover", "Measured cover, floored by the condition's profile."],
      darkness: ["cloud darkness", "How dark the cloud bases read."],
    } as Record<string, readonly [string, string]>,

    // Phase
    phase: "phase",
    phaseLine: (phase: string, lit: number, elongation: string) =>
      `phase ${phase} · ${lit}% lit · elongation ${elongation}`,
    dialNew: "new",
    dialFull: "full",
    gateUp: "up",
    gateSkyDark: "sky dark",
    gateClear: "clear",
    gateDayMoon: "daytime moon",
    gateVisible: "visible",
    drawnSize: "drawn size",
    moonName: {
      new: "new moon",
      "waxing-crescent": "waxing crescent",
      "first-quarter": "first quarter",
      "waxing-gibbous": "waxing gibbous",
      full: "full moon",
      "waning-gibbous": "waning gibbous",
      "last-quarter": "last quarter",
      "waning-crescent": "waning crescent",
    } as Record<MoonPhaseName, string>,

    // Ephemeris
    ephemerisSun: "ephemeris · sun",
    ephemerisMoon: "ephemeris · moon",
    eph: {
      dayJ2000: "day (J2000)",
      daySchlyter: "day (Schlyter)",
      meanAnomaly: "mean anomaly",
      meanLongitude: "mean longitude",
      eclipticLon: "ecliptic λ",
      eclipticLonLat: "ecliptic λ / β",
      obliquity: "obliquity",
      ra: "right ascension",
      dec: "declination",
      raDec: "right ascension / dec",
      sidereal: "GMST / LST",
      hourAngle: "hour angle",
      elAz: "elevation / azimuth",
      elements: "N / i / w",
      anomalies: "M / E / v",
      arguments: "D / F",
      perturbations: "perturbations λ / β",
      distance: "distance",
      geocentric: "geocentric elevation",
      parallax: "parallax correction",
    },

    // Invariants and references
    invariants: "the one-clock guarantee",
    invOneClock: "One clock",
    invOneClockDetail: (stamp: string) => `sun and moon both from ${stamp}`,
    invPhase: "phase = moon λ − sun λ",
    invPhaseDetail: (a: string, b: string) => `${a} vs scene ${b}`,
    invDayNight: "Day/night from the sun alone",
    invDayNightDetail: (a: string, b: string, el: string, threshold: string) =>
      `${a} and ${b} agree · elevation ${el} > ${threshold}`,
    invNote:
      "Re-derived at this instant and compared with the scene, so these are assertions rather than captions. A moon in a daytime sky is impossible by construction: the condition cannot reach the sun.",
    references: "compared with the literature",
    refNote:
      "Schlyter-grade is a claim until something measures it. Four published constants, recomputed from this repo's ephemeris at load — not from a snapshot of itself.",
    refTitle: (source: string, published: string, measured: string) =>
      `${source} · published ${published}, model ${measured}`,
    ref: {
      newMoon: "New moon, 2000-01-06",
      synodic: (n: number) => `Synodic month (${n} lunations)`,
      obliquity: "Obliquity of the ecliptic",
      distance: "Mean lunar distance",
    },

    // Panel · scene
    scene: "Scene",
    theme: "Theme",
    stage: "Stage",
    stageHint: "what the page behind paints",
    fellBack: "Sky fell back to Gradient (no WebGL2)",
    frame: "Preview frame",
    condition: "Condition",
    asReported: "As reported",
    asReportedHint: "Whatever the API reported",
    cloud: "Cloud cover",
    precip: "Precipitation",
    wind: "Wind",
    kmh: (v: number) => `${Math.round(v)} km/h`,
    backToDerived: (v: string) => `Back to the derived value (${v})`,
    api: "As the API reported it",
    apiCode: "code",
    apiCondition: "condition",
    apiCloud: "cloud",
    apiPrecip: "precip",
    apiWind: "wind",
    apiHumidity: "humidity",
    noWeather: "No live weather — the lab is deriving from the profile defaults.",

    // Panel · observer
    observer: "Observer",
    resolvedHint: "The location the site resolved for you",
    resolved: "Resolved",
    permalink: "Permalink",
    custom: "Custom",
    latitude: "Latitude",
    longitude: "Longitude",
    hemisphere: "Hemisphere",
    north: "North",
    south: "South",
    hemisphereNote:
      "Below the equator the sky mirrors: east moves to the right and the crescent turns over. It is one sign in scene.hemisphere, and the easiest thing in the model to get backwards — so it has a switch.",
    clockNote:
      "The clock stays in your timezone. Moving the observer moves the sky, not the calendar, so a Sydney day here runs from your local midnight and its sunrise lands wherever that puts it — which is exactly what the site does for a visitor who has travelled.",
    scenarios: "Named skies",
    scenario: {
      "full-moon": ["Full moon, clear", "The nearest full moon, at its transit — the night's lantern."],
      "new-moon": ["New moon, clear", "The nearest new moon at midnight — stars with nothing to wash them out."],
      "day-moon": ["Daytime moon", "A gibbous moon well up in an afternoon sky — the quiet daytime gate."],
      "storm-dusk": ["Thunderstorm at dusk", "Sunset under a storm — the tint at its heaviest against the last warmth."],
      "blue-hour": ["Blue hour", "Civil twilight: the keyframes between −6° and 0°, where the ramp is steepest."],
      "polar-night": ["Noon in polar night", "Midday with the sun below the horizon — only meaningful far enough north."],
    } as Record<string, readonly [string, string]>,

    // Panel · presets
    presets: "Presets",
    editing: (id: string) => `editing ${id}`,
    activeHint: "The preset the site paints from",
    newPreset: "New preset name",
    add: "Add",
    addHint: "Save the current config as a new preset",
    makeActive: "Make active",
    makeActiveHint: "Paint the site from this preset",
    activeOnSite: "Active on the site",
    delete: "Delete",
    presetsNote:
      "Presets live in the same content/sky.json. The site paints from the active one; editing any other preset changes nothing until you make it active. The default preset is the shipped look and cannot be removed.",
    presetAdded: (name: string) => `Preset "${name}" added — save to commit it`,

    // Panel · sun
    sun: "Sun — the clear-sky ramp and the day",
    ramp: "horizon colour by sun elevation",
    keyEl: "el",
    keyZenith: "zen",
    keyHorizon: "hor",
    keyGlow: "glow",
    keyStrength: "str",
    keyframe: (i: number) => `Keyframe ${i}`,
    keysNote:
      "Keys are re-sorted by elevation when the config is saved. Between two of them the sky is a smoothstep, which is why the interesting ones crowd around the horizon.",
    thresholdsNote:
      "The one day/night decision, and the window the daylight factor ramps across. Everything that says “day” — icons, palettes, chips — reads the first of these and nothing else.",
    sunShader: "Sun — the disc and its glow",

    // Panel · moon
    moon: "Moon — the disc",
    moonNote:
      "Halo scales with the illuminated fraction and is painted in front of the disc, so it covers the dark side instead of outlining it. Earthshine is deliberately a whisper: any more and a crescent reads as a grey ball.",
    moonGates: "Moon — the three gates",
    moonGatesNote:
      "Visibility is the product: up × sky × clear. Each of the three is plotted as a sparkline, so a moon that vanished has a culprit.",
    dayMoon: "Moon — by day",
    dayMoonNote:
      "A crescent near the sun is invisible by day — in the sky and here. Well up and far enough round, it shows as a pale disc.",
    moonlight: "Moonlight",
    from: "from",
    to: "to",
    gateNote: "0 at from, 1 at to",

    // Panel · stars
    stars: "Stars",
    starsNote:
      "Density scales the share of shader cells that hold a star, so 0 empties the field and 1 is the shipped one. The night gate runs downwards — from is the brighter elevation.",

    // Panel · clouds
    profile: (condition: string) => `Profile · ${condition}`,
    profileNote:
      "The six conditions each carry defaults for when the API gives nothing, a floor for when it does, and a tint that takes the clear sky over as cover grows. Force a condition above to edit its row.",
    tintDay: "Day tint · zenith / horizon",
    tintNight: "Night tint · zenith / horizon",
    tintDayZenith: "Day zenith tint",
    tintDayHorizon: "Day horizon tint",
    tintNightZenith: "Night zenith tint",
    tintNightHorizon: "Night horizon tint",
    cover: "Clouds — how cover behaves",
    windDrift: "Clouds — wind and drift",
    lighting: "Clouds — lighting",
    litTops: "Lit tops · day / night",
    litDay: "Lit tops by day",
    litNight: "Lit tops at night",
    shadeDay: "Shade by day · calm / storm",
    shadeDayCalm: "Daytime shade, calm",
    shadeDayStorm: "Daytime shade, stormy",
    shadeNight: "Shade at night · calm / storm",
    shadeNightCalm: "Night shade, calm",
    shadeNightStorm: "Night shade, stormy",

    // Panel · veil
    veil: "Veil — per theme",
    veilColor: (theme: string) => `${theme} veil colour`,
    veilNote:
      "The Sky mixes its veil inside the shader; the CSS engines add a little more on top (they have no cloud texture to carry the colour). The Legibility Lab is where the veil is judged against text.",

    // Panel · staging
    staging: "Camera — the frame",
    stagingNote:
      "The stage was designed for both orientations. The preview tiles and the screen-space plot change shape together.",
    moonStage: "Camera — the moon's stage",
    moonStageNote:
      "Where the moon is is never bent. This is only where it is drawn — and the screen-space plot redraws with every one of these, so the change is visible as a change of path before it is a change of picture.",
    shader: "Camera — shader framing",
    shaderNote: "Only the Sky engine reads these. The Gradient and Classic renderings beside it will not move.",

    // Export
    export: "Export",
    save: "Save",
    saving: "Saving…",
    saveHint: "Write content/sky.json (dev only)",
    copyJson: "Copy JSON",
    copyLink: "Copy link",
    resetCommitted: "Back to committed",
    resetDefaults: "Built-in defaults",
    resetAll: "Reset all",
    exportNote:
      "Save writes content/sky.json, which the site imports at build; commit it. Until then the tuned config stays in force on every route — check it on the home screen — and Reset all puts the site back. pnpm sky:check fails if the file stops normalising cleanly.",
    saved: (active: string) => `Saved content/sky.json · active "${active}"`,
    saveFailed: "Save failed",
    copied: (what: string) => `${what} copied`,
    clipboardUnavailable: "Clipboard unavailable",
    resetDefaultsToast: "Reset to the built-in defaults (not yet saved)",
    backTo: (v: string | number) => `Back to ${v}`,
    backToDefault: (v: string | number) => `Back to the committed value (${v})`,
    what: "What this is",
    whatNote:
      "/editor/sky is a consumer of systems/ambient/lib, never a fork of it. Every lever above is a field of the SkyConfig that deriveWeatherScene, stageMoon and the shader take as input; the page behind you is the site's own wallpaper painting this scene.",
  },
  zh: {
    title: "天空引擎实验室",
    booting: "天空引擎实验室…",
    unsaved: "未保存",
    changes: (n: number) => `${n} 项与已提交不同`,
    active: "生效",
    inForce: "调校后的配置正作用于整站",

    engines: "引擎 — 同一场景的三种渲染；页面背后即舞台",
    engineSky: "Sky · WebGL",
    engineSkyDown: (reason: string) => `Sky · WebGL 不可用（${reason}）`,
    engineGradient: "Gradient · CSS 回退",
    engineClassic: (phase: string) => `Classic · ${phase}`,

    clock: "时钟 — 一个瞬间驱动下面的一切",
    scale: { day: "日", month: "月", year: "年" } as Record<SweepScale, string>,
    scaleHint: {
      day: "00:00 → 24:00 · 太阳的弧线、暮光、今天相位的月亮",
      month: "固定时刻的 30 天 · 月亮每天晚约 50 分钟",
      year: "固定时刻的 365 天 · 日行迹与昼长变化",
    } as Record<SweepScale, string>,
    play: "播放",
    pause: "暂停",
    stepBack: "后退一步",
    stepForward: "前进一步",
    loop: "循环",
    loopHint: "循环播放",
    hold: (time: string) => `固定在 ${time}`,
    holdHint: "把月、年扫描（以及日行迹）固定在这个时刻",
    now: "现在",
    nowHint: "回到真实的此刻",
    held: (time: string, from: string, to: string) => `时刻固定在 ${time} · ${from} → ${to}`,
    keys: "空格播放 · ← → 步进",

    day: "一天 — 天空，以及月亮占的那一份",
    realNow: "真实的当前时刻",
    scrub: "拖动一天",
    moonTrack: "一天中的月亮可见度",
    sunNeverSets: "极昼",
    sunNeverRises: "极夜",

    dome: "天球 · 方位角 × 高度角",
    domeHorizon: "地平线",
    domeNight: "−18° 天文夜",
    screen: "屏幕空间 · 画在哪里",
    screenBand: "页面内容 · 小组件网格",
    legendSun: "太阳",
    legendMoon: "月亮",
    legendMoonShown: "月亮（显示）",
    legendMoonHidden: "月亮（已布景、隐藏）",
    portrait: "竖屏",
    landscape: "横屏",
    analemma: "日行迹",
    analemmaHint: (time: string) => `${time} · 一年中的每一天`,
    analemmaFooter: (minEl: string, maxEl: string, minAz: string, maxAz: string) =>
      `同一时刻：高度角 ${minEl} → ${maxEl}，方位角 ${minAz} → ${maxAz}。`,
    month: "一月 · 相位与中天高度",
    monthPeak: (deg: string) => `最高 ${deg}`,
    monthTile: (date: string, lit: number, transit: string) =>
      `${date} · 亮面 ${lit}% · 中天 ${transit}`,

    scalars: "派生量 — 一天之内",
    scalarsNote: "月亮可见度 = 升起 × 天暗 × 无云，三者分别画在上方 — 月亮消失时有原因可查，而不是谜。",
    series: {
      daylight: ["日光", "太阳高度角映射到暮光窗口。"],
      glow: ["辉光", "关键帧的辉光强度，经云量压低后。"],
      skyDark: ["天暗", "月亮可见度的第二道门：只由太阳决定的天空暗度。"],
      moonUp: ["月亮升起", "第一道门：月亮的高度角。"],
      moonClear: ["月亮无遮", "第三道门：云量与雾。"],
      moonVisible: ["月亮可见", "三道门的乘积 — 交给着色器的数。"],
      stars: ["星星", "夜 × 无云 × (1 − 月光冲淡)。"],
      fog: ["雾", "画像的雾，加上湿度与降水。"],
      cover: ["云量", "测得的云量，以条件画像为下限。"],
      darkness: ["云底暗度", "云底看起来有多暗。"],
    } as Record<string, readonly [string, string]>,

    phase: "相位",
    phaseLine: (phase: string, lit: number, elongation: string) =>
      `相位 ${phase} · 亮面 ${lit}% · 距角 ${elongation}`,
    dialNew: "朔",
    dialFull: "望",
    gateUp: "升起",
    gateSkyDark: "天暗",
    gateClear: "无遮",
    gateDayMoon: "白昼月",
    gateVisible: "可见",
    drawnSize: "绘制大小",
    moonName: {
      new: "新月",
      "waxing-crescent": "娥眉月",
      "first-quarter": "上弦月",
      "waxing-gibbous": "盈凸月",
      full: "满月",
      "waning-gibbous": "亏凸月",
      "last-quarter": "下弦月",
      "waning-crescent": "残月",
    } as Record<MoonPhaseName, string>,

    ephemerisSun: "历表 · 太阳",
    ephemerisMoon: "历表 · 月亮",
    eph: {
      dayJ2000: "日数（J2000）",
      daySchlyter: "日数（Schlyter）",
      meanAnomaly: "平近点角",
      meanLongitude: "平黄经",
      eclipticLon: "黄经 λ",
      eclipticLonLat: "黄经 λ / 黄纬 β",
      obliquity: "黄赤交角",
      ra: "赤经",
      dec: "赤纬",
      raDec: "赤经 / 赤纬",
      sidereal: "GMST / LST",
      hourAngle: "时角",
      elAz: "高度角 / 方位角",
      elements: "N / i / w",
      anomalies: "M / E / v",
      arguments: "D / F",
      perturbations: "摄动 λ / β",
      distance: "距离",
      geocentric: "地心高度角",
      parallax: "视差修正",
    },

    invariants: "单一时钟的保证",
    invOneClock: "同一个时钟",
    invOneClockDetail: (stamp: string) => `太阳与月亮都来自 ${stamp}`,
    invPhase: "相位 = 月亮 λ − 太阳 λ",
    invPhaseDetail: (a: string, b: string) => `${a}，场景 ${b}`,
    invDayNight: "昼夜只由太阳决定",
    invDayNightDetail: (a: string, b: string, el: string, threshold: string) =>
      `${a} 与 ${b} 一致 · 高度角 ${el} > ${threshold}`,
    invNote: "在这一瞬间重新推导并与场景比对，所以这些是断言而非说明。白天天空里的月亮在构造上不可能：天气条件碰不到太阳。",
    references: "与文献比对",
    refNote: "“Schlyter 级精度”在被测量之前只是一句话。四个已发表的常数，在加载时由本仓库的历表重新算出 — 而不是与自己的快照比。",
    refTitle: (source: string, published: string, measured: string) =>
      `${source} · 文献 ${published}，模型 ${measured}`,
    ref: {
      newMoon: "新月，2000-01-06",
      synodic: (n: number) => `朔望月（${n} 个朔望周期）`,
      obliquity: "黄赤交角",
      distance: "月球平均距离",
    },

    scene: "场景",
    theme: "主题",
    stage: "舞台",
    stageHint: "页面背后用哪个引擎绘制",
    fellBack: "Sky 已回退到 Gradient（无 WebGL2）",
    frame: "预览画幅",
    condition: "天气条件",
    asReported: "按 API 报告",
    asReportedHint: "API 报告的是什么就是什么",
    cloud: "云量",
    precip: "降水",
    wind: "风",
    kmh: (v: number) => `${Math.round(v)} km/h`,
    backToDerived: (v: string) => `恢复为推导值（${v}）`,
    api: "API 报告的原始数据",
    apiCode: "代码",
    apiCondition: "条件",
    apiCloud: "云量",
    apiPrecip: "降水",
    apiWind: "风",
    apiHumidity: "湿度",
    noWeather: "没有实时天气 — 实验室正按画像默认值推导。",

    observer: "观测者",
    resolvedHint: "站点为你解析出的位置",
    resolved: "已解析",
    permalink: "链接",
    custom: "自定义",
    latitude: "纬度",
    longitude: "经度",
    hemisphere: "半球",
    north: "北",
    south: "南",
    hemisphereNote: "赤道以南天空镜像：东在右边，月牙翻转。它只是 scene.hemisphere 里的一个符号，也是模型里最容易弄反的东西 — 所以给它一个开关。",
    clockNote: "时钟始终是你的时区。移动观测者移动的是天空，不是日历，所以这里的悉尼一天从你的本地午夜开始，日出落在它该落的地方 — 站点对一位旅行中的访客正是这样做的。",
    scenarios: "命名天空",
    scenario: {
      "full-moon": ["满月，晴", "最近的满月，在中天 — 夜的灯笼。"],
      "new-moon": ["新月，晴", "最近的新月，午夜 — 没有什么冲淡星星。"],
      "day-moon": ["白昼月", "午后高挂的凸月 — 安静的白昼门。"],
      "storm-dusk": ["黄昏雷暴", "暴风雨下的日落 — 最重的着色对着最后的暖光。"],
      "blue-hour": ["蓝调时刻", "民用暮光：−6° 到 0° 之间的关键帧，斜率最陡的一段。"],
      "polar-night": ["极夜正午", "太阳在地平线下的正午 — 只在足够北的地方才有意义。"],
    } as Record<string, readonly [string, string]>,

    presets: "预设",
    editing: (id: string) => `编辑 ${id}`,
    activeHint: "站点绘制所用的预设",
    newPreset: "新预设名",
    add: "添加",
    addHint: "把当前配置存为新预设",
    makeActive: "设为生效",
    makeActiveHint: "让站点从这个预设绘制",
    activeOnSite: "站点正在使用",
    delete: "删除",
    presetsNote: "预设都存在同一个 content/sky.json 里。站点从生效的那个绘制；编辑其他预设在设为生效前不会改变任何东西。default 是出厂外观，不能删除。",
    presetAdded: (name: string) => `已添加预设“${name}” — 保存以提交`,

    sun: "太阳 — 晴空色阶与白天",
    ramp: "按太阳高度角的地平线颜色",
    keyEl: "高度",
    keyZenith: "天顶",
    keyHorizon: "地平",
    keyGlow: "辉光",
    keyStrength: "强度",
    keyframe: (i: number) => `关键帧 ${i}`,
    keysNote: "保存时关键帧按高度角重新排序。两帧之间是 smoothstep，所以有意思的帧都挤在地平线附近。",
    thresholdsNote: "唯一的昼夜判定，以及日光系数爬升的窗口。所有说“白天”的东西 — 图标、调色板、标签 — 只读第一个数。",
    sunShader: "太阳 — 日盘与辉光",

    moon: "月亮 — 月盘",
    moonNote: "光晕随亮面比例缩放，画在月盘前面，因而盖住暗面而不是勾出一个黑洞。地照刻意只是一丝：再多，月牙就成了灰球。",
    moonGates: "月亮 — 三道门",
    moonGatesNote: "可见度是乘积：升起 × 天暗 × 无遮。三者各有一条走势线，月亮消失时有原因可查。",
    dayMoon: "月亮 — 白天",
    dayMoonNote: "靠近太阳的月牙白天看不见 — 天上如此，这里也如此。足够高、足够远，就显成一枚淡淡的圆盘。",
    moonlight: "月光",
    from: "起",
    to: "止",
    gateNote: "起处为 0，止处为 1",

    stars: "星星",
    starsNote: "密度缩放着色器中含星格子的比例，0 清空星野，1 是出厂值。夜门向下走 — 起处是更亮的高度角。",

    profile: (condition: string) => `画像 · ${condition}`,
    profileNote: "六种条件各有一套：API 没给时的默认值、给了时的下限，以及随云量接管晴空的着色。在上方强制某个条件以编辑它那一行。",
    tintDay: "白天着色 · 天顶 / 地平",
    tintNight: "夜晚着色 · 天顶 / 地平",
    tintDayZenith: "白天天顶着色",
    tintDayHorizon: "白天地平着色",
    tintNightZenith: "夜晚天顶着色",
    tintNightHorizon: "夜晚地平着色",
    cover: "云 — 云量如何起作用",
    windDrift: "云 — 风与漂移",
    lighting: "云 — 光照",
    litTops: "受光云顶 · 白天 / 夜晚",
    litDay: "白天受光云顶",
    litNight: "夜晚受光云顶",
    shadeDay: "白天阴影 · 平静 / 风暴",
    shadeDayCalm: "白天阴影，平静",
    shadeDayStorm: "白天阴影，风暴",
    shadeNight: "夜晚阴影 · 平静 / 风暴",
    shadeNightCalm: "夜晚阴影，平静",
    shadeNightStorm: "夜晚阴影，风暴",

    veil: "遮罩 — 按主题",
    veilColor: (theme: string) => `${theme}遮罩颜色`,
    veilNote: "Sky 在着色器内混合遮罩；CSS 引擎在其上再加一点（它们没有云的纹理来承载颜色）。遮罩对文字的效果在可读性实验室里评判。",

    staging: "相机 — 画幅",
    stagingNote: "布景为两种方向设计。预览块与屏幕空间图一起变形。",
    moonStage: "相机 — 月亮的舞台",
    moonStageNote: "月亮在哪里从不被扭曲。这里只是它画在哪里 — 屏幕空间图随每一个数重绘，改动先表现为路径的变化，再表现为画面的变化。",
    shader: "相机 — 着色器取景",
    shaderNote: "只有 Sky 引擎读这些。旁边的 Gradient 与 Classic 不会动。",

    export: "导出",
    save: "保存",
    saving: "保存中…",
    saveHint: "写入 content/sky.json（仅开发环境）",
    copyJson: "复制 JSON",
    copyLink: "复制链接",
    resetCommitted: "恢复已提交",
    resetDefaults: "内置默认",
    resetAll: "全部重置",
    exportNote: "保存写入 content/sky.json，站点在构建时导入它；记得提交。在此之前，调校后的配置作用于每个路由 — 去首页看看 — “全部重置”让站点复原。pnpm sky:check 会在文件不再干净归一化时失败。",
    saved: (active: string) => `已保存 content/sky.json · 生效“${active}”`,
    saveFailed: "保存失败",
    copied: (what: string) => `已复制${what}`,
    clipboardUnavailable: "剪贴板不可用",
    resetDefaultsToast: "已恢复内置默认（尚未保存）",
    backTo: (v: string | number) => `恢复为 ${v}`,
    backToDefault: (v: string | number) => `恢复为已提交的值（${v}）`,
    what: "这是什么",
    whatNote: "/editor/sky 只是 systems/ambient/lib 的消费者，不是分叉。上面每个杆都是 SkyConfig 的一个字段，deriveWeatherScene、stageMoon 与着色器以它为输入；你身后的页面就是站点自己的壁纸在绘制这个场景。",
  },
} as const;

export type LabStrings = (typeof STRINGS)["en"];

// -----------------------------------------------------------------------------
// Lever labels, keyed by the config path they edit
// -----------------------------------------------------------------------------

type Pair = readonly [en: string, zh: string];

const KNOBS: Record<string, Pair> = {
  // sun
  "sun.dayElevationDeg": ["Day threshold", "昼夜阈值"],
  "sun.twilightFloorDeg": ["Twilight floor", "暮光下限"],
  "sun.twilightCeilDeg": ["Twilight ceiling", "暮光上限"],
  "sun.coverFade": ["Cloud mutes the glow", "云压低辉光"],
  "sun.discSize": ["Disc size", "日盘大小"],
  "sun.glowRadiusHigh": ["Glow radius, high sun", "辉光半径 · 高日"],
  "sun.glowRadiusLow": ["Glow radius, low sun", "辉光半径 · 低日"],
  "sun.glowGain": ["Glow gain", "辉光增益"],
  "sun.horizonBand": ["Horizon band", "地平暖带"],
  // moon
  "moon.discSize": ["Disc size", "月盘大小"],
  "moon.illusionScale": ["Moon illusion", "月亮错觉"],
  "moon.illusionFadeDeg": ["Illusion fades by", "错觉消退于"],
  "moon.haloStrength": ["Halo", "光晕"],
  "moon.earthshine": ["Earthshine", "地照"],
  "moon.terminatorSoftness": ["Terminator softness", "明暗界线柔度"],
  "moon.up": ["Up (moon elevation)", "升起（月亮高度角）"],
  "moon.skyDark": ["Dark sky (sun elevation)", "天暗（太阳高度角）"],
  "moon.cover": ["Cloud cover", "云量"],
  "moon.fogGate": ["Fog hides it", "雾遮蔽"],
  "moon.day.elevation": ["Elevation", "高度角"],
  "moon.day.elongation": ["Elongation from the sun", "与太阳的距角"],
  "moon.day.strength": ["Daytime strength", "白昼强度"],
  "moon.light.rise": ["Reaches full by", "满强度于"],
  "moon.light.zenithAmount": ["Lifts the zenith", "提亮天顶"],
  "moon.light.horizonAmount": ["Lifts the horizon", "提亮地平"],
  "moon.light.cloudAmount": ["Lifts the cloud tops", "提亮云顶"],
  "moon.light.starWash": ["Washes out the stars", "冲淡星星"],
  "moon.light.zenithColor": ["Moonlit zenith", "月光天顶"],
  "moon.light.horizonColor": ["Moonlit horizon", "月光地平"],
  "moon.light.cloudColor": ["Moonlit cloud tops", "月光云顶"],
  // stars
  "stars.density": ["Density", "密度"],
  "stars.twinkle": ["Twinkle", "闪烁"],
  "stars.night": ["Night gate (sun elevation)", "夜门（太阳高度角）"],
  "stars.cover": ["Cloud cover", "云量"],
  // clouds
  "clouds.tintCover": ["Cover that brings the tint in", "引入着色的云量"],
  "clouds.horizonTintRatio": ["Horizon keeps more clear sky", "地平保留更多晴空"],
  "clouds.darknessFromPrecip": ["Darkness from precipitation", "降水加深"],
  "clouds.darknessFromCover": ["Darkness from extra cover", "多余云量加深"],
  "clouds.windScaleKmh": ["Full drift at", "满速漂移于"],
  "clouds.defaultWindKmh": ["Assumed wind", "假定风速"],
  "clouds.speedBase": ["Drift at zero wind", "无风漂移"],
  "clouds.speedGain": ["Drift from wind", "风致漂移"],
  // profile rows (suffixes)
  "profile.cover": ["Cover (no measurement)", "云量（无测量时）"],
  "profile.coverMin": ["Cover floor", "云量下限"],
  "profile.density": ["Density", "密度"],
  "profile.darkness": ["Darkness", "暗度"],
  "profile.precip": ["Precipitation", "降水"],
  "profile.fog": ["Fog", "雾"],
  "profile.tintAmount": ["Tint amount", "着色量"],
  // veil
  "veil.amount": ["Amount", "量"],
  "veil.exposure": ["Exposure", "曝光"],
  // staging
  "staging.horizonY": ["Horizon y", "地平线 y"],
  "staging.sunArc": ["Sun arc height", "太阳弧高"],
  "staging.azimuthSpan": ["East → west span", "东 → 西跨度"],
  "staging.azimuthMargin": ["Left margin", "左边距"],
  "staging.moon.rise": ["y at the horizon", "地平线处 y"],
  "staging.moon.low": ["y once properly up", "升起后 y"],
  "staging.moon.high": ["y at the top", "顶端 y"],
  "staging.moon.topAtDeg": ["Reaches the top at", "到顶于"],
  "staging.moon.riseGate": ["Climbs from horizon to low", "从地平线爬到低位"],
  "staging.moon.xMin": ["x min", "x 最小"],
  "staging.moon.xMax": ["x max", "x 最大"],
  "staging.shader.horizonCurve": ["Horizon curve", "地平曲线"],
  "staging.shader.cloudScaleFar": ["Far deck scale", "远层云尺度"],
  "staging.shader.cloudScaleNear": ["Near deck scale", "近层云尺度"],
  "staging.shader.cloudParallaxFar": ["Far deck parallax", "远层云视差"],
  "staging.shader.cloudParallaxNear": ["Near deck parallax", "近层云视差"],
};

/** A per-condition profile path (`clouds.profiles.rain.cover`) → its row key. */
function knobKey(path: string): string {
  const m = /^clouds\.profiles\.[a-z]+\.(.+)$/.exec(path);
  if (m) return `profile.${m[1]}`;
  const v = /^veil\.(?:light|dark)\.(amount|exposure)$/.exec(path);
  if (v) return `veil.${v[1]}`;
  return path;
}

export function useLabText() {
  const { locale } = useLocale();
  const L = STRINGS[locale] as LabStrings;
  const zh = locale === "zh";
  return {
    locale,
    L,
    /** The label a lever shows, from the path it edits. */
    knob: (path: string) => {
      const pair = KNOBS[knobKey(path)];
      return pair ? pair[zh ? 1 : 0] : path;
    },
    // The site's own names for its settings, so the lab never shows a second one.
    themeName: (theme: "light" | "dark") => t(locale, theme === "dark" ? "themeDark" : "themeLight"),
    styleName: (style: WeatherStyle) => t(locale, WEATHER_STYLE_LABEL[style]),
    conditionName: (condition: WeatherCondition) =>
      zh ? getWeatherConditionLabel(condition, locale) : condition,
  };
}

export type LabText = ReturnType<typeof useLabText>;
