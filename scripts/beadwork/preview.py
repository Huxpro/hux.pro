# -*- coding: utf-8 -*-
"""Render a pixel preview PNG of a bead grid (for eyeballing the artwork)."""
import sys, importlib
from PIL import Image

mod = importlib.import_module(sys.argv[1] if len(sys.argv) > 1 else "groom")
scale = int(sys.argv[2]) if len(sys.argv) > 2 else 14
out = sys.argv[3] if len(sys.argv) > 3 else "preview.png"

rows = mod.rows()
W, H = len(rows[0]), len(rows)
img = Image.new("RGB", (W * scale, H * scale), (255, 255, 255))
px = img.load()
for y, line in enumerate(rows):
    for x, ch in enumerate(line):
        if ch == ".":
            continue
        hexv = mod.PALETTE[ch][1]
        rgb = tuple(int(hexv[i:i+2], 16) for i in (1, 3, 5))
        for dy in range(scale):
            for dx in range(scale):
                px[x * scale + dx, y * scale + dy] = rgb
img.save(out)
print(f"{out}  {W}x{H} grid -> {img.size[0]}x{img.size[1]}px")
