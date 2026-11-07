/**
 * After `opennextjs-cloudflare build`: write the build facts the Worker cannot read from disk
 * (src/lib/runtime/build-facts.ts) into the static assets as /_elba/build-facts.json.
 *
 *  - font preload URLs parsed from the built CSS (src/lib/runtime/font-faces.ts);
 *  - the react-loadable manifest entries the designer preloads (the 3D canvas chunk);
 *  - the optional public files pages check before linking (marketing loops).
 *
 * Run: npx tsx scripts/cloudflare/write-build-facts.ts [distDir=.next] [assetsDir=.open-next/assets]
 */
import fs from "node:fs";
import path from "node:path";
import type { BuildFacts } from "../../src/lib/runtime/build-facts";
import { interFace, notoArabicFace, plexArabicFaces } from "../../src/lib/runtime/font-faces";

const ROOT = path.resolve(__dirname, "..", "..");
/** Loadable entries the app preloads (src/components/designer/server.ts lazyChunkHrefs). */
export const LOADABLE_KEYS = ["components/designer/DesignerApp.tsx -> ./Stage3D"];
/** Public folders whose files are optional at build time (src/lib/runtime/public-files.ts). */
export const OPTIONAL_PUBLIC_DIRS = ["marketing"];

function walk(dir: string, filter: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

export function computeBuildFacts(distDir: string, publicDir: string): BuildFacts {
  const css = walk(path.join(distDir, "static", "css"), (f) => f.endsWith(".css")).map((f) => fs.readFileSync(f, "utf8"));
  const manifestFile = path.join(distDir, "react-loadable-manifest.json");
  const manifest: Record<string, { files?: string[] }> = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
  const publicFiles = OPTIONAL_PUBLIC_DIRS.flatMap((d) => walk(path.join(publicDir, d), () => true)).map((f) => "/" + path.relative(publicDir, f).split(path.sep).join("/"));
  return {
    v: 1,
    fonts: {
      plexArabic: Object.fromEntries([...plexArabicFaces(css)].map(([w, u]) => [String(w), u])),
      inter: interFace(css),
      noto: notoArabicFace(css),
    },
    loadable: Object.fromEntries(LOADABLE_KEYS.filter((k) => manifest[k]?.files).map((k) => [k, manifest[k]!.files!])),
    publicFiles: publicFiles.sort(),
  };
}

if (require.main === module) {
  const distDir = path.resolve(ROOT, process.argv[2] ?? ".next");
  const assetsDir = path.resolve(ROOT, process.argv[3] ?? ".open-next/assets");
  const facts = computeBuildFacts(distDir, path.join(ROOT, "public"));
  const problems: string[] = [];
  if (!facts.fonts.inter) problems.push("Inter preload URL not found in the built CSS");
  if (!facts.fonts.noto) problems.push("Noto Sans Arabic preload URL not found in the built CSS");
  if (Object.keys(facts.fonts.plexArabic).length === 0) problems.push("IBM Plex Sans Arabic preload URLs not found in the built CSS");
  if (Object.keys(facts.loadable).length !== LOADABLE_KEYS.length) problems.push("3D chunk entry missing from react-loadable-manifest.json");
  for (const p of problems) console.warn(`build-facts: ${p} (pages fall back to on-demand loading)`);
  const out = path.join(assetsDir, "_elba", "build-facts.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(facts));
  console.log(`wrote ${path.relative(ROOT, out)} (${facts.publicFiles.length} optional public files)`);
}
