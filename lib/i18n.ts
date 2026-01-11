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
// Translations
// =============================================================================

export const translations = {
  en: {
    // Navigation
    home: "Home",
    career: "Career",
    projects: "Projects",
    blog: "Blog",
    prose: "Prose",
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
    greetingMorning: "good morning.",
    greetingAfternoon: "good afternoon.",
    greetingEvening: "good evening.",
    greetingNight: "good night.",
    greetingSunrise: "the sun is rising.",
    greetingSunset: "the sun is setting.",
    greetingWelcomeBack: "welcome back.",
    greetingLongTime: "it's been a while.",
    greetingLastReading: "last time you were reading",
    greetingWhatsNew: "here's what's new.",
    promptPlaceholder: "What brings you to here?",
    searchMobile: "Search",
    searchDesktop: "Search or / for commands",

    // Widget labels
    widgetBlog: "/prose",
    widgetTalks: "/productions",
    widgetStatus: "processing",
    widgetWeather: "weather",
    widgetViewAll: "view all",

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

    // Blog/Prose
    blogTitle: "Prose",
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
  },
  zh: {
    // Navigation
    home: "首页",
    career: "职业",
    projects: "项目",
    blog: "博客",
    prose: "散文",
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

    // Widget labels
    widgetBlog: "/散文",
    widgetTalks: "/作品",
    widgetStatus: "处理中",
    widgetWeather: "天气",
    widgetViewAll: "查看全部",

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

    // Blog/Prose
    blogTitle: "散文",
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
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
