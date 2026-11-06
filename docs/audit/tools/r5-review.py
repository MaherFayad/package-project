"""Round 5 3D QA: one review grid per model (5 columns, labelled tiles) for close inspection.
usage: python3 r5-review.py <shotsDir> <outDir> [CODE,CODE]"""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont
shots, out = sys.argv[1:3]
only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
ORDER = ["d_hero", "d_back", "d_half", "d_top", "d_flat", "d_open", "d_dieline", "m_hero"]
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
groups = {}
for f in glob.glob(os.path.join(shots, "*__*__*.png")):
    code, variant, view = os.path.basename(f)[:-4].split("__")
    if only and code not in only: continue
    groups.setdefault(code, []).append(((0 if variant == "def" else 1 if variant in ("min", "max") else 2, variant, ORDER.index(view) if view in ORDER else 9), f"{variant}/{view}", f))
TW, TH, C = 400, 250, 5
for code, items in groups.items():
    items.sort()
    n = len(items); R = (n + C - 1) // C
    sheet = Image.new("RGB", (C * TW, R * TH), "white")
    for k, (_, label, f) in enumerate(items):
        im = Image.open(f).convert("RGB"); im.thumbnail((TW - 4, TH - 4), Image.LANCZOS)
        x, y = (k % C) * TW, (k // C) * TH
        sheet.paste(im, (x + (TW - im.width) // 2, y + (TH - im.height) // 2))
        d = ImageDraw.Draw(sheet); d.rectangle([x, y, x + len(label) * 9 + 6, y + 18], fill="#ffe066"); d.text((x + 3, y + 1), label, fill="black", font=font)
    sheet.save(os.path.join(out, f"{code}.jpg"), quality=80)
print(len(groups))
