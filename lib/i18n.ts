// =============================================================================
// i18n - Internationalization utilities
// Pure data and functions, no React state
// =============================================================================

export type Locale = "en" | "zh";

export const defaultLocale: Locale = "en";

export const locales: Locale[] = ["en", "zh"];

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

// =============================================================================
// Scramble Character Sets
// Used by TextScramble for locale-appropriate random characters during animation
// =============================================================================

export const scrambleCharacterSets = {
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  // Chinese sets derived from display + hover text combinations
  zh: {
    writing: "文字写作博客言之有物",
    works: "工作作品集术业有专攻",
    prompts: "系统提示词闻道有先后",
    // Default fallback for other pages
    default:
      "的一是了不人有我他这个们中来上大为和国地到以说时要就出会可也你对生能而子",
  },
} as const;

// =============================================================================
// Translations
// =============================================================================

export const translations = {
  en: {
    // Navigation
    home: "Home",
    career: "Career",
    projects: "Projects",
    blog: "Blog",
    talks: "Talks",
    productions: "Productions",

    // Homepage
    tagline:
      "Prose, profession, programming, production, projects—each a facet of a complete person.",
    currently: "Currently",
    currentStatus:
      "Building cross-platform experiences. Thinking about developer tools, design systems, and the intersection of engineering and craft.",
    careerDesc: "Professional trajectory",
    blogDesc: "Writing & thoughts",
    talksDesc: "Presentations & speaking",
    navigateHint: "to navigate anywhere",

    // Homepage - AI-Native OS Voice
    greetingMorning: "Good Morning",
    greetingAfternoon: "Good Afternoon",
    greetingEvening: "Good Evening",
    greetingNight: "Good Night",
    greetingSunrise: "Sun Is Rising",
    greetingSunset: "Sun Is Setting",
    greetingWelcomeBack: "Welcome Back",
    greetingLongTime: "It's Been A While",
    greetingLastReading: "Last Read",
    greetingWhatsNew: "Here's What's New",
    promptPlaceholder: "What brings you to here?",
    searchMobile: "Search",
    searchDesktop: "Search or / for commands",
    identifierWingLeft: "The",
    identifierWingRight: "OS",
    identifierExpanded: "The λHUX OS",

    // Widget labels
    widgetBlog: "writing",
    widgetTalks: "productions",
    widgetStatus: "projects",
    widgetWeather: "weather",
    widgetPrompt: "prompts",
    widgetMusic: "playing",
    widgetMusicIdle: "music",
    widgetFeaturedTalks: "talks",
    theaterOpenControls: "Open video controls",
    theaterWatching: "watching",
    theaterReturnPip: "Picture in picture",
    theaterPip: "PiP",
    theaterExpand: "Theater",
    theaterSurfaceGroup: "Player view",
    theaterSurfaceTheater: "Theater",
    theaterSurfacePip: "PiP",
    theaterSurfaceMini: "Audio",
    theaterSurfaceMiniHint: "Minimize — audio keeps playing",
    theaterSurfaceNow: "Now in {surface}",
    theaterSurfaceGo: "Switch to {surface}",
    widgetEditDone: "Done",
    widgetEditReset: "Reset",
    musicNotPlaying: "nothing playing",
    settingsMusic: "Music",
    musicPlay: "Play",
    musicPause: "Pause",
    musicOpenControls: "Open music controls",
    musicCollapse: "Collapse",
    musicPlaylist: "playlist",
    musicOpenPlaylist: "Browse playlist",
    musicClosePlaylist: "Close playlist",
    musicOpenOnYouTube: "Open on YouTube",
    musicPlaylistEmpty: "Playlist unavailable",
    musicTrack: "Track",
    widgetViewAll: "view all",

    // Dock / Live Activities
    dockCollapse: "Collapse",
    phaseSunrise: "Sunrise",
    phaseSunset: "Sunset",
    phaseOpenDetails: "Open weather details",

    // Ambient (location / weather)
    locationIp: "IP",
    locationAccurate: "Accurate",
    weatherUnavailable: "weather unavailable",
    timeDay: "day",
    timeNight: "night",
    settingsLocation: "Location",
    settingsGeolocation: "Geolocation",
    settingsDebugPanel: "Debug Panel",

    // Wallpaper (background picker)
    settingsWallpaper: "Wallpaper",
    settingsGlass: "Glass",
    glassTinted: "Tinted",
    glassClear: "Clear",
    settingsTint: "Tint",
    tintNeutral: "Neutral",
    tintWallpaper: "Wallpaper",
    wallpaperTitle: "wallpaper",
    wallpaperClose: "Close wallpaper picker",
    wallpaperChoose: "Ambient",
    wallpaperWeather: "Weather",
    wallpaperLive: "Live",
    wallpaperPreset: "Preset",
    wallpaperWeatherMeta: "live · ambient",
    wallpaperCategoryWeather: "Weather",
    wallpaperWeatherSky: "Sky",
    wallpaperWeatherSkyMeta: "shader · webgl",
    wallpaperWeatherGradient: "Gradient",
    wallpaperWeatherGradientMeta: "css · gradient",
    wallpaperWeatherClassic: "Classic",
    wallpaperWeatherClassicMeta: "css · gradient",
    wallpaperNoWebGL: "No WebGL2 here — Sky paints the Gradient instead.",
    wallpaperTilt: "Tilt",
    wallpaperTiltNote: "Rain and snow fall along real gravity — lean the device and the sky leans with it.",
    wallpaperTiltAsk: "Turning it on asks this browser for motion access.",
    wallpaperTiltDenied: "Motion access was refused; allow it again in the browser's settings for this site.",
    wallpaperTiltSilent: "Nothing here to tilt with — this device sends no motion readings.",
    tiltPrimerTitle: "You found an easter egg!",
    tiltPrimerBody: "The rain and snow here follow real gravity. Turn on tilt, then lean your phone and watch the rain slant across the screen.",
    tiltPrimerAsk: "Your browser will ask for motion access. Just allow it.",
    tiltPrimerConfirm: "Turn on tilt",
    tiltPrimerDismiss: "Not now",
    tiltPrimerAgain: "Change it later under Wallpaper › Weather › Tilt.",
    tiltPrimerGranted: "Tilt is on. Lean your phone and watch.",
    tiltPrimerDenied: "Motion access was not allowed. You can turn it on in your browser's settings for this site.",
    wallpaperCategoryApple: "Apple",
    wallpaperCategoryNature: "Nature",
    wallpaperPlacement: "Placement",
    wallpaperPlacementFull: "Full",
    wallpaperPlacementWidget: "Widget",
    wallpaperPlacementOff: "Off",
    wallpaperFooterNote: "Wallpapers are Apple's; rights remain theirs.",
    wallpaperShuffle: "Shuffle",
    wallpaperShuffleMeta: "random order",
    wallpaperLoop: "Loop",
    wallpaperLoopMeta: "in order",
    wallpaperPlayFrequency: "Frequency",
    wallpaperPlayEveryVisit: "On Visit",
    wallpaperPlayEveryHourly: "Hourly",
    wallpaperPlayEveryDaily: "Daily",

    // Sun theme — the theme following sunrise and sunset
    settingsSolarTheme: "Follow the Sun",
    solarThemeHint:
      "Once dawn and dusk have played out, the theme follows the sky — for this session only, never your saved Appearance.",
    solarThemeToLight: "Light Mode",
    solarThemeToDark: "Dark Mode",
    solarThemeNote: "Preference unchanged",

    // The article header's provenance line, folded behind an `(i)`.
    postOrigin: "Where this was first published",

    // Reading settings (the article page's "Aa")
    readingSettings: "Reading settings",
    readingSettingsTitle: "reading",
    readingSettingsClose: "Close reading settings",
    readingFont: "Typeface",
    readingFontSans: "Sans",
    readingFontSerif: "Serif",
    readingSize: "Size",
    readingSizeSmall: "Small",
    readingSizeDefault: "Default",
    readingSizeLarge: "Large",
    readingMeasure: "Column",
    readingMeasureNarrow: "Narrow",
    readingMeasureDefault: "Default",
    readingMeasureWide: "Wide",
    readingFocus: "Focus mode",
    readingBleed: "Wide media",
    readingRuler: "Ruler",
    readingRulerLeft: "Left",
    readingRulerRight: "Right",

    stateOn: "On",
    stateOff: "Off",
    debugOverride: "override",
    debugReal: "real",
    internalDocs: "Internal Docs",
    devtoolTimeOfDay: "Time Of Day",

    // Career/Projects
    careerTitle: "Projects",
    careerSubtitle: "A narrative of roles, challenges, and growth.",

    // Apps (window launcher / Spotlight)
    appsGroup: "Apps",
    appsLoadBundle: "Load Lynx bundle from URL…",
    appsLoadBundleTitle: "Open a Lynx bundle",
    appsLoadBundleHint: "Loads any Lynx for Web bundle from the internet",
    appsLoadBundlePlaceholder: "https://…/main.web.bundle",
    appsLoadBundleOpen: "Open",
    appsLoadBundleInvalid: "That doesn’t look like a bundle URL",
    appsLoadBundleOverTheAir: "over the air",

    // Blog/Prose (Writing page)
    writingTitle: "Writing",
    writingTitleHover: "Prose",
    blogSubtitle: "thoughts on craft, software, and practice",
    allLanguages: "All",
    backToWriting: "back to writing",
    alsoIn: "Also in",

    // Talks/Productions
    talksTitle: "Productions",
    talksSubtitle: "Presentations, workshops, and speaking engagements.",
    watch: "Watch",
    slides: "Slides",

    // Docs
    docs: "Docs",
    docsTitle: "Documentation",
    docsSubtitle: "technical architecture and design decisions",
    backToDocs: "back to docs",

    // Command Palette
    searchPlaceholder: "What are you looking for?",
    noResults: "No results found",
    navigate: "Navigate",
    select: "Select",
    navigation: "Navigation",
    settings: "Settings",
    actions: "Commands",
    slashCommands: "Slash Commands",
    backToSearch: "Back",
    commandPalette: "Command palette",
    commandClose: "Close command palette",
    appearance: "Appearance",
    languageLabel: "Language",
    themeSystem: "System",
    themeDark: "Dark",
    themeLight: "Light",
    switchToDark: "Switch to Dark Mode",
    switchToLight: "Switch to Light Mode",
    switchToZh: "Switch to 中文",
    switchToEn: "Switch to English",

    // Language conflict dialog
    langConflictTitle: "This post was shared in",
    langConflictYourPreference: "Your preference is",
    langConflictReadIn: "Read in",
    langConflictKeep: "Keep",

    // 404 Not Found
    notFoundMessage: "you've wandered into the unwritten.",
    notFoundHint:
      "This page doesn't exist, or perhaps it hasn't been written yet.",
    notFoundReturn: "return home",

    // Works page (Log / Timeline)
    worksTitle: "Works",
    worksTitleHover: "Profession",
    logSubtitle:
      "Commit history. Each tag marks a chapter, each commit is a piece of work.",
    logHead: "HEAD",
    logCurrent: "Current",
    logInit: "git init",
    logExpandAll: "expand",
    logCollapseAll: "collapse",
    writingFeatured: "featured",
    logSelectedWorks: "Selected Works",
    logRead: "Read",
    logVisit: "Visit",
    logWatch: "Watch",
    logSlides: "Slides",

    // Prompts page
    promptsTitle: "System Prompts",
    promptsTitleHover: "Propositions",
    promptSubtitle:
      "Quotes, principles, and role models that shape my thinking.",
    promptShapedBy: "shaped by",
    promptTokens: "tokens",
    promptLastUpdated: "last updated",
    promptModel: "model",
  },
  zh: {
    // Navigation
    home: "首页",
    career: "职业",
    projects: "项目",
    blog: "博客",
    talks: "演讲",
    productions: "作品",

    // Homepage
    tagline: "散文、职业、编程、生产、项目——一个完整人格的多重面向。",
    currently: "近况",
    currentStatus:
      "正在构建跨平台体验。思考开发者工具、设计系统，以及工程与工艺的交汇点。",
    careerDesc: "职业历程",
    blogDesc: "写作与思考",
    talksDesc: "演讲与分享",
    navigateHint: "快速导航",

    // Homepage - AI-Native OS Voice
    greetingMorning: "早上好",
    greetingAfternoon: "下午好",
    greetingEvening: "晚上好",
    greetingNight: "夜深了",
    greetingSunrise: "日出时分",
    greetingSunset: "日落时分",
    greetingWelcomeBack: "欢迎回来",
    greetingLongTime: "好久不见",
    greetingLastReading: "上次你在读",
    greetingWhatsNew: "这是最新的内容",
    promptPlaceholder: "想找什么？",
    searchMobile: "搜索",
    searchDesktop: "搜索或使用 / 呼出命令",
    identifierWingLeft: "操作",
    identifierWingRight: "系统",
    identifierExpanded: "操作 λHUX 系统",

    // Widget labels
    widgetBlog: "写作",
    widgetTalks: "作品",
    widgetStatus: "项目",
    widgetWeather: "天气",
    widgetPrompt: "提示词",
    widgetMusic: "播放中",
    widgetMusicIdle: "音乐",
    widgetFeaturedTalks: "演讲",
    theaterOpenControls: "打开视频控制",
    theaterWatching: "观看中",
    theaterReturnPip: "画中画",
    theaterPip: "画中画",
    theaterExpand: "剧场模式",
    theaterSurfaceGroup: "播放视图",
    theaterSurfaceTheater: "剧场",
    theaterSurfacePip: "画中画",
    theaterSurfaceMini: "声音",
    theaterSurfaceMiniHint: "缩小，声音继续播放",
    theaterSurfaceNow: "当前：{surface}",
    theaterSurfaceGo: "切换到{surface}",
    widgetEditDone: "完成",
    widgetEditReset: "重置",
    musicNotPlaying: "暂无播放",
    settingsMusic: "音乐",
    musicPlay: "播放",
    musicPause: "暂停",
    musicOpenControls: "打开音乐控制",
    musicCollapse: "收起",
    musicPlaylist: "播放列表",
    musicOpenPlaylist: "浏览播放列表",
    musicClosePlaylist: "关闭播放列表",
    musicOpenOnYouTube: "在 YouTube 打开",
    musicPlaylistEmpty: "播放列表不可用",
    musicTrack: "曲目",
    widgetViewAll: "查看全部",

    // Dock / Live Activities
    dockCollapse: "收起",
    phaseSunrise: "日出",
    phaseSunset: "日落",
    phaseOpenDetails: "打开天气详情",

    // Ambient (location / weather)
    locationIp: "IP",
    locationAccurate: "精确",
    weatherUnavailable: "天气暂不可用",
    timeDay: "白天",
    timeNight: "夜晚",
    settingsLocation: "位置",
    settingsGeolocation: "地理定位",
    settingsDebugPanel: "调试面板",

    // Wallpaper (background picker)
    settingsWallpaper: "壁纸",
    settingsGlass: "玻璃",
    settingsTint: "着色",
    tintNeutral: "中性",
    tintWallpaper: "壁纸",
    glassTinted: "色调",
    glassClear: "透明",
    wallpaperTitle: "壁纸",
    wallpaperClose: "关闭壁纸选择器",
    wallpaperChoose: "环境",
    wallpaperWeather: "天气",
    wallpaperLive: "实时",
    wallpaperPreset: "预设",
    wallpaperWeatherMeta: "实时 · 环境",
    wallpaperCategoryWeather: "天气",
    wallpaperWeatherSky: "天空",
    wallpaperWeatherSkyMeta: "着色器 · WebGL",
    wallpaperWeatherGradient: "渐变",
    wallpaperWeatherGradientMeta: "CSS · 渐变",
    wallpaperWeatherClassic: "经典",
    wallpaperWeatherClassicMeta: "CSS · 渐变",
    wallpaperNoWebGL: "此浏览器不支持 WebGL2，天空会退回渐变。",
    wallpaperTilt: "陀螺仪",
    wallpaperTiltNote: "雨雪沿真实重力方向落下 —— 倾斜设备，天空随之倾斜。",
    wallpaperTiltAsk: "打开时会向浏览器申请动作权限。",
    wallpaperTiltDenied: "动作权限已被拒绝，请在浏览器的本站设置中重新允许。",
    wallpaperTiltSilent: "此设备没有动作数据，无从倾斜。",
    tiltPrimerTitle: "你发现了彩蛋！",
    tiltPrimerBody: "这里的雨雪跟着真实重力落下。开启陀螺仪，倾斜手机试试，雨会斜着掠过屏幕。",
    tiltPrimerAsk: "接下来浏览器会请求动作权限，允许即可。",
    tiltPrimerConfirm: "开启陀螺仪",
    tiltPrimerDismiss: "暂不",
    tiltPrimerAgain: "之后可在「壁纸 › 天气 › 陀螺仪」中更改。",
    tiltPrimerGranted: "陀螺仪已开启，倾斜手机试试看。",
    tiltPrimerDenied: "动作权限没有开启。可以在浏览器的本站设置里打开。",
    wallpaperCategoryApple: "Apple",
    wallpaperCategoryNature: "自然",
    wallpaperPlacement: "显示位置",
    wallpaperPlacementFull: "全屏",
    wallpaperPlacementWidget: "卡片",
    wallpaperPlacementOff: "关闭",
    wallpaperFooterNote: "壁纸版权归 Apple 所有。",
    wallpaperShuffle: "随机",
    wallpaperShuffleMeta: "乱序更换",
    wallpaperLoop: "循环",
    wallpaperLoopMeta: "按顺序更换",
    wallpaperPlayFrequency: "更换频率",
    wallpaperPlayEveryVisit: "每次访问",
    wallpaperPlayEveryHourly: "每小时",
    wallpaperPlayEveryDaily: "每天",

    // Sun theme — the theme following sunrise and sunset
    settingsSolarTheme: "跟随日出日落",
    solarThemeHint: "等日出、日落的天色走完，主题再跟上；仅在本次会话中生效，不会改写外观偏好。",
    solarThemeToLight: "浅色模式",
    solarThemeToDark: "深色模式",
    solarThemeNote: "偏好未更改",

    // The article header's provenance line, folded behind an `(i)`.
    postOrigin: "首发于何处",

    // Reading settings (the article page's "Aa")
    readingSettings: "阅读设置",
    readingSettingsTitle: "阅读",
    readingSettingsClose: "关闭阅读设置",
    readingFont: "字体",
    readingFontSans: "无衬线",
    readingFontSerif: "衬线",
    readingSize: "字号",
    readingSizeSmall: "小",
    readingSizeDefault: "标准",
    readingSizeLarge: "大",
    readingMeasure: "栏宽",
    readingMeasureNarrow: "窄",
    readingMeasureDefault: "标准",
    readingMeasureWide: "宽",
    readingFocus: "专注模式",
    readingBleed: "宽幅媒体",
    readingRuler: "标尺",
    readingRulerLeft: "左",
    readingRulerRight: "右",

    stateOn: "开",
    stateOff: "关",
    debugOverride: "覆盖",
    debugReal: "真实",
    internalDocs: "内部文档",
    devtoolTimeOfDay: "昼夜时段",

    // Career/Projects
    careerTitle: "项目",
    careerSubtitle: "角色、挑战与成长的叙事。",

    // Apps (window launcher)
    appsGroup: "应用",
    appsLoadBundle: "从 URL 加载 Lynx 包…",
    appsLoadBundleTitle: "打开 Lynx 包",
    appsLoadBundleHint: "从互联网加载任意 Lynx for Web 包",
    appsLoadBundlePlaceholder: "https://…/main.web.bundle",
    appsLoadBundleOpen: "打开",
    appsLoadBundleInvalid: "这不太像是一个有效的包地址",
    appsLoadBundleOverTheAir: "空中下载",

    // Blog/Prose (Writing page)
    writingTitle: "文字",
    writingTitleHover: "要言之有物",
    blogSubtitle: "关于技艺、软件与实践的思考",
    allLanguages: "全部",
    backToWriting: "返回写作",
    alsoIn: "也有",

    // Talks/Productions
    talksTitle: "作品",
    talksSubtitle: "演示、工作坊和演讲活动。",
    watch: "观看",
    slides: "幻灯片",

    // Docs
    docs: "文档",
    docsTitle: "文档",
    docsSubtitle: "技术架构与设计决策",
    backToDocs: "返回文档",

    // Command Palette
    searchPlaceholder: "你想找什么？",
    noResults: "未找到结果",
    navigate: "导航",
    select: "选择",
    navigation: "导航",
    settings: "设置",
    actions: "命令",
    slashCommands: "斜杠命令",
    backToSearch: "返回",
    commandPalette: "命令面板",
    commandClose: "关闭命令面板",
    appearance: "外观",
    languageLabel: "语言",
    themeSystem: "跟随系统",
    themeDark: "深色",
    themeLight: "浅色",
    switchToDark: "切换到深色模式",
    switchToLight: "切换到浅色模式",
    switchToZh: "切换到中文",
    switchToEn: "切换到 English",

    // Language conflict dialog
    langConflictTitle: "此文章分享语言为",
    langConflictYourPreference: "您的偏好语言为",
    langConflictReadIn: "阅读",
    langConflictKeep: "保持",

    // 404 Not Found
    notFoundMessage: "你来到了没有知识的荒原",
    notFoundHint: "这个页面不存在，或许它还未被书写。",
    notFoundReturn: "返回首页",

    // Works page (Log / Timeline)
    worksTitle: "工作",
    worksTitleHover: "术业有专攻",
    logSubtitle: "提交历史。每个标签标记一个篇章，每个提交都是一件作品。",
    logHead: "HEAD",
    logCurrent: "当前",
    logInit: "git init",
    logExpandAll: "展开",
    logCollapseAll: "收起",
    writingFeatured: "精选",
    logSelectedWorks: "精选作品",
    logRead: "阅读",
    logVisit: "访问",
    logWatch: "观看",
    logSlides: "幻灯片",

    // Prompts page
    promptsTitle: "系统提示词",
    promptsTitleHover: "闻道有先后",
    promptSubtitle: "塑造我思维的名言、原则和榜样。",
    promptShapedBy: "受启发于",
    promptTokens: "tokens",
    promptLastUpdated: "更新于",
    promptModel: "模型",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}

// =============================================================================
// Page Title Configuration
// Used by PageLayout for scramble-enabled titles with i18n support
// =============================================================================

/** Page identifiers that have title + hover translations */
export type ScramblePage = "writing" | "works" | "prompts";

/** Get the appropriate Chinese character set for a page */
export function getScrambleCharacterSet(
  locale: Locale,
  page?: ScramblePage
): string {
  if (locale === "en") {
    return scrambleCharacterSets.en;
  }
  // For Chinese, use page-specific set or fallback to default
  return page
    ? scrambleCharacterSets.zh[page]
    : scrambleCharacterSets.zh.default;
}
