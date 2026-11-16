"""Cut the owner's screen recording into a tight walkthrough: keep the story, drop waits,
detours and system dialogs, crossfade between kept parts, add short captions and title cards."""
import os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "src", "rec.mp4")
OUT = os.path.join(D, "elba-walkthrough-edited.mp4")
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FONT_B = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
W, H, FPS, XF = 1920, 956, 30, 0.35

# (start s, end s, speed, who, caption)
SEG = [
    (0, 12, 1.25, "Brand", "Find a box: search the catalogue for “gift”"),
    (12, 18, 1.0, "Brand", "Open the gift box and start designing"),
    (18, 36, 1.5, "Brand", "A live 3D model: turn it, open it, check the size"),
    (36, 37.8, 1.0, "Brand", "Upload the dieline your printer made, as the full artwork"),
    (40.25, 48, 1.0, "Brand", "Elba recognises the box and fits the art face by face"),
    (48, 63, 1.4, "Brand", "Every side of the closed box shows the right part of the design"),
    (63, 68, 1.0, "Brand", "Live price for 500 boxes, VAT and delivery included"),
    (75, 104, 1.5, "Brand", "Checkout: quantity, printer, address, then approve the proof"),
    (156, 167, 1.0, "Brand", "Pay by InstaPay, card, wallet or Fawry"),
    (173.5, 177, 1.0, "Brand", "Paid. The order waits for the printer to accept"),
    (218, 225, 1.3, "Printer", "The printer signs in with the shop’s mobile number"),
    (225, 230, 1.0, "Printer", "Dashboard: new jobs, due dates, money to come"),
    (232, 249, 1.15, "Printer", "The job: specs, the approved artwork and the printer’s price. Accept"),
    (249, 252, 1.0, "Printer", "Accepted. Jobs move on to production"),
    (264, 272, 1.0, "Printer", "In production: quality-check photos before shipping"),
]
CARDS = {
    "intro": ("ELBA", "Design it. Price it. Get it printed.", "A brand orders printed gift boxes, then the printer takes the job"),
    "printer": ("ELBA · PRINTER PORTAL", "The printer makes it", "Nile Pack Printing & Packaging, Cairo"),
    "outro": ("ELBA", "Design it. Price it. Get it printed.", "elba-demo.maherfayad55.workers.dev"),
}
CARD_LEN = 2.6

tdir = os.path.join(D, "txt"); os.makedirs(tdir, exist_ok=True)
def tfile(name, s):
    p = os.path.join(tdir, name + ".txt")
    with open(p, "w") as f: f.write(s)
    return p.replace(":", r"\:")

inputs, chains, lens = [], [], []
def add_card(key):
    k, title, sub = CARDS[key]
    i = inputs.count("-i")
    inputs.extend(["-f", "lavfi", "-t", str(CARD_LEN), "-i", f"color=c=0x16130f:s={W}x{H}:r={FPS}"])
    ft = f"fade=t=in:st=0:d=0.4,fade=t=out:st={CARD_LEN-0.4}:d=0.4" if key == "outro" else "null"
    chains.append(
        f"[{i}:v]drawtext=fontfile={FONT}:textfile={tfile(key+'k',k)}:fontcolor=0xe8b77a:fontsize=26:x=(w-tw)/2:y=h/2-120,"
        f"drawtext=fontfile={FONT_B}:textfile={tfile(key+'t',title)}:fontcolor=0xf5efe6:fontsize=64:x=(w-tw)/2:y=h/2-60,"
        f"drawtext=fontfile={FONT}:textfile={tfile(key+'s',sub)}:fontcolor=0xcfc6b8:fontsize=30:x=(w-tw)/2:y=h/2+40,"
        f"format=yuv420p,setsar=1,{ft}[v{i}]")
    lens.append(CARD_LEN)

def add_seg(n, s, e, sp, who, cap):
    i = inputs.count("-i")
    inputs.extend(["-ss", str(s), "-t", str(e - s), "-i", SRC])
    dur = (e - s) / sp
    box = "drawbox=x=(iw-1180)/2:y=ih-118:w=1180:h=66:color=0x141414@0.86:t=fill"
    chains.append(
        f"[{i}:v]setpts=(PTS-STARTPTS)/{sp},fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1,"
        f"drawtext=fontfile={FONT}:textfile={tfile(f'w{n}',who.upper())}:fontcolor=0xe8b77a:fontsize=20:"
        f"x=(w-tw)/2:y=h-150:box=1:boxcolor=0x141414@0.86:boxborderw=8,"
        f"drawtext=fontfile={FONT}:textfile={tfile(f'c{n}',cap)}:fontcolor=white:fontsize=31:"
        f"x=(w-tw)/2:y=h-104:box=1:boxcolor=0x141414@0.86:boxborderw=16,"
        f"format=yuv420p[v{i}]")
    lens.append(dur)

add_card("intro")
for n, sg in enumerate(SEG):
    if n == 10: add_card("printer")
    add_seg(n, *sg)
add_card("outro")

# crossfade chain: clip k is input k (one input per clip, in add order)
parts = list(chains)
cur, t = "[v0]", lens[0]
for k in range(1, len(lens)):
    off = t - XF
    parts.append(f"{cur}[v{k}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{k}]")
    cur, t = f"[x{k}]", off + lens[k]
fc = ";".join(parts)

cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", cur,
       "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT]
print("clips", len(lens), "length %.1f s" % t)
r = subprocess.run(cmd)
sys.exit(r.returncode)
