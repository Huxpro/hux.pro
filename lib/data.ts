import { type BlogPost } from "./content";

// Re-export types
export type { BlogPost };

export interface TalkData {
  id: string;
  title: string;
  titleZh?: string;
  event: string;
  date: string;
  location: string;
  video?: string;
  slides?: string;
  description?: string;
  descriptionZh?: string;
}

// Static data for client-side search in command palette
// This mirrors the MDX frontmatter for quick access without fs
export const blogPosts: BlogPost[] = [
  {
    slug: "building-design-systems",
    language: "both",
    title: "Building Design Systems That Scale",
    titleZh: "构建可扩展的设计系统",
    date: "2024-01-15",
    description:
      "Thoughts on creating maintainable component libraries and the patterns that make them work.",
    descriptionZh: "关于创建可维护的组件库以及使其工作的模式的思考。",
    tags: ["design systems", "components", "frontend"],
  },
  {
    slug: "developer-experience",
    language: "en",
    title: "On Developer Experience",
    date: "2023-11-20",
    description:
      "Why DX matters and how we can create tools that developers actually want to use.",
    tags: ["developer experience", "DX", "tools"],
  },
  {
    slug: "cross-platform-future",
    language: "both",
    title: "The Future of Cross-Platform Development",
    titleZh: "跨平台开发的未来",
    date: "2023-09-05",
    description:
      "Exploring the landscape of cross-platform frameworks and where we're headed.",
    descriptionZh: "探索跨平台框架的现状与未来走向。",
    tags: ["cross-platform", "mobile", "frameworks"],
  },
  {
    slug: "react-patterns-zh",
    language: "zh",
    title: "React 设计模式实践",
    date: "2023-07-10",
    description: "分享在大型项目中使用 React 的设计模式和最佳实践。",
    tags: ["React", "设计模式", "前端"],
  },
];

export const talks: TalkData[] = [
  {
    id: "cross-platform-at-scale",
    title: "Building for the Future: Cross-Platform at Scale",
    titleZh: "构建未来：大规模跨平台开发",
    event: "Tech Conference 2024",
    date: "2024-03-15",
    location: "San Francisco, CA",
    video: "https://youtube.com/watch?v=example1",
    slides: "https://slides.com/example1",
    description:
      "A deep dive into building cross-platform applications that scale to millions of users.",
    descriptionZh: "深入探讨构建可扩展至百万用户的跨平台应用。",
  },
  {
    id: "design-systems-tokens",
    title: "Design Systems: From Tokens to Components",
    titleZh: "设计系统：从令牌到组件",
    event: "Frontend Summit",
    date: "2023-10-20",
    location: "Virtual",
    slides: "https://slides.com/example2",
    description:
      "How to build a design system that bridges the gap between design and engineering.",
    descriptionZh: "如何构建一个连接设计与工程的设计系统。",
  },
  {
    id: "developer-experience-art",
    title: "The Art of Developer Experience",
    titleZh: "开发者体验的艺术",
    event: "DevTools Conf",
    date: "2023-06-12",
    location: "Seattle, WA",
    video: "https://youtube.com/watch?v=example3",
    description: "What makes developer tools delightful and how to build them.",
    descriptionZh: "是什么让开发者工具令人愉悦，以及如何构建它们。",
  },
];
