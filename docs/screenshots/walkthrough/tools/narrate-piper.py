"""Piper (ar_JO kareem) narration per scene, diacritized with Mishkal, checked with Whisper."""
import sys, subprocess, json, difflib, re, os, glob
import numpy as np
import mishkal.tashkeel
from faster_whisper import WhisperModel
T, PIPER, VID = sys.argv[1], sys.argv[2], sys.argv[3]
names = sys.argv[4].split(",")
only = set(sys.argv[5].split(",")) if len(sys.argv) > 5 and sys.argv[5] else None
voc = mishkal.tashkeel.TashkeelClass()
model = WhisperModel("medium", device="cpu", compute_type="int8")
def load(w): return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',w,'-f','f32le','-ac','1','-ar','16000','-']), np.float32)
def norm(s): s = re.sub(r"[ً-ْـ،,.؟?!:]", "", s); s = re.sub("[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي"); return s.split()
report = []
for n in names:
    cfg = json.load(open(f"{VID}/{n}.json")); outd = f"{VID}/{n}/narration"; os.makedirs(outd, exist_ok=True)
    for sc in cfg["scenes"]:
        if only and sc["id"] not in only: continue
        line = sc["narration"]; wav = f"{outd}/{sc['id']}.wav"; best = None
        for attempt in range(4):
            raw = f"{outd}/{sc['id']}.raw.wav"; cand = f"{outd}/{sc['id']}.try{attempt}.wav"
            subprocess.run([PIPER, "-m", f"{T}/voice/ar_JO-kareem-medium.onnx", "--length-scale", "0.72", "--sentence-silence", "0.15", "-f", raw], input=voc.tashkeel(sc.get("tts", line)).encode(), capture_output=True, check=True)
            subprocess.run(["ffmpeg","-v","error","-y","-i",raw,"-af","silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-62dB,areverse,apad=pad_dur=0.25,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5","-ar","48000",cand], check=True)
            os.remove(raw)
            heard = " ".join(s.text for s in model.transcribe(load(cand), language="ar", beam_size=5)[0]).strip()
            r = difflib.SequenceMatcher(None, norm(line), norm(heard)).ratio()
            if best is None or r > best[0]: best = (r, cand, heard)
            if r >= 0.9: break
        os.replace(best[1], wav)
        for f in glob.glob(f"{outd}/{sc['id']}.try*.wav"): os.remove(f)
        r, heard = best[0], best[2]
        d = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",wav]).strip())
        report.append({"id": sc["id"], "sec": round(d,1), "match": round(r,2), "heard": heard})
        print(json.dumps(report[-1], ensure_ascii=False), flush=True)
json.dump(report, open(f"{VID}/narration-report.json","w"), ensure_ascii=False, indent=1)
