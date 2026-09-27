import { toBlogPostSummaries } from "@/lib/content";
import { getAllBlogPosts } from "@/lib/mdx";
import type { Metadata } from "next";
import { HomeView } from "../home-view";
import { AboutRoute } from "./about-route";

export const metadata: Metadata = {
  title: "About",
  description:
    "Hux builds the layer between people and machines: languages, frameworks, and the interfaces on top of them. This site is an experiment in a personal website as an operating system.",
};

/**
 * `/about` is the home screen with the About already up — the address to
 * share. The About itself is a surface over every page (systems/about); this
 * route only asks for it.
 */
export default function About() {
  const posts = toBlogPostSummaries(getAllBlogPosts());
  return (
    <>
      <HomeView posts={posts} />
      <AboutRoute />
    </>
  );
}
