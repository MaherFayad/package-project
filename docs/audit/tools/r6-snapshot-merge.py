"""Round 6: re-record the geometry snapshot for ONE family only.
Run UPDATE_GEOMETRY_SNAPSHOT=1 vitest first (writes every key), then:
  python3 r6-snapshot-merge.py <models.json> <source[,source]> [EXTRA_CODE,...]
keeps HEAD's value for every key whose model is not in the given sources, prints changed keys."""
import json, subprocess, sys
F = "src/lib/dieline/__tests__/__snapshots__/geometry.json"
models = json.load(open(sys.argv[1])); srcs = set(sys.argv[2].split(","))
extra = set(sys.argv[3].split(",")) if len(sys.argv) > 3 and sys.argv[3] else set()
codes = {m["code"] for m in models if m["source"] in srcs} | extra
head = json.loads(subprocess.check_output(["git", "show", f"HEAD:{F}"]))
new = json.load(open(F))
out, changed = {}, []
for k in new:
    base = k.split("+")[0].split("#")[0]
    if base in codes:
        out[k] = new[k]
        if head.get(k) != new[k]: changed.append(k)
    elif k in head:
        out[k] = head[k]
for k in head:
    if k not in out: out[k] = head[k]
json.dump(out, open(F, "w"), indent=1); open(F, "a").write("\n")
print(" ".join(changed) or "(none)")
