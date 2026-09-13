import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  DEFAULT_WALLPAPER,
  parseWallpaper,
  resolveWallpaper,
  WALLPAPERS,
  wallpaperImage,
} from "../systems/wallpaper/catalog.ts";
import {
  getAmbientSettings,
  setAmbientSettings,
} from "../systems/ambient/lib/settings.ts";

function withStorage(
  value: string | null,
  run: (read: () => string | null) => void,
) {
  let stored = value;
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () => stored,
      setItem: (_: string, value: string) => {
        stored = value;
      },
    },
    configurable: true,
  });
  try {
    run(() => stored);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("legacy weather settings migrate without enabling backgrounds that were off", () => {
  for (const mode of ["full", "widget", "off", "adaptive"]) {
    withStorage(
      JSON.stringify({ locationMode: "accurate", weatherGradientMode: mode }),
      () => {
        const settings = getAmbientSettings();
        assert.equal(
          settings.wallpaper.source,
          mode === "off" ? "none" : "weather",
        );
        assert.equal(
          settings.weatherGradientMode,
          mode === "adaptive" ? "full" : mode,
        );
        assert.equal(settings.locationMode, "accurate");
      },
    );
  }
  withStorage(null, () =>
    assert.equal(
      getAmbientSettings({ isIOS: true }).weatherGradientMode,
      "widget",
    ),
  );
});

test("malformed storage and removed wallpaper IDs safely fall back", () => {
  for (const raw of ["null", "broken json", "42", "{}"])
    withStorage(raw, () =>
      assert.deepEqual(getAmbientSettings().wallpaper, DEFAULT_WALLPAPER),
    );
  assert.deepEqual(
    parseWallpaper({
      source: "image",
      light: "removed",
      dark: "bad",
      appearance: "bad",
    }),
    { ...DEFAULT_WALLPAPER, source: "image" },
  );
});

test("custom pairs follow appearance and fixed variants ignore theme changes", () => {
  const settings = {
    ...DEFAULT_WALLPAPER,
    light: "ios-13" as const,
    dark: "monterey" as const,
  };
  assert.equal(
    resolveWallpaper(settings, "light").src,
    "/wallpapers/ios-13-light.webp",
  );
  assert.equal(
    resolveWallpaper(settings, "dark").src,
    "/wallpapers/monterey-dark.webp",
  );
  assert.equal(
    resolveWallpaper({ ...settings, appearance: "light" }, "dark").id,
    "ios-13",
  );
  assert.equal(
    resolveWallpaper({ ...settings, appearance: "dark" }, "light").id,
    "monterey",
  );
});

test("image preferences survive reload without losing weather placement", () => {
  withStorage(null, (read) => {
    const settings = getAmbientSettings();
    settings.wallpaper = {
      source: "image",
      light: "ios-14",
      dark: "monterey",
      appearance: "auto",
    };
    settings.weatherGradientMode = "widget";
    setAmbientSettings(settings);
    assert.ok(read());
    assert.deepEqual(getAmbientSettings(), settings);
  });
});

test("all built-in light/dark images and thumbnails are shipped and match provenance hashes", () => {
  const dir = new URL("../public", import.meta.url);
  const manifest = JSON.parse(
    readFileSync(
      new URL("../public/wallpapers/sources.json", import.meta.url),
      "utf8",
    ),
  );
  for (const wallpaper of WALLPAPERS)
    for (const variant of ["light", "dark"] as const)
      for (const thumbnail of [true, false]) {
        const asset = wallpaperImage(wallpaper.id, variant, thumbnail);
        const file = `${dir.pathname}${asset}`;
        assert.ok(existsSync(file), asset);
        const record = manifest.assets.find(
          (a: { file: string }) => a.file === asset.split("/").pop(),
        );
        assert.ok(record, asset);
        assert.equal(
          createHash("sha256").update(readFileSync(file)).digest("hex"),
          record.sha256,
        );
        assert.ok(
          Math.max(record.width, record.height) <= (thumbnail ? 480 : 2400),
        );
      }
});
