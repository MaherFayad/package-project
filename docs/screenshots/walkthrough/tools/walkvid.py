"""Edit a walkthrough video from raw clips: scenes of trimmed (and sped-up) segments, an Arabic
caption per scene (rendered by Chromium so Arabic letters join), optional narration per scene,
title cards, and crossfades.

  python3 walkvid.py <config.json> <workdir>

Config: {"out": "...mp4", "size": [W, H], "fps": 30, "xfade": 0.4, "scenes": [scene...]}
  scene = {"id": "s1", "caption": "...", "narration": "...", "card": {"kicker", "title", "sub"}}
        | {"id": "s2", "caption": "...", "narration": "...", "segments": [[clip, start, end, speed], ...]}
Narration audio is read from <workdir>/narration/<id>.wav (or .mp3) when present. A scene is
then held on its last frame until the narration ends (+0.5 s). Without audio, scenes keep their
own length (cards: 2.8 s) and the video is silent.
"""
import json, os, subprocess, sys, shutil

cfg = json.load(open(sys.argv[1]))
WD = os.path.abspath(sys.argv[2])
os.makedirs(WD, exist_ok=True)
W, H = cfg["size"]
FPS = cfg.get("fps", 30)
XF = cfg.get("xfade", 0.4)
CARD = 2.8
caps = os.path.join(WD, "captions"); os.makedirs(caps, exist_ok=True)
tmp = os.path.join(WD, "scenes"); os.makedirs(tmp, exist_ok=True)
FONT_CSS = "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;600;700&display=swap');"

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-3000:]); raise SystemExit(r.returncode)
    return r.stdout

def dur(p):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).strip())

# 1) captions and cards as PNG (one Chromium run)
jobs = []
for sc in cfg["scenes"]:
    if sc.get("card"):
        c = sc["card"]
        html = f"""<html dir="rtl"><head><meta charset="utf-8"><style>{FONT_CSS}
        body{{margin:0;width:{W}px;height:{H}px;display:grid;place-items:center;background:#16130f;font-family:'IBM Plex Sans Arabic',sans-serif;color:#f5efe6}}
        .k{{color:#e8b77a;font:600 {round(W*0.016)}px/1.2 'IBM Plex Sans Arabic';margin-bottom:{round(W*0.012)}px}}
        .t{{font:700 {round(W*0.036)}px/1.25 'IBM Plex Sans Arabic';margin-bottom:{round(W*0.01)}px}}
        .s{{font:500 {round(W*0.017)}px/1.4 'IBM Plex Sans Arabic';color:#cfc6b8}}
        main{{text-align:center;max-width:80%}}</style></head><body><main><div class="k">{c.get('kicker','')}</div><div class="t">{c['title']}</div><div class="s">{c.get('sub','')}</div></main></body></html>"""
        jobs.append({"id": sc["id"], "html": html, "full": True})
    elif sc.get("caption"):
        fs = round(W * 0.0175)
        html = f"""<html dir="rtl"><head><meta charset="utf-8"><style>{FONT_CSS}
        body{{margin:0;background:transparent;width:{W}px;display:flex;justify-content:center;align-items:flex-start}}
        div{{display:inline-block;max-width:{round(W*0.72)}px;padding:{round(fs*0.55)}px {round(fs*1.1)}px;border-radius:{round(fs*0.7)}px;background:rgba(20,18,15,.86);color:#fff;
        font:600 {fs}px/1.5 'IBM Plex Sans Arabic',sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.25)}}</style></head><body><div id="c">{sc['caption']}</div></body></html>"""
        jobs.append({"id": sc["id"], "html": html, "full": False})
jf = os.path.join(WD, "caption-jobs.json"); json.dump(jobs, open(jf, "w"))
node = f"""
const {{chromium}}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{{const jobs=JSON.parse(fs.readFileSync({json.dumps(jf)},'utf8'));const b=await chromium.launch();
const p=await b.newPage({{viewport:{{width:{W},height:{H}}}}});
for(const j of jobs){{await p.setContent(j.html,{{waitUntil:'networkidle'}});await p.evaluate(()=>document.fonts.ready);
const out=path.join({json.dumps(caps)},j.id+'.png');
if(j.full) await p.screenshot({{path:out}}); else await p.locator('#c').screenshot({{path:out,omitBackground:true}});}}
await b.close();}})();"""
subprocess.run(["node", "-e", node], check=True)

# 2) one clip per scene (video + optional narration), all the same size, fps and audio layout
def narration(sid):
    for ext in ("wav", "mp3"):
        p = os.path.join(WD, "narration", f"{sid}.{ext}")
        if os.path.exists(p): return p
    return None

scene_files = []
for sc in cfg["scenes"]:
    sid = sc["id"]; out = os.path.join(tmp, f"{sid}.mp4"); aud = narration(sid)
    inputs, chains, labels = [], [], []
    if sc.get("card"):
        base = CARD
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(base), "-i", os.path.join(caps, f"{sid}.png")]
        chains.append(f"[0:v]scale={W}:{H},setsar=1,format=yuv420p[v0]"); labels.append("[v0]")
    else:
        base = 0.0
        for k, (clip, s, e, sp) in enumerate(sc["segments"]):
            inputs += ["-ss", str(s), "-t", str(e - s), "-i", clip]
            chains.append(f"[{k}:v]setpts=(PTS-STARTPTS)/{sp},fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p[v{k}]")
            labels.append(f"[v{k}]"); base += (e - s) / sp
    n = len(labels)
    graph = ";".join(chains) + (f";{''.join(labels)}concat=n={n}:v=1:a=0[vc]" if n > 1 else f";{labels[0]}null[vc]")
    total = base
    if aud:
        total = max(base, dur(aud) + 0.5)
    hold = max(0.0, total - base)
    graph += f";[vc]tpad=stop_mode=clone:stop_duration={hold:.3f}[vp]"
    cap = os.path.join(caps, f"{sid}.png")
    if not sc.get("card") and os.path.exists(cap):
        ci = n; inputs += ["-i", cap]
        graph += f";[vp][{ci}:v]overlay=x=(W-w)/2:y={round(H*0.13)}:format=auto,format=yuv420p[vo]"
    else:
        graph += ";[vp]null[vo]"
    ai = len([x for x in inputs if x == "-i"])
    if aud:
        inputs += ["-i", aud]
        graph += f";[{ai}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=250|250,apad,atrim=0:{total:.3f}[ao]"
    else:
        inputs += ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        graph += f";[{ai}:a]anull[ao]"
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[vo]", "-map", "[ao]",
         "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "160k", out])
    scene_files.append((out, total))
    print(f"{sid}: {total:.1f} s{' + narration' if aud else ''}")

# 3) crossfade scenes (video and audio), fade in/out at the ends
inputs, parts = [], []
for f, _ in scene_files: inputs += ["-i", f]
cv, ca, t = "[0:v]", "[0:a]", scene_files[0][1]
for k in range(1, len(scene_files)):
    off = t - XF
    parts.append(f"{cv}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[xv{k}]")
    parts.append(f"{ca}[{k}:a]acrossfade=d={XF}[xa{k}]")
    cv, ca, t = f"[xv{k}]", f"[xa{k}]", off + scene_files[k][1]
parts.append(f"{cv}fade=t=in:st=0:d=0.4,fade=t=out:st={t-0.5:.3f}:d=0.5[vf]")
parts.append(f"{ca}afade=t=out:st={t-0.5:.3f}:d=0.5[af]")
run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(parts), "-map", "[vf]", "-map", "[af]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", cfg["out"]])
print(f"wrote {cfg['out']} ({t:.1f} s)")
