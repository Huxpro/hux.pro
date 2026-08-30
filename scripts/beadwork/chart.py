# -*- coding: utf-8 -*-
"""Render a bead grid as a printable 拼豆图纸 (MARD 221) chart.

Usage: python3 chart.py <art-module> <out.html> "<headline>" "<page title>"
"""
import sys
import importlib
from collections import Counter

mod = importlib.import_module(sys.argv[1] if len(sys.argv) > 1 else "groom")
out = sys.argv[2] if len(sys.argv) > 2 else "chart.html"
headline = sys.argv[3] if len(sys.argv) > 3 else "拼豆图纸"
page_title = sys.argv[4] if len(sys.argv) > 4 else headline

rows = mod.rows()
PAL = mod.PALETTE
GH, GW = len(rows), len(rows[0])

counts = Counter(ch for line in rows for ch in line if ch != ".")
total = sum(counts.values())
ncolors = len(counts)


def lum(hexv):
    r, g, b = (int(hexv[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ink(hexv):
    return "#ffffff" if lum(hexv) < 0.30 else "#16161a"


# ------------------------------------------------------- true-colour preview
SW = 5
sw_rects = []
for r, line in enumerate(rows):
    for c, ch in enumerate(line):
        if ch != ".":
            sw_rects.append(
                f'<rect x="{c * SW}" y="{r * SW}" width="{SW}" height="{SW}" '
                f'fill="{PAL[ch][1]}"/>'
            )
preview = (
    f'<svg class="thumb" viewBox="0 0 {GW * SW} {GH * SW}" '
    f'width="{GW * SW}" height="{GH * SW}" role="img" '
    f'aria-label="成品预览"><rect width="100%" height="100%" fill="#ffffff"/>'
    f'{"".join(sw_rects)}</svg>'
)

# ---------------------------------------------------------------- grid cells
cells = []
for r in range(GH):
    label = r + 1 if (r + 1) % 5 == 0 or r == 0 else ""
    cells.append(f'<div class="rn">{label}</div>')
    for c in range(GW):
        ch = rows[r][c]
        cls = []
        if c % 5 == 0:
            cls.append("l5")
        if r % 5 == 0:
            cls.append("t5")
        if c == GW - 1:
            cls.append("r5")
        if r == GH - 1:
            cls.append("b5")
        klass = (' class="' + " ".join(cls) + '"') if cls else ""
        if ch == ".":
            cells.append(f"<div{klass}></div>")
        else:
            code, hexv, _ = PAL[ch]
            cells.append(
                f'<div{klass} style="background:{hexv};color:{ink(hexv)}">{code}</div>'
            )

ruler = ['<div class="rn"></div>']
for c in range(GW):
    n = c + 1
    ruler.append(f"<div>{n if n % 5 == 0 or n == 1 else ''}</div>")

# ------------------------------------------------------------------- legend
order = sorted(counts, key=lambda ch: (-counts[ch], PAL[ch][0]))
legend = []
for ch in order:
    code, hexv, label = PAL[ch]
    pct = counts[ch] / total * 100
    legend.append(
        f'<li><span class="sw" style="background:{hexv}"></span>'
        f'<span class="code">{code}</span>'
        f'<span class="nm">{label}</span>'
        f'<span class="hx">{hexv.upper()}</span>'
        f'<span class="ct">{counts[ch]}</span>'
        f'<span class="pc">{pct:.1f}%</span></li>'
    )

html = f"""<title>{page_title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap">
<style>
  /* A bead chart is a worksheet you print and lay next to the pegboard, so it
     commits to one world: white paper, so every bead colour is judged against
     the same ground it will be judged against on the board. */
  :root {{
    --paper:  #ffffff;
    --ink:    #17171a;
    --dim:    #8b8b90;
    --faint:  #b6b6bb;
    --hair:   #e7e7e9;   /* 1-cell gridline  */
    --rule:   #a9a9ae;   /* every 5th line   */
    --gold:   #c88135;   /* taken from the piece itself (MARD G10) */
    --cell:   27px;
    --sans:   "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
              "PingFang SC", "Hiragino Sans GB", "Noto Sans SC",
              "Microsoft YaHei", sans-serif;
    --mono:   "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    background: var(--paper); color: var(--ink);
    font: 400 14px/1.55 var(--sans);
    padding: 40px 44px 64px;
  }}

  header {{
    display: flex; align-items: flex-start; gap: 26px;
    flex-wrap: wrap; margin-bottom: 34px;
  }}
  .thumb {{
    width: 84px; height: auto; flex: none;
    box-shadow: 0 0 0 1px var(--hair);
  }}
  .titles {{ flex: 1 1 320px; min-width: 260px; }}
  h1 {{
    font-size: 22px; font-weight: 600; margin: 0 0 6px;
    letter-spacing: -.005em; text-wrap: balance;
  }}
  .sub {{ color: var(--dim); font-size: 13px; margin: 0; }}
  .meta {{
    display: flex; gap: 20px; margin-left: auto; padding-top: 3px;
    font-family: var(--mono); font-size: 12px; color: var(--dim);
    font-variant-numeric: tabular-nums;
  }}
  .meta b {{ color: var(--ink); font-weight: 500; }}
  .meta .tag {{ color: var(--gold); font-weight: 500; }}

  .sheet {{ overflow-x: auto; padding-bottom: 6px; }}
  .grid {{
    display: grid;
    grid-template-columns: 28px repeat({GW}, var(--cell));
    width: max-content;
  }}
  .grid > div {{
    height: var(--cell);
    border-right: 1px solid var(--hair);
    border-bottom: 1px solid var(--hair);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 8.5px; font-weight: 500;
    line-height: 1; letter-spacing: -.03em;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }}
  .grid > div.l5 {{ border-left: 1px solid var(--rule); }}
  .grid > div.t5 {{ border-top: 1px solid var(--rule); }}
  .grid > div.r5 {{ border-right-color: var(--rule); }}
  .grid > div.b5 {{ border-bottom-color: var(--rule); }}
  .grid > .rn {{
    border: 0; color: var(--faint); font-size: 10px; font-weight: 400;
    justify-content: flex-end; padding-right: 8px;
    font-variant-numeric: tabular-nums;
  }}
  .ruler > div {{
    height: 21px; border: 0 !important; color: var(--faint);
    font-family: var(--mono); font-size: 10px;
    align-items: flex-end; font-variant-numeric: tabular-nums;
  }}

  h2 {{
    font-size: 11px; font-weight: 600; color: var(--dim);
    letter-spacing: .1em; text-transform: uppercase;
    margin: 42px 0 14px;
  }}
  ul {{
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
    gap: 0 34px; max-width: 1200px;
  }}
  li {{
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; padding: 5px 0;
    border-bottom: 1px solid var(--hair);
  }}
  .sw {{
    width: 15px; height: 15px; border-radius: 2px; flex: none;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.18);
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }}
  .code {{ font-family: var(--mono); font-weight: 700; min-width: 30px; }}
  .nm {{ color: var(--dim); }}
  .hx {{
    font-family: var(--mono); font-size: 10.5px; color: var(--faint);
    margin-left: auto;
  }}
  .ct, .pc {{
    font-family: var(--mono); font-variant-numeric: tabular-nums;
    text-align: right;
  }}
  .ct {{ min-width: 34px; }}
  .pc {{ min-width: 40px; color: var(--faint); }}

  footer {{
    margin-top: 34px; font-size: 11.5px; color: var(--faint);
    max-width: 62ch;
  }}

  @media print {{
    body {{ padding: 0; }}
    header {{ margin-bottom: 20px; }}
    h2 {{ margin-top: 26px; }}
    .sheet {{ overflow: visible; }}
  }}
</style>

<header>
  {preview}
  <div class="titles">
    <h1>{headline}</h1>
    <p class="sub">与「新娘 Bride」同一板尺寸、同一头身比例，可成对拼装。</p>
  </div>
  <div class="meta">
    <span><b>{GW} × {GH}</b> 格</span>
    <span><b>{total}</b> 颗</span>
    <span><b>{ncolors}</b> 色</span>
    <span class="tag">MARD 221</span>
  </div>
</header>

<div class="sheet">
  <div class="grid ruler">{''.join(ruler)}</div>
  <div class="grid">{''.join(cells)}</div>
</div>

<h2>配色表 · Bead list</h2>
<ul>{''.join(legend)}</ul>

<footer>
  色号取自 MARD 221 标准色卡，与新娘图纸共用同一套豆子：
  黑白灰 H 系、肤色 E14 / G3 / G16 / A12、棕影 M13 / G13、金 G10 / A8 / M9。
  每格一颗豆，5 格一条粗线便于数格。
</footer>
"""

with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print(f"{out}  {GW}x{GH}  {total} beads  {ncolors} colors")
