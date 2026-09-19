import { ReadingRootSync } from "@/components/post/reading-settings";
import { bezelBootResolver } from "@/systems/ambient/lib/bezel";
import { AmbientPhaseActivity } from "@/systems/ambient/components/phase-activity";
import { AmbientSurface } from "@/systems/ambient/components/surface";
import { SolarThemeSync } from "@/systems/ambient/components/solar-theme";
import { TiltPrimerSheet } from "@/systems/ambient/components/tilt-primer-sheet-lazy";
import { WallpaperSheet } from "@/systems/ambient/components/wallpaper-sheet-lazy";
import { bezelBootScript } from "@hux/bezel";
import { Providers } from "@/shared/providers";
import { CommandPalette } from "@/systems/command/palette";
import { FloatingActionButton } from "@/systems/command/fab";
import { DevtoolFAB } from "@/systems/devtool/dock";
import { Dock } from "@/systems/dock/components";
import { MusicActivity } from "@/systems/music/components/music-activity";
import { MusicPlaylistSheet } from "@/systems/music/components/playlist-sheet-lazy";
import { TheaterActivity } from "@/systems/theater/components/theater-activity";
import { TheaterRegistrar } from "@/systems/theater/components/registrar";
import { TheaterSurfaces } from "@/systems/theater/components/surfaces";
import { MinimizedWindows } from "@/systems/windows/components/minimized-dock";
import { WindowLayer } from "@/systems/windows/components/window-layer";
import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import {
  Inter,
  JetBrains_Mono,
  Newsreader,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-serif-latin",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-serif-cjk",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hux.pro"),
  title: {
    default: "Hux.Pro",
    template: "%s | Hux.Pro",
  },
  description: "Prose, Profession, Programming, Production, Projects",
  // Generative app icon — authored in `/editor/icon`, rendered from
  // `content/icon.json` by `pnpm icon:generate`. SVG for modern browser tabs,
  // PNG apple-touch-icon for the iOS home screen; Android/PWA icons come from
  // the web manifest (app/manifest.ts). favicon.ico covers legacy.
  // `app/favicon.ico` is auto-linked by Next's file convention; we add the
  // modern SVG and the iOS apple-touch-icon PNG on top.
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    siteName: "Hux.Pro",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // theme-color is owned by @hux/bezel at runtime (the page ground, or the
  // bezel colour while the bezel is on). Rendering static ones here would hand
  // React a node the package then mutates, which is a hydration mismatch once
  // Next streams the metadata in.
};

/**
 * The bezel's first frame, before React runs: @hux/bezel's boot script with
 * this site's resolver (see @/systems/ambient/lib/bezel), which makes the same
 * decisions as the ambient provider from localStorage and the platform.
 */
const BEZEL_BOOT = bezelBootScript(bezelBootResolver());

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Before first paint: Safari picks its chrome colour at load, from
              the root background (iOS 26) or theme-color (iOS 18). */}
          <script dangerouslySetInnerHTML={{ __html: BEZEL_BOOT }} />
        </head>
        <body
          className={`${inter.variable} ${newsreader.variable} ${notoSerifSC.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        >
          <Providers>
            <ReadingRootSync />
            <SolarThemeSync />
            <DevtoolFAB />
            <AmbientSurface>{children}</AmbientSurface>
            <WindowLayer />
            <Dock>
              <AmbientPhaseActivity />
              <MusicActivity />
              <TheaterActivity />
              <MinimizedWindows />
            </Dock>
            <MusicPlaylistSheet />
            <WallpaperSheet />
            <TiltPrimerSheet />
            <TheaterRegistrar />
            <TheaterSurfaces />
            <CommandPalette />
            <FloatingActionButton />
          </Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}
