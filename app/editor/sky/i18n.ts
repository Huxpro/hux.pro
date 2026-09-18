"use client";

// =============================================================================
// Sky Engine Lab strings — both languages, keyed, local to the lab.
//
// The lab is a workbench, so its copy lives beside it rather than in the site
// dictionary (`lib/i18n.ts`), which holds the strings visitors see. Same shape
// as the Legibility Lab's `i18n.ts`.
//
// Anything the *site* already has a name for is asked for rather than
// re-translated: conditions come from `getWeatherConditionLabel`, phases from
// `getAmbientPhaseLabel`, the moon's eight faces from `getMoonPhaseLabel`. A
// lab that invents a second name for "满月" is a lab that can disagree with
// the thing it is inspecting.
//
// Keys that name a config field are keyed by the field's own path, so
// `controls.tsx` stays the single source of the levers themselves.
// =============================================================================

import { useLocale } from "@/services";
import { getAmbientPhaseLabel } from "@/systems/ambient/lib/phase";
import {
  getMoonPhaseLabel,
  getMoonPhaseName,
} from "@/systems/ambient/lib/solar";
import { getWeatherConditionLabel } from "@/systems/ambient/lib/weather";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";
import type { AmbientPhase } from "@/systems/ambient/lib/phase";

const STRINGS = {
  en: {
    booting: "sky engine lab…",

    // --- Toolbar ---------------------------------------------------------
    active: "active",
    unsaved: "unsaved",
    json: "JSON",
    link: "Link",
    reset: "Reset",
    save: "Save",
    saving: "Saving…",
    configJson: "Config JSON",
    permalink: "Permalink",
    copied: (what: string) => `${what} copied`,
    clipboardUnavailable: "Clipboard unavailable",
    saveFailed: "Save failed",
    savedToast: (id: string) => `Saved content/sky.json · active “${id}”`,
    resetToast: "Reset to the built-in defaults (not yet saved)",
    presetAdded: (name: string) => `Preset “${name}” added — save to commit it`,
    editingPreset: (id: string) => `editing ${id}`,

    // --- Engines ---------------------------------------------------------
    engines: "Engines · one scene, three renderings",
    light: "Light",
    dark: "Dark",
    engineSky: "Sky · WebGL",
    engineSkyUnavailable: (reason: string) => ` — unavailable (${reason})`,
    engineGradient: "Gradient · CSS fallback",
    engineClassic: (phase: string) => `Classic · ${phase}`,

    // --- The clock -------------------------------------------------------
    scaleDay: "Day",
    scaleMonth: "Month",
    scaleYear: "Year",
    hintDay: "00:00 → 24:00 · the sun's arc, twilight, the moon at today's phase",
    hintMonth: "30 days at a fixed clock · the moon ~50 min later each day",
    hintYear: "365 days at a fixed clock · the analemma and day-length change",
    play: "Play",
    pause: "Pause",
    stepBack: "Step back",
    stepForward: "Step forward",
    loop: "Loop",
    loopTitle: "Loop the sweep",
    now: "Now",
    nowTitle: "Back to the real instant",
    hold: (clock: string) => `Hold ${clock}`,
    holdTitle:
      "Hold the month and year sweeps — and the analemma — at this time of day",
    scrubber: (scale: string) => `${scale} scrubber`,
    clockHeld: (clock: string, from: string, to: string) =>
      `clock held at ${clock} · ${from} → ${to}`,

    // --- The day timeline -------------------------------------------------
    dayTimeline: "Day · sky and moon visibility",
    moonTrack: "Moon visibility across the day",
    scrubDay: "Scrub the day",
    realTimeOfDay: "The real time of day",
    sunNeverSets: "sun never sets",
    sunNeverRises: "sun never rises",

    // --- Plots ------------------------------------------------------------
    domeTitle: "Sky dome · azimuth × elevation",
    screenTitle: "Screen space · where it is drawn",
    horizon: "horizon",
    astronomicalNight: "−18° astronomical night",
    sun: "sun",
    moon: "moon",
    moonShown: "moon (shown)",
    moonStaged: "moon (staged, hidden)",
    contentBand: "page content · widget grid",
    portrait: "portrait",
    landscape: "landscape",
    analemma: "Analemma",
    analemmaHint: (clock: string) => `${clock} · every day of a year`,
    analemmaFooter: (elFrom: string, elTo: string, azFrom: string, azTo: string) =>
      `Elevation ${elFrom} → ${elTo}, azimuth ${azFrom} → ${azTo} at the same clock time.`,
    monthTitle: "Month · phase and transit height",
    monthPeak: (deg: string) => `peak ${deg}`,
    monthTile: (date: string, lit: number, transit: string) =>
      `${date} · ${lit}% lit · transit ${transit}`,
    phaseDial: "Moon phase dial",
    dialNew: "new",
    dialFull: "full",
    dialSummary: (phase: string, lit: number, elongation: string) =>
      `phase ${phase} · ${lit}% lit · elongation ${elongation}`,

    // --- Derived scalars ---------------------------------------------------
    derivedScalars: "Derived scalars · across the day",
    seriesDaylight: "daylight",
    seriesGlow: "glow",
    seriesSkyDark: "sky darkness",
    seriesMoonUp: "moon up",
    seriesMoonClear: "moon clear",
    seriesMoonVisible: "moon visible",
    seriesStars: "stars",
    seriesFog: "fog",
    seriesCover: "cloud cover",
    seriesCloudDark: "cloud darkness",
    whyDaylight: "Sun elevation mapped across the twilight window.",
    whyGlow: "The keyframed glow strength, after cloud cover mutes it.",
    whySkyDark:
      "Gate 2 of moon visibility: how dark the sky is, from the sun alone.",
    whyMoonUp: "Gate 1: the moon's elevation.",
    whyMoonClear: "Gate 3: cloud cover and fog.",
    whyMoonVisible:
      "The product of the three gates — what the shader is handed.",
    whyStars: "Night × clear × (1 − moonlight wash).",
    whyFog: "Profile fog, plus humidity and precipitation.",
    whyCover: "Measured cover, floored by the condition's profile.",
    whyCloudDark: "How dark the cloud bases read.",
    sparkNote:
      "Moon visibility is up × sky × clear, and the three are plotted separately above it — a moon that went out has a culprit, not a mystery.",

    // --- Phase panel -------------------------------------------------------
    phase: "Phase",
    gateUp: "up",
    gateSkyDark: "sky dark",
    gateClear: "clear",
    gateDayMoon: "daytime moon",
    gateVisible: "visible",
    drawnSize: "drawn size",

    // --- Ephemeris ---------------------------------------------------------
    ephemerisSun: "Ephemeris · sun",
    ephemerisMoon: "Ephemeris · moon",
    dayJ2000: "day (J2000)",
    daySchlyter: "day (Schlyter)",
    meanAnomaly: "mean anomaly",
    meanLongitude: "mean longitude",
    eclipticLon: "ecliptic λ",
    obliquity: "obliquity",
    rightAscension: "right ascension",
    declination: "declination",
    siderealTime: "GMST / LST",
    hourAngle: "hour angle",
    elevationAzimuth: "elevation / azimuth",
    orbitalElements: "N / i / w",
    anomalies: "M / E / v",
    elongationArgument: "D / F",
    perturbations: "perturbations λ / β",
    eclipticLonLat: "ecliptic λ / β",
    distance: "distance",
    raDec: "right ascension / dec",
    geocentricElevation: "geocentric elevation",
    parallaxCorrection: "parallax correction",

    // --- Invariants --------------------------------------------------------
    oneClock: "The one-clock guarantee",
    invOneClock: "One clock",
    invOneClockDetail: (stamp: string) => `sun and moon both from ${stamp}`,
    invPhase: "phase = moon λ − sun λ",
    invPhaseDetail: (derived: string, scene: string) =>
      `${derived} vs scene ${scene}`,
    invDayNight: "Day/night from the sun alone",
    invDayNightDetail: (a: string, b: string, el: string, threshold: string) =>
      `${a} and ${b} agree · elevation ${el} > ${threshold}`,
    invariantsNote:
      "Re-derived at this instant and compared with the scene, so these are assertions rather than captions. A moon in a daytime sky is impossible by construction: the condition cannot reach the sun.",

    // --- References --------------------------------------------------------
    references: "Compared with the literature",
    refNewMoon: "New moon, 2000-01-06",
    refNewMoonSource: "Meeus, lunation 0",
    refSynodic: (n: number) => `Synodic month (${n} lunations)`,
    refSynodicSource: "IAU mean value",
    refObliquity: "Obliquity of the ecliptic",
    refObliquitySource: "J2000.0 — peak solar declination",
    refDistance: "Mean lunar distance",
    refDistanceSource: "IAU, centre to centre",
    refRowTitle: (source: string, published: string, measured: string) =>
      `${source} · published ${published}, model ${measured}`,
    referencesNote:
      "Schlyter-grade is a claim until something measures it. Four published constants, recomputed from this repo's ephemeris at load — not from a snapshot of itself.",

    // --- Presets panel ------------------------------------------------------
    presets: "Presets",
    newPresetName: "New preset name",
    add: "Add",
    addTitle: "Save the current config as a new preset",
    activeOnSite: "Active on the site",
    makeActive: "Make active",
    makeActiveTitle: "Paint the site from this preset",
    thePresetTheSitePaints: "The preset the site paints from",
    deletePreset: "Delete",
    presetsNote:
      "Presets live in the same `content/sky.json`. The site paints from the active one; editing any other preset changes nothing until you make it active. The `default` preset is the shipped look and cannot be removed.",

    // --- Observer panel -----------------------------------------------------
    observer: "Observer & scenarios",
    resolvedTitle: "The location the site resolved for you",
    latitude: "Latitude",
    longitude: "Longitude",
    southernHemisphere: (which: string) => `Southern hemisphere (${which})`,
    mirrored: "mirrored",
    north: "north",
    hemisphereNote:
      "Below the equator the sky mirrors: east moves to the right and the crescent turns over. It is one sign in `scene.hemisphere`, and it is the easiest thing in the model to get backwards — so it has a switch.",
    timezoneNote:
      "The clock stays in your timezone. Moving the observer moves the sky, not the calendar, so a Sydney day here runs from your local midnight and its sunrise lands wherever that puts it — which is exactly what the site does for a visitor who has travelled.",
    namedSkies: "Named skies",
    observerCustom: "Custom",
    observerPermalink: "Permalink",

    // --- Weather panel ------------------------------------------------------
    weather: "Weather",
    condition: "Condition",
    asReported: "As reported",
    asReportedTitle: "Whatever the API reported",
    cloudCover: "Cloud cover",
    precipitation: "Precipitation",
    wind: "Wind",
    clearTweaks: "Clear tweaks",
    clearTweaksTitle: "Drop every tweak and go back to the derived numbers",
    profileFor: (condition: string) => `Profile · ${condition}`,
    pCover: "Cover (no measurement)",
    pCoverMin: "Cover floor",
    pDensity: "Density",
    pDarkness: "Darkness",
    pPrecip: "Precipitation",
    pFog: "Fog",
    pTintAmount: "Tint amount",
    dayTintRow: "Day tint · zenith / horizon",
    nightTintRow: "Night tint · zenith / horizon",
    dayZenithTint: "Day zenith tint",
    dayHorizonTint: "Day horizon tint",
    nightZenithTint: "Night zenith tint",
    nightHorizonTint: "Night horizon tint",
    howCoverBehaves: "How cover behaves",
    tintCover: "Cover that brings the tint in",
    horizonTintRatio: "Horizon keeps more clear sky",
    darknessFromPrecip: "Darkness from precipitation",
    darknessFromCover: "Darkness from extra cover",
    windAndDrift: "Wind & drift",
    fullDriftAt: "Full drift at",
    assumedWind: "Assumed wind",
    driftAtZeroWind: "Drift at zero wind",
    driftFromWind: "Drift from wind",
    cloudLighting: "Cloud lighting",
    litTopsRow: "Lit tops · day / night",
    shadeDayRow: "Shade by day · calm / storm",
    shadeNightRow: "Shade at night · calm / storm",
    litTopsDay: "Lit tops by day",
    litTopsNight: "Lit tops at night",
    shadeDayCalm: "Daytime shade, calm",
    shadeDayStorm: "Daytime shade, stormy",
    shadeNightCalm: "Night shade, calm",
    shadeNightStorm: "Night shade, stormy",
    veilPerTheme: "Veil, per theme",
    veilColorTitle: (theme: string) => `${theme} veil colour`,
    amount: "Amount",
    exposure: "Exposure",
    apiReadout: "As the API reported it",
    noLiveWeather:
      "No live weather — the lab is deriving from the profile defaults.",
    rowCode: "code",
    rowCondition: "condition",
    rowCloud: "cloud",
    rowPrecip: "precip",
    rowWind: "wind",
    rowHumidity: "humidity",

    // --- Sun panel ----------------------------------------------------------
    sunPanel: "Sun",
    keyframeCount: (n: number) => `${n} keyframes`,
    rampCaption: "horizon colour by sun elevation",
    rampTitle: "The horizon colour across the whole elevation ramp",
    colEl: "el",
    colZenith: "zen",
    colHorizon: "hor",
    colGlow: "glow",
    colStrength: "str",
    keyElevation: (i: number) => `Keyframe ${i} elevation`,
    keyStrength: (i: number) => `Keyframe ${i} glow strength`,
    keyZenith: (el: string) => `Keyframe ${el} zenith`,
    keyHorizon: (el: string) => `Keyframe ${el} horizon`,
    keyGlow: (el: string) => `Keyframe ${el} glow`,
    keysNote:
      "Keys are re-sorted by elevation when the config is saved. Between two of them the sky is a smoothstep, which is why the interesting ones crowd around the horizon.",
    dayThreshold: "Day threshold",
    twilightFloor: "Twilight floor",
    twilightCeiling: "Twilight ceiling",
    thresholdNote:
      "The one day/night decision, and the window the daylight factor ramps across. Everything that says “day” — icons, palettes, chips — reads the first of these and nothing else.",
    discSize: "Disc size",
    glowRadiusHigh: "Glow radius, high sun",
    glowRadiusLow: "Glow radius, low sun",
    glowGain: "Glow gain",
    horizonBand: "Horizon band",
    coverFade: "Cloud mutes the glow",

    // --- Moon panel ---------------------------------------------------------
    moonPanel: "Moon",
    moonDiscHint: (v: string) => `disc ${v}`,
    moonIllusion: "Moon illusion",
    illusionFade: "Illusion fades by",
    halo: "Halo",
    earthshine: "Earthshine",
    terminator: "Terminator softness",
    moonDiscNote:
      "Halo scales with the illuminated fraction and is painted in front of the disc, so it covers the dark side instead of outlining it. Earthshine is deliberately a whisper: any more and a crescent reads as a grey ball.",
    theThreeGates: "The three gates",
    gateUpRow: "Up (moon elevation)",
    gateSkyDarkRow: "Dark sky (sun elevation)",
    gateCoverRow: "Cloud cover",
    fogHidesIt: "Fog hides it",
    gatesNote:
      "Visibility is the product: up × sky × clear. Each of the three is plotted as a sparkline, so a moon that vanished has a culprit.",
    daytimeMoonGroup: "Daytime moon",
    gateElevation: "Elevation",
    gateElongation: "Elongation from the sun",
    daytimeStrength: "Daytime strength",
    daytimeNote:
      "A crescent near the sun is invisible by day — in the sky and here. Well up and far enough round, it shows as a pale disc.",
    moonlight: "Moonlight",
    moonlightRise: "Reaches full by",
    liftsZenith: "Lifts the zenith",
    liftsHorizon: "Lifts the horizon",
    liftsClouds: "Lifts the cloud tops",
    starWash: "Washes out the stars",
    moonlitZenith: "Moonlit zenith",
    moonlitHorizon: "Moonlit horizon",
    moonlitClouds: "Moonlit cloud tops",

    // --- Stars panel --------------------------------------------------------
    starsPanel: "Stars",
    starsDensityHint: (v: string) => `density ${v}`,
    density: "Density",
    twinkle: "Twinkle",
    nightGate: "Night gate (sun elevation)",
    nightGateHint: "0 at from, 1 at to",
    starsNote:
      "Density scales the share of shader cells that hold a star, so 0 empties the field and 1 is the shipped one. The night gate runs downwards — `from` is the brighter elevation.",

    // --- Staging panel ------------------------------------------------------
    stagingPanel: "Camera & staging",
    stagingHint: (v: string) => `horizon ${v}`,
    orientationNote:
      "The stage was designed for both. The preview canvas and the screen-space plot change shape together.",
    theFrame: "The frame",
    horizonY: "Horizon y",
    sunArc: "Sun arc height",
    azimuthSpan: "East → west span",
    azimuthMargin: "Left margin",
    moonStage: "The moon's stage",
    stageRise: "y at the horizon",
    stageLow: "y once properly up",
    stageHigh: "y at the top",
    stageTopAt: "Reaches the top at",
    stageRiseGate: "Climbs from horizon to low",
    stageXMin: "x min",
    stageXMax: "x max",
    stageNote:
      "Where the moon is is never bent. This is only where it is drawn — and the screen-space plot redraws with every one of these, so the change is visible as a change of path before it is a change of picture.",
    shaderFraming: "Shader framing",
    horizonCurve: "Horizon curve",
    cloudScaleFar: "Far deck scale",
    cloudScaleNear: "Near deck scale",
    cloudParallaxFar: "Far deck parallax",
    cloudParallaxNear: "Near deck parallax",
    shaderNote:
      "Only the Sky engine reads these. The Gradient and Classic renderings beside it will not move.",

    // --- Gates (shared row labels) ------------------------------------------
    gateFrom: "from",
    gateTo: "to",

    // --- About --------------------------------------------------------------
    whatThisIs: "What this is",
    aboutNote:
      "`/editor/sky` is a consumer of `systems/ambient/lib`, never a fork of it. Every lever above is a field of the `SkyConfig` that `deriveWeatherScene`, `stageMoon` and the shader take as input; Save writes `content/sky.json`, which the site imports at build.",
    checkNote:
      "`pnpm sky:check` fails if that file stops normalising cleanly — a removed field, an out-of-range value, a colour that is not a hex triple.",

    // --- Scenarios ----------------------------------------------------------
    scenarioFullMoon: "Full moon, clear",
    scenarioFullMoonWhy: "The nearest full moon, at its transit — the night's lantern.",
    scenarioNewMoon: "New moon, clear",
    scenarioNewMoonWhy:
      "The nearest new moon at midnight — stars with nothing to wash them out.",
    scenarioDayMoon: "Daytime moon",
    scenarioDayMoonWhy:
      "A gibbous moon well up in an afternoon sky — the quiet daytime gate.",
    scenarioStormDusk: "Thunderstorm at dusk",
    scenarioStormDuskWhy:
      "Sunset under a storm — the tint at its heaviest against the last warmth.",
    scenarioBlueHour: "Blue hour",
    scenarioBlueHourWhy:
      "Civil twilight: the keyframes between −6° and 0°, where the ramp is steepest.",
    scenarioPolarNight: "Noon in polar night",
    scenarioPolarNightWhy:
      "Midday with the sun below the horizon — only meaningful far enough north.",

    // --- Observer presets ----------------------------------------------------
    cityLondon: "London",
    cityNewYork: "New York",
    cityShanghai: "Shanghai",
    citySingapore: "Singapore",
    citySydney: "Sydney",
    cityUshuaia: "Ushuaia",
    cityTromso: "Tromsø",
  },

  zh: {
    booting: "天空引擎实验室…",

    // --- Toolbar ---------------------------------------------------------
    active: "生效中",
    unsaved: "未保存",
    json: "JSON",
    link: "链接",
    reset: "重置",
    save: "保存",
    saving: "保存中…",
    configJson: "配置 JSON",
    permalink: "永久链接",
    copied: (what: string) => `${what}已复制`,
    clipboardUnavailable: "剪贴板不可用",
    saveFailed: "保存失败",
    savedToast: (id: string) => `已写入 content/sky.json · 生效预设“${id}”`,
    resetToast: "已重置为内置默认值（尚未保存）",
    presetAdded: (name: string) => `已添加预设“${name}”——保存后才会提交`,
    editingPreset: (id: string) => `正在编辑 ${id}`,

    // --- Engines ---------------------------------------------------------
    engines: "引擎 · 同一场景，三种渲染",
    light: "浅色",
    dark: "深色",
    engineSky: "天空 · WebGL",
    engineSkyUnavailable: (reason: string) => ` — 不可用（${reason}）`,
    engineGradient: "渐变 · CSS 退路",
    engineClassic: (phase: string) => `经典 · ${phase}`,

    // --- The clock -------------------------------------------------------
    scaleDay: "日",
    scaleMonth: "月",
    scaleYear: "年",
    hintDay: "00:00 → 24:00 · 太阳的弧线、晨昏，以及当天相位的月亮",
    hintMonth: "固定时刻扫过 30 天 · 月亮每天晚约 50 分钟",
    hintYear: "固定时刻扫过 365 天 · 日行迹与昼长的变化",
    play: "播放",
    pause: "暂停",
    stepBack: "后退一步",
    stepForward: "前进一步",
    loop: "循环",
    loopTitle: "循环播放",
    now: "现在",
    nowTitle: "回到真实的此刻",
    hold: (clock: string) => `固定在 ${clock}`,
    holdTitle: "把月、年扫描与日行迹固定在这个时刻",
    scrubber: (scale: string) => `${scale}进度条`,
    clockHeld: (clock: string, from: string, to: string) =>
      `时刻固定在 ${clock} · ${from} → ${to}`,

    // --- The day timeline -------------------------------------------------
    dayTimeline: "一天 · 天空与月亮可见度",
    moonTrack: "全天的月亮可见度",
    scrubDay: "拖动时间",
    realTimeOfDay: "真实的此刻",
    sunNeverSets: "太阳不落",
    sunNeverRises: "太阳不升",

    // --- Plots ------------------------------------------------------------
    domeTitle: "天穹 · 方位角 × 高度角",
    screenTitle: "屏幕空间 · 实际画在哪里",
    horizon: "地平线",
    astronomicalNight: "−18° 天文夜",
    sun: "太阳",
    moon: "月亮",
    moonShown: "月亮（显示）",
    moonStaged: "月亮（已编排，未显示）",
    contentBand: "页面内容 · 小组件区",
    portrait: "竖屏",
    landscape: "横屏",
    analemma: "日行迹",
    analemmaHint: (clock: string) => `${clock} · 一年中的每一天`,
    analemmaFooter: (elFrom: string, elTo: string, azFrom: string, azTo: string) =>
      `同一时刻下，高度角 ${elFrom} → ${elTo}，方位角 ${azFrom} → ${azTo}。`,
    monthTitle: "一个月 · 相位与中天高度",
    monthPeak: (deg: string) => `最高 ${deg}`,
    monthTile: (date: string, lit: number, transit: string) =>
      `${date} · 亮面 ${lit}% · 中天 ${transit}`,
    phaseDial: "月相盘",
    dialNew: "朔",
    dialFull: "望",
    dialSummary: (phase: string, lit: number, elongation: string) =>
      `相位 ${phase} · 亮面 ${lit}% · 距角 ${elongation}`,

    // --- Derived scalars ---------------------------------------------------
    derivedScalars: "派生标量 · 全天",
    seriesDaylight: "日照",
    seriesGlow: "辉光",
    seriesSkyDark: "天空暗度",
    seriesMoonUp: "月亮升起",
    seriesMoonClear: "月亮通透",
    seriesMoonVisible: "月亮可见度",
    seriesStars: "星星",
    seriesFog: "雾",
    seriesCover: "云量",
    seriesCloudDark: "云底暗度",
    whyDaylight: "太阳高度角映射到晨昏窗口。",
    whyGlow: "关键帧给出的辉光强度，再被云量削弱。",
    whySkyDark: "月亮可见度的第二道门：天空有多暗，只由太阳决定。",
    whyMoonUp: "第一道门：月亮的高度角。",
    whyMoonClear: "第三道门：云量与雾。",
    whyMoonVisible: "三道门的乘积——交给着色器的就是它。",
    whyStars: "夜色 × 通透 × (1 − 月光冲淡)。",
    whyFog: "配置中的雾，加上湿度与降水。",
    whyCover: "实测云量，并以该天气的下限兜底。",
    whyCloudDark: "云底读起来有多暗。",
    sparkNote:
      "月亮可见度 = 升起 × 天暗 × 通透，三者分别画在上面——月亮灭了是有元凶的，不是谜。",

    // --- Phase panel -------------------------------------------------------
    phase: "月相",
    gateUp: "升起",
    gateSkyDark: "天空暗度",
    gateClear: "通透",
    gateDayMoon: "白昼月",
    gateVisible: "可见度",
    drawnSize: "绘制尺寸",

    // --- Ephemeris ---------------------------------------------------------
    ephemerisSun: "星历 · 太阳",
    ephemerisMoon: "星历 · 月亮",
    dayJ2000: "日数（J2000）",
    daySchlyter: "日数（Schlyter）",
    meanAnomaly: "平近点角",
    meanLongitude: "平黄经",
    eclipticLon: "黄经 λ",
    obliquity: "黄赤交角",
    rightAscension: "赤经",
    declination: "赤纬",
    siderealTime: "格林尼治 / 本地恒星时",
    hourAngle: "时角",
    elevationAzimuth: "高度角 / 方位角",
    orbitalElements: "升交点 / 倾角 / 近地点幅角",
    anomalies: "平 / 偏 / 真近点角",
    elongationArgument: "日月角距 D / 纬度幅角 F",
    perturbations: "摄动项 λ / β",
    eclipticLonLat: "黄经 λ / 黄纬 β",
    distance: "距离",
    raDec: "赤经 / 赤纬",
    geocentricElevation: "地心高度角",
    parallaxCorrection: "视差修正",

    // --- Invariants --------------------------------------------------------
    oneClock: "同一时钟的保证",
    invOneClock: "同一个时钟",
    invOneClockDetail: (stamp: string) => `日月同取自 ${stamp}`,
    invPhase: "相位 = 月亮黄经 − 太阳黄经",
    invPhaseDetail: (derived: string, scene: string) =>
      `${derived}，场景为 ${scene}`,
    invDayNight: "昼夜只由太阳决定",
    invDayNightDetail: (a: string, b: string, el: string, threshold: string) =>
      `${a} 与 ${b} 一致 · 高度角 ${el} > ${threshold}`,
    invariantsNote:
      "这些都在当前时刻重新推导并与场景比对，所以是断言而不是说明文字。白天的天空里不可能出现月亮——天气根本够不到太阳。",

    // --- References --------------------------------------------------------
    references: "与文献对照",
    refNewMoon: "朔，2000-01-06",
    refNewMoonSource: "Meeus，第 0 朔望月",
    refSynodic: (n: number) => `朔望月（${n} 个周期平均）`,
    refSynodicSource: "IAU 平均值",
    refObliquity: "黄赤交角",
    refObliquitySource: "J2000.0 —— 太阳赤纬峰值",
    refDistance: "月地平均距离",
    refDistanceSource: "IAU，中心到中心",
    refRowTitle: (source: string, published: string, measured: string) =>
      `${source} · 文献值 ${published}，模型 ${measured}`,
    referencesNote:
      "“Schlyter 级精度”在被测量之前只是说法。四个公开常数，在页面加载时用本仓库的星历重新算出——而不是拿它自己的快照对照。",

    // --- Presets panel ------------------------------------------------------
    presets: "预设",
    newPresetName: "新预设名称",
    add: "添加",
    addTitle: "把当前配置存为新预设",
    activeOnSite: "站点正在使用",
    makeActive: "设为生效",
    makeActiveTitle: "让站点用这个预设作画",
    thePresetTheSitePaints: "站点正在使用的预设",
    deletePreset: "删除",
    presetsNote:
      "预设都存在同一个 `content/sky.json` 里。站点只画生效的那一个；编辑其它预设在你把它设为生效之前不会改变任何东西。`default` 是出厂的样子，不可删除。",

    // --- Observer panel -----------------------------------------------------
    observer: "观测者与场景",
    resolvedTitle: "站点为你解析出的位置",
    latitude: "纬度",
    longitude: "经度",
    southernHemisphere: (which: string) => `南半球（${which}）`,
    mirrored: "已镜像",
    north: "北半球",
    hemisphereNote:
      "赤道以南天空是镜像的：东边跑到右边，月牙也翻过来。它在 `scene.hemisphere` 里只是一个符号，却是整个模型里最容易搞反的东西——所以给了一个开关。",
    timezoneNote:
      "时钟始终用你所在的时区。移动观测者移动的是天空，不是日历：这里的“悉尼的一天”仍从你的本地午夜开始，日出落在哪儿就是哪儿——这正是站点对一位刚旅行过的访客所做的事。",
    namedSkies: "命名天空",
    observerCustom: "自定义",
    observerPermalink: "来自链接",

    // --- Weather panel ------------------------------------------------------
    weather: "天气",
    condition: "天气状况",
    asReported: "按实况",
    asReportedTitle: "API 报什么就是什么",
    cloudCover: "云量",
    precipitation: "降水",
    wind: "风速",
    clearTweaks: "清除微调",
    clearTweaksTitle: "丢掉所有微调，回到推导出的数值",
    profileFor: (condition: string) => `配置 · ${condition}`,
    pCover: "云量（无实测时）",
    pCoverMin: "云量下限",
    pDensity: "浓度",
    pDarkness: "暗度",
    pPrecip: "降水",
    pFog: "雾",
    pTintAmount: "色调强度",
    dayTintRow: "白天色调 · 天顶 / 地平",
    nightTintRow: "夜晚色调 · 天顶 / 地平",
    dayZenithTint: "白天天顶色调",
    dayHorizonTint: "白天地平色调",
    nightZenithTint: "夜晚天顶色调",
    nightHorizonTint: "夜晚地平色调",
    howCoverBehaves: "云量如何起作用",
    tintCover: "开始上色调的云量",
    horizonTintRatio: "地平保留更多晴空",
    darknessFromPrecip: "降水带来的暗度",
    darknessFromCover: "超出部分云量带来的暗度",
    windAndDrift: "风与飘移",
    fullDriftAt: "满速飘移风速",
    assumedWind: "缺省风速",
    driftAtZeroWind: "无风时的飘移",
    driftFromWind: "风带来的飘移",
    cloudLighting: "云的受光",
    litTopsRow: "受光云顶 · 白天 / 夜晚",
    shadeDayRow: "白天云影 · 平静 / 风暴",
    shadeNightRow: "夜晚云影 · 平静 / 风暴",
    litTopsDay: "白天的受光云顶",
    litTopsNight: "夜晚的受光云顶",
    shadeDayCalm: "白天云影，平静",
    shadeDayStorm: "白天云影，风暴",
    shadeNightCalm: "夜晚云影，平静",
    shadeNightStorm: "夜晚云影，风暴",
    veilPerTheme: "遮罩，按主题",
    veilColorTitle: (theme: string) => `${theme}遮罩颜色`,
    amount: "强度",
    exposure: "曝光",
    apiReadout: "API 的原始读数",
    noLiveWeather: "没有实况天气——实验室正按天气配置的默认值推导。",
    rowCode: "代码",
    rowCondition: "状况",
    rowCloud: "云量",
    rowPrecip: "降水",
    rowWind: "风",
    rowHumidity: "湿度",

    // --- Sun panel ----------------------------------------------------------
    sunPanel: "太阳",
    keyframeCount: (n: number) => `${n} 个关键帧`,
    rampCaption: "地平颜色随太阳高度角的变化",
    rampTitle: "整条高度角坡道上的地平颜色",
    colEl: "高度",
    colZenith: "天顶",
    colHorizon: "地平",
    colGlow: "辉光",
    colStrength: "强度",
    keyElevation: (i: number) => `第 ${i} 个关键帧的高度角`,
    keyStrength: (i: number) => `第 ${i} 个关键帧的辉光强度`,
    keyZenith: (el: string) => `${el} 关键帧的天顶色`,
    keyHorizon: (el: string) => `${el} 关键帧的地平色`,
    keyGlow: (el: string) => `${el} 关键帧的辉光色`,
    keysNote:
      "保存配置时关键帧会按高度角重新排序。两帧之间是 smoothstep，所以有意思的那几帧都挤在地平线附近。",
    dayThreshold: "昼夜阈值",
    twilightFloor: "晨昏下界",
    twilightCeiling: "晨昏上界",
    thresholdNote:
      "唯一的昼夜判定，以及日照因子爬升的窗口。所有说“白天”的东西——图标、配色、标签——都只读第一个值，别无其他。",
    discSize: "圆面大小",
    glowRadiusHigh: "辉光半径（高空）",
    glowRadiusLow: "辉光半径（近地平）",
    glowGain: "辉光增益",
    horizonBand: "地平暖带",
    coverFade: "云量削弱辉光",

    // --- Moon panel ---------------------------------------------------------
    moonPanel: "月亮",
    moonDiscHint: (v: string) => `圆面 ${v}`,
    moonIllusion: "月亮错觉",
    illusionFade: "错觉消失于",
    halo: "光晕",
    earthshine: "地球反照",
    terminator: "明暗界线柔和度",
    moonDiscNote:
      "光晕随亮面比例缩放，并画在圆面之前，于是它盖住暗面而不是把暗面勾出轮廓。地球反照故意只留一丝：再多一点，月牙就成了灰球。",
    theThreeGates: "三道门",
    gateUpRow: "升起（月亮高度角）",
    gateSkyDarkRow: "天空够暗（太阳高度角）",
    gateCoverRow: "云量",
    fogHidesIt: "雾遮蔽程度",
    gatesNote:
      "可见度是三者的乘积：升起 × 天暗 × 通透。三条各有一条迷你曲线，所以月亮消失时总能找到元凶。",
    daytimeMoonGroup: "白昼的月亮",
    gateElevation: "高度角",
    gateElongation: "与太阳的距角",
    daytimeStrength: "白昼强度",
    daytimeNote:
      "靠近太阳的月牙在白天是看不见的——真实天空如此，这里也如此。升得够高、离得够远，它才以一枚淡淡的圆面出现。",
    moonlight: "月光",
    moonlightRise: "在此高度达到满值",
    liftsZenith: "提亮天顶",
    liftsHorizon: "提亮地平",
    liftsClouds: "提亮云顶",
    starWash: "冲淡星光",
    moonlitZenith: "月光下的天顶",
    moonlitHorizon: "月光下的地平",
    moonlitClouds: "月光下的云顶",

    // --- Stars panel --------------------------------------------------------
    starsPanel: "星星",
    starsDensityHint: (v: string) => `密度 ${v}`,
    density: "密度",
    twinkle: "闪烁",
    nightGate: "夜色门（太阳高度角）",
    nightGateHint: "from 处为 0，to 处为 1",
    starsNote:
      "密度缩放的是着色器里有星星的格子占比：0 清空星空，1 就是出厂的那片。夜色门是往下走的——`from` 是更亮的那个高度角。",

    // --- Staging panel ------------------------------------------------------
    stagingPanel: "取景与编排",
    stagingHint: (v: string) => `地平 ${v}`,
    orientationNote: "这套编排是为两种方向设计的。预览画布与屏幕空间图会一起改变形状。",
    theFrame: "画面",
    horizonY: "地平线 y",
    sunArc: "太阳弧高",
    azimuthSpan: "东 → 西 跨度",
    azimuthMargin: "左边距",
    moonStage: "月亮的舞台",
    stageRise: "地平线处的 y",
    stageLow: "完全升起后的 y",
    stageHigh: "最高处的 y",
    stageTopAt: "在此高度到达顶部",
    stageRiseGate: "从地平线爬到低位的区间",
    stageXMin: "x 最小",
    stageXMax: "x 最大",
    stageNote:
      "月亮在哪里，从不被扭曲。这里只决定它画在哪里——而且屏幕空间图会随这些值实时重绘，所以改动先表现为轨迹的变化，然后才是画面的变化。",
    shaderFraming: "着色器取景",
    horizonCurve: "地平曲线指数",
    cloudScaleFar: "远层云尺度",
    cloudScaleNear: "近层云尺度",
    cloudParallaxFar: "远层云视差",
    cloudParallaxNear: "近层云视差",
    shaderNote: "只有天空引擎读这些。旁边的渐变与经典渲染不会动。",

    // --- Gates (shared row labels) ------------------------------------------
    gateFrom: "起",
    gateTo: "止",

    // --- About --------------------------------------------------------------
    whatThisIs: "这是什么",
    aboutNote:
      "`/editor/sky` 是 `systems/ambient/lib` 的使用者，绝不是它的分叉。上面每一个旋钮都是 `SkyConfig` 的一个字段，而 `deriveWeatherScene`、`stageMoon` 和着色器都以它为输入；保存会写入 `content/sky.json`，站点在构建时导入它。",
    checkNote:
      "一旦那个文件不再能干净地归一化——字段被删、数值越界、颜色不是十六进制三元组——`pnpm sky:check` 就会失败。",

    // --- Scenarios ----------------------------------------------------------
    scenarioFullMoon: "满月晴夜",
    scenarioFullMoonWhy: "最近的一次满月，正当中天——夜里的那盏灯。",
    scenarioNewMoon: "新月晴夜",
    scenarioNewMoonWhy: "最近的一次新月的午夜——没有任何东西冲淡星星。",
    scenarioDayMoon: "白昼的月亮",
    scenarioDayMoonWhy: "午后天空里升得很高的凸月——那道安静的白昼之门。",
    scenarioStormDusk: "黄昏雷暴",
    scenarioStormDuskWhy: "风暴下的日落——色调最重的时候，撞上最后一点暖意。",
    scenarioBlueHour: "蓝调时刻",
    scenarioBlueHourWhy: "民用晨昏：−6° 到 0° 之间的那几个关键帧，坡道最陡的地方。",
    scenarioPolarNight: "极夜的正午",
    scenarioPolarNightWhy: "太阳在地平线以下的正午——要足够靠北才有意义。",

    // --- Observer presets ----------------------------------------------------
    cityLondon: "伦敦",
    cityNewYork: "纽约",
    cityShanghai: "上海",
    citySingapore: "新加坡",
    citySydney: "悉尼",
    cityUshuaia: "乌斯怀亚",
    cityTromso: "特罗姆瑟",
  },
} as const;

export type SkyStrings = (typeof STRINGS)["en"];

/**
 * The lab's copy, plus the site's own names for the things it inspects.
 *
 * `conditionName`, `phaseName` and `moonPhaseName` deliberately delegate: the
 * lab must call a thundery sky and a full moon exactly what the wallpaper's
 * own chips call them.
 */
export function useSkyText() {
  const { locale } = useLocale();
  const L = STRINGS[locale] as SkyStrings;
  return {
    locale,
    L,
    conditionName: (condition: WeatherCondition) =>
      getWeatherConditionLabel(condition, locale),
    phaseName: (phase: AmbientPhase) => getAmbientPhaseLabel(phase, locale),
    moonPhaseName: (phase: number) =>
      getMoonPhaseLabel(getMoonPhaseName(phase), locale),
    themeName: (theme: "light" | "dark") =>
      theme === "dark" ? L.dark : L.light,
  };
}
