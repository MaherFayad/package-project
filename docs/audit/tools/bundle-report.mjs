// Per-route first-load JS (gzip) from .next/app-build-manifest.json, plus a scan of every chunk
// for library signatures (three.js core, r3f, drei, the 370-model library, pdf-lib, zod...).
// Usage: node docs/audit/tools/bundle-report.mjs [.next] > out.json
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
const dir = process.argv[2] || ".next";
const man = JSON.parse(fs.readFileSync(path.join(dir, "app-build-manifest.json"), "utf8")).pages;
const gz = new Map();
const sig = {
  three: /WebGLRenderer|THREE\.WebGLRenderer|"WEBGL_lose_context"|MeshPhysicalMaterial/,
  r3f: /__r3f|useFrame must be called|R3F: /,
  drei: /ContactShadows|Lightformer|OrbitControls/,
  library370: /fefco-0909-wrap-liner-long|glass-wine-bottle-bordeaux/,
  dielineEngine: /FEFCO_0933|foldStage|closedOuter/,
  pdfLib: /PDFDocument|pdf-lib/,
  zod: /ZodError/,
  lucide: /lucide/,
};
const info = (f) => {
  if (gz.has(f)) return gz.get(f);
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  const s = buf.toString("utf8");
  const tags = Object.entries(sig).filter(([, r]) => r.test(s)).map(([k]) => k);
  const r = { file: f, raw: buf.length, gz: zlib.gzipSync(buf, { level: 9 }).length, tags };
  gz.set(f, r);
  return r;
};
const routes = {};
for (const [route, files] of Object.entries(man)) {
  const js = files.filter((f) => f.endsWith(".js")).map(info).filter(Boolean);
  const css = files.filter((f) => f.endsWith(".css")).map(info).filter(Boolean);
  routes[route] = {
    jsGz: js.reduce((a, b) => a + b.gz, 0),
    jsRaw: js.reduce((a, b) => a + b.raw, 0),
    cssGz: css.reduce((a, b) => a + b.gz, 0),
    tags: [...new Set(js.flatMap((j) => j.tags))],
    largest: js.sort((a, b) => b.gz - a.gz).slice(0, 4).map((j) => ({ f: path.basename(j.file), gz: j.gz, tags: j.tags })),
  };
}
// all chunks incl. lazy ones
const chunkDir = path.join(dir, "static/chunks");
const all = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js")) all.push(info(path.relative(dir, p))); } };
walk(chunkDir);
all.sort((a, b) => b.gz - a.gz);
const initialSet = new Set(Object.values(man).flat());
console.log(JSON.stringify({ routes, chunks: all.slice(0, 30).map((c) => ({ ...c, initial: initialSet.has(c.file) })) }, null, 1));
