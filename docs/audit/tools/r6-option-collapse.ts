// Round 6: container / closure options whose EFFECTIVE look (core renderer code + tint + closureStyle)
// is identical to another option of the same model, so picking them cannot change the 3D model.
import { VESSEL_MODELS } from "@/lib/library";
for (const m of VESSEL_MODELS) {
  for (const [kind, list] of [["container", m.containers], ["closure", m.closures]] as const) {
    const seen = new Map<string, string>();
    for (const o of list) {
      const k = `${o.core}|${o.tint ?? ""}|${o.closureStyle ?? ""}`;
      if (seen.has(k)) console.log(`${m.code}\t${kind}\t${o.code} == ${seen.get(k)}\t(${k})`);
      else seen.set(k, o.code);
    }
  }
}
