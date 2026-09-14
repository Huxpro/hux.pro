import { ReadingRootSync } from "@/components/post/reading-settings";
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
  // theme, and goes black while letterboxed). Rendering static ones here would
  // hand React a node the provider then mutates, which is a hydration mismatch
  // once Next streams the metadata in.
};

/**
 * Mirrors the provider's resolution — the letterbox frame colour (#1a1a1a) when
 * letterboxed, else the theme's page ground — from what is knowable before
 * React runs: the stored ambient setting, the platform, the stored theme, the
 * system theme.
 */
const THEME_COLOR_BOOT = `(function(){try{
var s=JSON.parse(localStorage.getItem("hux_ambient_settings")||"{}");
var ios=/iP(hone|ad|od)/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var box=typeof s.wallpaperLetterbox==="boolean"?s.wallpaperLetterbox:ios;
var t=localStorage.getItem("hux_theme");
var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
if(box){var d=document.documentElement;d.classList.add("letterbox");d.style.backgroundColor="#1a1a1a";}
var m=document.createElement("meta");m.id="hux-theme-color";m.name="theme-color";
m.content=box||dark?"#1a1a1a":"#ffffff";document.head.appendChild(m);
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
              before first paint. Safari tints its chrome from theme-color and
              from the html/body background, reads them at load, and on a phone
              never revisits them — so the frame colour has to be there before
              the stylesheet has even arrived, whatever theme the page opens
              in. Owned by this script and the ambient provider, never by
              React — see the note on `viewport` above. */}
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
