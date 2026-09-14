import { ReadingRootSync } from "@/components/post/reading-settings";
import {
  DEFAULT_LETTERBOX_TINT,
  PAGE_GROUND,
} from "@/systems/ambient/lib/settings";
import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_BAND_VAR,
  BEZEL_BLACK,
  BEZEL_CLASS,
  BEZEL_COLOR_VAR,
  BEZEL_HEX_PATTERN,
  DEFAULT_BEZEL_BAND,
} from "@/systems/bezel";
import { Providers } from "@/shared/providers";
import {
  AmbientPhaseActivity,
  AmbientSurface,
  WallpaperSheet,
} from "@/systems/ambient";
import { CommandPalette, FloatingActionButton } from "@/systems/command";
import { DevtoolFAB } from "@/systems/devtool";
import { Dock } from "@/systems/dock";
import { MusicActivity, MusicPlaylistSheet } from "@/systems/music";
import {
  TheaterActivity,
  TheaterRegistrar,
  TheaterSurfaces,
} from "@/systems/theater";
import { MinimizedWindows, WindowLayer } from "@/systems/windows";
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
  // theme-color is owned by the ambient provider at runtime (it follows the
  // theme, and takes the frame colour while letterboxed). Rendering static
  // ones here would hand React a node the provider then mutates, which is a
  // hydration mismatch once Next streams the metadata in.
};

/**
 * Mirrors the provider's resolution — the frame's colour and thickness when
 * letterboxed, else the theme's page ground — from what is knowable before
 * React runs: the stored ambient settings, the platform, the stored theme, the
 * system theme. It cannot import at runtime, so every constant it needs is
 * interpolated from `@/systems/bezel` and the two resolutions cannot drift.
 * This is the pre-paint half of `applyBezelVars`; <Bezel> owns the rest.
 */
const THEME_COLOR_BOOT = `(function(){try{
var s=JSON.parse(localStorage.getItem("hux_ambient_settings")||"{}");
var ios=/iP(hone|ad|od)/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var box=typeof s.wallpaperLetterbox==="boolean"?s.wallpaperLetterbox:ios;
var t=localStorage.getItem("hux_theme");
var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
var ground=dark?${JSON.stringify(PAGE_GROUND.dark)}:${JSON.stringify(PAGE_GROUND.light)};
var tint=s.wallpaperLetterboxTint;
if(!/^(dark|black|theme|${BEZEL_HEX_PATTERN.slice(1, -1)})$/.test(tint))tint=${JSON.stringify(DEFAULT_LETTERBOX_TINT)};
var c=tint==="black"?${JSON.stringify(BEZEL_BLACK)}:tint==="theme"?ground:tint==="dark"?${JSON.stringify(PAGE_GROUND.dark)}:tint;
var band=+s.wallpaperLetterboxBand;
band=isFinite(band)?Math.min(${BEZEL_BAND_MAX},Math.max(${BEZEL_BAND_MIN},Math.round(band))):${DEFAULT_BEZEL_BAND};
if(box){var d=document.documentElement;d.classList.add(${JSON.stringify(BEZEL_CLASS)});
d.style.setProperty(${JSON.stringify(BEZEL_COLOR_VAR)},c);
d.style.setProperty(${JSON.stringify(BEZEL_BAND_VAR)},band+"px");
d.style.backgroundColor=c;}
var m=document.createElement("meta");m.id="hux-theme-color";m.name="theme-color";
m.content=box?c:ground;document.head.appendChild(m);
}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* theme-color, the letterbox class AND an inline html background
              before first paint. This is what iOS 18 Safari needs: it tints
              the status bar from theme-color and the collapsed toolbar from
              the html background, and both have to be right from the first
              frame, whatever theme the page opens in. iOS 26 ignores
              theme-color and samples the page's own edge pixels instead — the
              bezel's bands handle that, and they are sized by a custom
              property this also sets (see @/systems/bezel). Owned by this
              script, <Bezel> and the ambient provider, never by React — see
              the note on `viewport` above. */}
          <script
            dangerouslySetInnerHTML={{ __html: THEME_COLOR_BOOT }}
          />
        </head>
        <body
          className={`${inter.variable} ${newsreader.variable} ${notoSerifSC.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        >
          <Providers>
            <ReadingRootSync />
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
