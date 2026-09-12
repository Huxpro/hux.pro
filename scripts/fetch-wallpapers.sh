#!/usr/bin/env bash
# Download Apple built-in wallpaper pairs and compress them for the site.
# Sources: wallpapers.poutanen.dev (Apple stock archive).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/wallpapers"
SRC="/tmp/wallpapers-src"
mkdir -p "$OUT" "$SRC"

scale_pair() {
  local id="$1"
  local light_src="$2"
  local dark_src="$3"
  local dest="$OUT/$id"
  mkdir -p "$dest"

  if [[ -f "$dest/light.jpg" && -f "$dest/dark.jpg" && -f "$dest/light.thumb.jpg" && -f "$dest/dark.thumb.jpg" ]]; then
    echo "skip $id (already processed)"
    return 0
  fi

  echo ">> $id"
  curl -fL --retry 4 --retry-delay 2 -o "$SRC/${id}-light.src" "$light_src"
  curl -fL --retry 4 --retry-delay 2 -o "$SRC/${id}-dark.src" "$dark_src"

  # Longer side ≤ 2560, JPEG q≈78. Portrait iOS wallpapers stay portrait.
  local vf="scale='if(gte(iw,ih),min(2560,iw),-2)':'if(gte(ih,iw),min(2560,ih),-2)'"
  ffmpeg -y -hide_banner -loglevel error -i "$SRC/${id}-light.src" -vf "$vf" -q:v 5 "$dest/light.jpg"
  ffmpeg -y -hide_banner -loglevel error -i "$SRC/${id}-dark.src" -vf "$vf" -q:v 5 "$dest/dark.jpg"
  ffmpeg -y -hide_banner -loglevel error -i "$dest/light.jpg" -vf "scale=480:-2" -q:v 6 "$dest/light.thumb.jpg"
  ffmpeg -y -hide_banner -loglevel error -i "$dest/dark.jpg" -vf "scale=480:-2" -q:v 6 "$dest/dark.thumb.jpg"
  rm -f "$SRC/${id}-light.src" "$SRC/${id}-dark.src"
  ls -lh "$dest"
}

BASE="https://wallpapers.poutanen.dev"

# macOS default pairs
scale_pair tahoe   "$BASE/macos-tahoe-light.jpg"     "$BASE/macos-tahoe-dark.jpg"
scale_pair sequoia "$BASE/15-Sequoia-Light-6K.jpg"   "$BASE/15-Sequoia-Dark-6K.jpg"
scale_pair sonoma  "$BASE/14-Sonoma-Light.jpg"       "$BASE/14-Sonoma-Dark.jpg"
scale_pair ventura "$BASE/13-Ventura-Light.jpg"      "$BASE/13-Ventura-Dark.jpg"
scale_pair big-sur "$BASE/macOS-Big-Sur-Light.jpg"   "$BASE/macOS-Big-Sur-Dark.jpg"

# iOS / iPadOS default pairs
scale_pair ios-27  "$BASE/iOS27-Home-Light.png"      "$BASE/iOS27-Home-Dark.png"
scale_pair ios-18  "$BASE/ios-18-light.png"          "$BASE/ios-18-dark.png"
scale_pair ios-17  "$BASE/iOS-17-Light.jpg"          "$BASE/iOS-17-Dark.jpg"

echo "done"
du -sh "$OUT" "$OUT"/*
