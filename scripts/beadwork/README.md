# 拼豆图纸 · Bead patterns

Pixel-art sources and a chart renderer for MARD 221 perler-bead patterns.

Nothing here is part of the site build — it is a small standalone toolchain.

## Files

| File | What it is |
|------|------------|
| `groom.py` | The 新郎 Groom artwork: a 42 × 41 grid painted region by region. Edit the spans, not a bitmap. |
| `chart.py` | Renders any artwork module as a printable HTML chart (grid + rulers + bead list). |
| `preview.py` | Renders the same artwork as a true-colour PNG, for eyeballing it. |
| `groom-chart.html` | The generated chart. |
| `groom-preview.png` | The generated preview. |

## Usage

```bash
python3 preview.py groom 12 groom-preview.png
python3 chart.py groom groom-chart.html "新郎 Groom · 拼豆图纸（MARD 221）" "新郎拼豆图纸"
```

`preview.py` needs Pillow; `chart.py` needs nothing.

## Board scale

The groom shares the 新娘 Bride board exactly — 42 × 41 cells, head 31 rows tall,
one bead per cell — so the two hang as a pair at identical scale.

## Palette

Colour codes are real [MARD 221](https://www.pixel-beads.com/zh/mard-bead-color-chart)
codes, and the set is a subset of the bride chart's, so one bead order covers both:

- `H7 / H6 / H5` blacks and greys — hair, jacket
- `E14 / G16 / G3 / A12` skin
- `M13 / G13` warm shadow — neck, jaw
- `G10 / A8 / M9` gold — glasses, collar clasp, button
- `F20` lips, `H17` eye whites

A new artwork module only has to expose `PALETTE` (char → `(code, hex, label)`)
and `rows()` (a list of equal-length strings, `.` for an empty cell).
