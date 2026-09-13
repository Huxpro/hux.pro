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
    theaterSurfaceGroup: "Player view",
    theaterSurfaceTheater: "Theater",
    theaterSurfacePip: "PiP",
    theaterSurfaceMini: "Audio",
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
    settingsWeatherGradient: "Weather Gradient",
    settingsDebugPanel: "Debug Panel",
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
    theaterSurfaceGroup: "播放视图",
    theaterSurfaceTheater: "剧场",
    theaterSurfacePip: "画中画",
    theaterSurfaceMini: "音频",
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
    settingsWeatherGradient: "天气渐变",
    settingsDebugPanel: "调试面板",
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
