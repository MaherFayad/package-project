#!/usr/bin/env node
// Rewrites `import { … } from "@/components/ui"` into one import per kit file
// (`@/components/ui/Button`, …), using the barrel's own export map (R4-08 / R4-16).
//
// Why: every kit module imports its CSS module, and CSS imports are side effects, so the
// barrel pulls every kit stylesheet into any route that uses one component. With
// experimental.inlineCss that CSS is inlined twice (in <head> and in the RSC payload).
//
//   node scripts/codemods/debarrel-ui.mjs [--check] [paths…]   (default: src)
//
// Only import statements change; everything else in a file is left byte for byte.
// --check exits 1 if any barrel import is left (no writes).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BARREL = path.join(ROOT, "src/components/ui/index.ts");
const SPEC = "@/components/ui";
const check = process.argv.includes("--check");
const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/** name → module file, from `export { a, type B } from "./X"` / `export type { … } from "./X"`. */
function exportMap() {
  const src = fs.readFileSync(BARREL, "utf8");
  const map = new Map();
  const re = /export\s+(type\s+)?\{([^}]*)\}\s+from\s+["']\.\/([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    for (const raw of m[2].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (name) map.set(name, m[3]);
    }
  }
  if (/export\s+\*/.test(src)) throw new Error("barrel has `export *`; extend the codemod");
  return map;
}

const MAP = exportMap();
const IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']@\/components\/ui(?:\/index)?["'];?/g;

function rewrite(code, file) {
  return code.replace(IMPORT_RE, (whole, allType, list) => {
    const groups = new Map(); // module → specifiers (in original order)
    for (const raw of list.split(",")) {
      const spec = raw.trim();
      if (!spec) continue;
      const imported = spec.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      const mod = MAP.get(imported);
      if (!mod) throw new Error(`${file}: "${imported}" is not exported by ${SPEC}`);
      if (!groups.has(mod)) groups.set(mod, []);
      groups.get(mod).push(spec);
    }
    const lines = [];
    for (const [mod, specs] of groups) {
      const allTypes = allType || specs.every((s) => s.startsWith("type "));
      const names = allTypes ? specs.map((s) => s.replace(/^type\s+/, "")) : specs;
      lines.push(`import ${allTypes ? "type " : ""}{ ${names.join(", ")} } from "${SPEC}/${mod}";`);
    }
    return lines.join("\n");
  });
}

function* walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (/node_modules|\.next/.test(p)) return;
    for (const e of fs.readdirSync(p)) yield* walk(path.join(p, e));
  } else if (/\.(tsx?|mts|cts)$/.test(p) && !p.startsWith(path.join(ROOT, "src/components/ui") + path.sep)) {
    yield p;
  }
}

let changed = 0;
const left = [];
for (const r of roots.length ? roots : ["src"]) {
  for (const file of walk(path.resolve(ROOT, r))) {
    const code = fs.readFileSync(file, "utf8");
    IMPORT_RE.lastIndex = 0;
    if (!IMPORT_RE.test(code)) continue;
    IMPORT_RE.lastIndex = 0;
    if (check) { left.push(path.relative(ROOT, file)); continue; }
    const next = rewrite(code, file);
    if (next !== code) { fs.writeFileSync(file, next); changed++; }
  }
}
if (check) {
  if (left.length) { console.error(`barrel imports left in ${left.length} files:\n` + left.join("\n")); process.exit(1); }
  console.log("no barrel imports");
} else console.log(`rewrote ${changed} files`);
