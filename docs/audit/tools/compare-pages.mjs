// Before/after table from two perf-pages.mjs runs (round 4).
//   node docs/audit/tools/compare-pages.mjs before.json after.json [profile=phone] > table.md
// One row per page: FCP and LCP for ar and en, before -> after, plus the LCP element after,
// HTML / CSS / font / JS bytes on the wire (phone ar). Budget: LCP < 2.5 s.
import fs from "node:fs";

const [beforeFile, afterFile, profile = "phone"] = process.argv.slice(2);
const load = (f) => JSON.parse(fs.readFileSync(f, "utf8")).filter((r) => !r.error);
const before = load(beforeFile);
const after = load(afterFile);
const key = (r) => `${r.page}|${r.profile}|${r.locale}`;
const idx = (list) => new Map(list.map((r) => [key(r), r]));
const B = idx(before);
const A = idx(after);
const pages = [...new Set(after.map((r) => r.page))];
const s = (ms) => (ms == null ? "–" : `${(ms / 1000).toFixed(2)}`);
const kb = (b) => (b == null ? "–" : `${Math.round(b / 1024)}`);
const pair = (b, a, f) => `${f(b)} → **${f(a)}**`;

const out = [];
out.push(`| Page | FCP ar (s) | LCP ar (s) | FCP en (s) | LCP en (s) | CLS ar | LCP element after (ar) | HTML+CSS KB ar | Fonts KB ar | JS KB ar | LCP < 2.5 s |`);
out.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const p of pages) {
  const ba = B.get(`${p}|${profile}|ar`);
  const aa = A.get(`${p}|${profile}|ar`);
  const be = B.get(`${p}|${profile}|en`);
  const ae = A.get(`${p}|${profile}|en`);
  if (!aa && !ae) continue;
  const worst = Math.max(aa?.lcp ?? 0, ae?.lcp ?? 0);
  const el = (aa?.lcpEl ?? "").replace(/\|/g, "/").replace(/\.([A-Za-z]+)_([A-Za-z0-9]+)__[A-Za-z0-9_-]{5}/g, ".$1_$2").slice(0, 70);
  out.push(
    [
      p,
      pair(ba?.fcp, aa?.fcp, s),
      pair(ba?.lcp, aa?.lcp, s),
      pair(be?.fcp, ae?.fcp, s),
      pair(be?.lcp, ae?.lcp, s),
      `${ba?.cls?.toFixed(3) ?? "–"} → ${aa?.cls?.toFixed(3) ?? "–"}`,
      `\`${el}\``,
      pair(ba && ba.bytes.doc + ba.bytes.css, aa && aa.bytes.doc + aa.bytes.css, kb),
      pair(ba?.bytes.font, aa?.bytes.font, kb),
      pair(ba?.bytes.js, aa?.bytes.js, kb),
      worst < 2500 ? "pass" : "**fail**",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
  );
}
console.log(out.join("\n"));
