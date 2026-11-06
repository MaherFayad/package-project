"""Round 4 3D contact sheets: one row per model (desktop hero, back, half/top, flat/open, phone hero).
usage: python3 r4-sheets.py <library-models.json> <catalogue-models.json> <shotsDir> <outDir> [prefix]
Writes <outDir>/<family>-NN.jpg (JPEG q70, ≤ 14 rows per sheet)."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

lib_file, cat_file, shots, out = sys.argv[1:5]
prefix = sys.argv[5] if len(sys.argv) > 5 else ""
os.makedirs(out, exist_ok=True)
lib = {m["code"]: m for m in json.load(open(lib_file))}
cat = json.load(open(cat_file))
fam = {}
for m in cat:
    src = lib.get(m["code"], {}).get("source") or f"catalogue-{m['render']}"
    if src.startswith("catalogue-"):
        src = "catalogue-extra"
    fam.setdefault(src, []).append(m["code"])

TW, TH, ROWS = 250, 150, 14
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except OSError:
    font = ImageFont.load_default()


def tile(path):
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGB")
    # crop the floating toolbar strip off the bottom (it is the same on every frame)
    w, h = im.size
    im = im.crop((0, 0, w, int(h * 0.9))) if h > 300 else im
    im.thumbnail((TW, TH))
    t = Image.new("RGB", (TW, TH), (245, 245, 243))
    t.paste(im, ((TW - im.size[0]) // 2, (TH - im.size[1]) // 2))
    return t


for f, codes in fam.items():
    for page in range(0, len(codes), ROWS):
        chunk = codes[page:page + ROWS]
        sheet = Image.new("RGB", (TW * 5 + 4 * 5, len(chunk) * (TH + 18)), "white")
        d = ImageDraw.Draw(sheet)
        for r, code in enumerate(chunk):
            tag = "".join(c if c.isalnum() or c in "_-" else "_" for c in code)
            y = r * (TH + 18)
            d.text((4, y + 2), code, fill=(30, 30, 30), font=font)
            kinds = ["d_hero", "d_back", "d_half", "d_flat", "m_hero"]
            if os.path.exists(os.path.join(shots, f"{tag}__d_top.png")):
                kinds = ["d_hero", "d_back", "d_top", "d_open", "m_hero"]
            for c, k in enumerate(kinds):
                t = tile(os.path.join(shots, f"{tag}__{k}.png"))
                if t:
                    sheet.paste(t, (c * (TW + 5), y + 18))
        name = f"{prefix}{f}-{page // ROWS + 1:02d}.jpg"
        sheet.save(os.path.join(out, name), quality=70)
        print(name, len(chunk))
