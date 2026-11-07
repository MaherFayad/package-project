"""
Engine rounds 6 and 7: before / after contact sheets (was r6-sheets.py, renamed when the QA round reused that name).

Each row is one shot: label | before | after. Rows are grouped into one JPEG per finding group.

usage: python3 r6-sheets.py BEFORE_DIR AFTER_DIR OUT_DIR groups.json
  groups.json: { "sheet-name": [["ROW LABEL", "CODE__variant__view"], ...], ... }
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

before, after, out, groups_file = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
groups = json.load(open(groups_file))
W = 560  # width of one shot in the sheet
LABEL = 230
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
except OSError:
    font = bold = ImageFont.load_default()


def load(d, name):
    p = os.path.join(d, name + ".png")
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGB")
    return im.resize((W, round(im.height * W / im.width)))


for sheet, rows in groups.items():
    cells = []
    for label, shot in rows:
        a, b = load(before, shot), load(after, shot)
        if a is None and b is None:
            print("missing", shot)
            continue
        h = max(x.height for x in (a, b) if x is not None)
        cells.append((label, shot, a, b, h))
    if not cells:
        continue
    total = 40 + sum(c[4] + 8 for c in cells)
    img = Image.new("RGB", (LABEL + 2 * W + 24, total), "white")
    d = ImageDraw.Draw(img)
    d.text((LABEL + 8, 10), "before", fill="#555", font=bold)
    d.text((LABEL + W + 16, 10), "after (round 6)", fill="#0a6", font=bold)
    y = 40
    for label, shot, a, b, h in cells:
        d.multiline_text((8, y + 6), label + "\n" + shot.replace("__", "\n"), fill="#222", font=font, spacing=4)
        if a is not None:
            img.paste(a, (LABEL + 8, y))
        if b is not None:
            img.paste(b, (LABEL + W + 16, y))
        y += h + 8
    path = os.path.join(out, sheet + ".jpg")
    img.save(path, quality=72, optimize=True)
    print(path, os.path.getsize(path) // 1024, "KB")
