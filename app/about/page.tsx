import type { Metadata } from "next";
import Home from "@/app/page";

export const metadata: Metadata = {
  title: "About",
  description:
    "Hux (Xuan Huang) — interfaces, tools, and an experiment in a personal operating system.",
};

// The global About surface opens for this address; home waits underneath.
export default Home;
