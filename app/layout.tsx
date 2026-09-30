import { ReadingRootSync } from "@/components/post/reading-settings";
import { bezelBootResolver } from "@/systems/ambient/lib/bezel";
import { vitreBootScript } from "vitre";
import { Providers } from "@/shared/providers";
import {
  AmbientPhaseActivity,
  AmbientSurface,
  LocationPrimerSheet,
  SettleSpinner,
  SkyPullCue,
  SkyBodyHints,
  SolarThemeSync,
  SkyWindowSheet,
  TiltPrimerSheet,
  WallpaperSheet,
} from "@/systems/ambient";
import { AboutSurface } from "@/systems/about";
import { AboutCopy } from "@/systems/about/components/about-copy";
import { AttachmentSurface, ImageLightbox } from "@/systems/attachments";
import { IdentityCard } from "@/systems/identity";
import { InstallSheet } from "@/systems/install";
import { CommandPalette, FloatingActionButton } from "@/systems/command";
import { DevtoolFAB } from "@/systems/devtool";
import { OS_THEME_BOOT } from "@/systems/os/lib/boot";
import { Dock } from "@/systems/dock";
import { MusicActivity, MusicPlaylistSheet } from "@/systems/music";
import {
  TheaterActivity,
  TheaterPlaylistSheet,
  TheaterRegistrar,
  TheaterSurfaces,
} from "@/systems/theater";
import { MinimizedWindows, WindowLayer } from "@/systems/windows";
import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import {
  Google_Sans_Flex,
  Inter,
  JetBrains_Mono,
  Newsreader,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";

// Italic is loaded, not synthesized. The site marks Latin work titles with
// it (`*The Gay Science*`), and a slanted-by-the-browser Inter is a sheared
// roman, not Inter Italic — which is drawn, with its own `a` and `f`.
// The faces load under their own names (`--font-inter`, …). The *roles* —
// `--font-sans`, `--font-serif`, `--font-mono` — are tokens in globals.css
// that point at them, so an OS theme can re-point a role at another face
// (the Android theme sets sans and mono in Google Sans Flex) without losing
// the face itself: code stays in JetBrains Mono through `--font-code`.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  style: ["normal", "italic"],
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

// Same reason as Inter: a work title keeps its italic in the machine row too.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// The Android theme's face (services/os-theme.tsx): Material 3 Expressive's
// brand type, with its roundness axis. Not preloaded — the font is only
// fetched once something set in it renders, so a visitor in the Hux theme
// never downloads it.
const googleSansFlex = Google_Sans_Flex({
  variable: "--font-flex",
  subsets: ["latin"],
  axes: ["ROND", "opsz"],
  display: "swap",
  preload: false,
  // next/font has no metrics for this family to size a fallback with.
  adjustFontFallback: false,
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
  // theme-color is owned by vitre at runtime (the page ground, or the
  // bezel colour while the bezel is on). Rendering static ones here would hand
  // React a node the package then mutates, which is a hydration mismatch once
  // Next streams the metadata in.
};

/**
 * The bezel's first frame, before React runs: vitre's boot script with
 * this site's resolver (see @/systems/ambient/lib/bezel), which makes the same
 * decisions as the ambient provider from localStorage and the platform.
 */
const BEZEL_BOOT = vitreBootScript(bezelBootResolver());

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
          {/* The stored OS theme onto <html> before first paint, so a
              returning visitor never sees the other theme flash
              (services/os-theme.tsx). */}
          <script dangerouslySetInnerHTML={{ __html: OS_THEME_BOOT }} />
        </head>
        <body
          className={`${inter.variable} ${googleSansFlex.variable} ${newsreader.variable} ${notoSerifSC.variable} ${jetbrainsMono.variable} font-sans antialiased`}
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
            <TheaterPlaylistSheet />
            <WallpaperSheet />
            <TiltPrimerSheet />
            <SkyWindowSheet />
            <LocationPrimerSheet />
            <SettleSpinner />
            <SkyPullCue />
            <SkyBodyHints />
            <InstallSheet />
            <TheaterRegistrar />
            <TheaterSurfaces />
            <AttachmentSurface />
            <ImageLightbox />
            <IdentityCard />
            <AboutSurface
              en={<AboutCopy locale="en" />}
              zh={<AboutCopy locale="zh" />}
            />
            <CommandPalette />
            <FloatingActionButton />
          </Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}
