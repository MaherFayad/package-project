"""Round 5 3D QA contact sheets: one row per model (default views, then every variant hero).
usage: python3 r5-sheets.py <shotsDir> <models.json> <outDir> [rowsPerSheet] [tileH]
Writes <outDir>/<source>-NN.jpg (JPEG q72). Each tile is labelled variant/view."""
import json, os, sys, glob
from PIL import Image, ImageDraw, ImageFont
shots, models_f, out = sys.argv[1:4]
rows_per = int(sys.argv[4]) if len(sys.argv) > 4 else 6
TH = int(sys.argv[5]) if len(sys.argv) > 5 else 200
os.makedirs(out, exist_ok=True)
models = json.load(open(models_f))
cat = [m for m in json.load(open("e2e/fixtures/catalogue-models.json")) if m["render"] not in ("box", "vessel")]
lib = {m["code"] for m in models}
models += [{"code": m["code"], "source": "catalogue-extra"} for m in cat if m["code"] not in lib]
ORDER = ["d_hero", "d_back", "d_half", "d_top", "d_flat", "d_open", "d_dieline", "m_hero"]
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except Exception:
    font = big = ImageFont.load_default()
def tiles(code):
    tag = code.replace("/", "_")
    files = glob.glob(os.path.join(shots, f"{glob.escape(tag)}__*.png"))
    items = []
    for f in files:
        _, variant, view = os.path.basename(f)[:-4].split("__")
        rank = (0 if variant == "def" else 1 if variant in ("min", "max") else 2, variant, ORDER.index(view) if view in ORDER else 9)
        items.append((rank, f"{variant}/{view}", f))
    return [x[1:] for x in sorted(items)]
by = {}
for m in models:
    by.setdefault(m["source"], []).append(m["code"])
for src, codes in by.items():
    rows = [(c, tiles(c)) for c in codes]
    rows = [r for r in rows if r[1]]
    for k in range(0, len(rows), rows_per):
        chunk = rows[k:k + rows_per]
        imgs = []
        for code, ts in chunk:
            row = []
            for label, f in ts:
                im = Image.open(f).convert("RGB")
                w = int(im.width * TH / im.height)
                im = im.resize((w, TH), Image.LANCZOS)
                d = ImageDraw.Draw(im)
                d.rectangle([0, 0, len(label) * 8 + 6, 17], fill="white")
                d.text((3, 1), label, fill="black", font=font)
                row.append(im)
            W = sum(i.width for i in row) + 4 * len(row)
            r = Image.new("RGB", (W, TH + 22), "#dddddd")
            ImageDraw.Draw(r).text((4, 2), code, fill="black", font=big)
            x = 0
            for i in row:
                r.paste(i, (x, 22)); x += i.width + 4
            imgs.append(r)
        W = max(i.width for i in imgs); H = sum(i.height + 6 for i in imgs)
        sheet = Image.new("RGB", (W, H), "white"); y = 0
        for i in imgs:
            sheet.paste(i, (0, y)); y += i.height + 6
        sheet.save(os.path.join(out, f"{src}-{k // rows_per + 1:02d}.jpg"), quality=72)
print("ok")
