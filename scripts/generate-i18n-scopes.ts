/**
 * R5-PL-08: which dictionary keys each route group's client code can read.
 *
 * Walks the import graph from the route files (page, layout, loading, error, not-found, template)
 * of each scope and collects every string literal that names a dictionary key ("store.cookie.label"),
 * every key prefix ("materials." or `store.badges.${x}`) and every `dict.<ns>` access. The output,
 * src/i18n/scopes.generated.ts, lists per scope the keys/prefixes it needs beyond its parent scope.
 * The client dictionary is pruned to those (src/i18n/scope.ts); src/i18n/__tests__/scopes.test.ts
 * fails when the generated file is stale.
 *
 *   npx tsx scripts/generate-i18n-scopes.ts          # write
 *   npx tsx scripts/generate-i18n-scopes.ts --check  # exit 1 if stale
 */
import fs from "node:fs";
import path from "node:path";
import { ar } from "../src/i18n/ar";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "app/[locale]");
const OUT = path.join(SRC, "i18n/scopes.generated.ts");

/** Scope name → route directory (relative to src/app/[locale]). "root" is everything else. */
export const SCOPES: Record<string, string> = {
  design: "design",
  share: "s",
  checkout: "(checkout)",
  orders: "orders",
  account: "(store)/account",
  why: "(store)/(why)", // r6-why: /why-elba and /pricing
  admin: "admin",
  vendor: "vendor",
  dev: "dev",
};
const NAMESPACES = new Set(Object.keys(ar));
const ROUTE_FILE = /^(page|layout|loading|error|not-found|template|default)\.tsx?$/;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")])
    if (fs.existsSync(c) && fs.statSync(c).isFile() && /\.tsx?$/.test(c)) return c;
  return null;
}

const fileInfo = new Map<string, { deps: string[]; keys: Set<string> }>();
function info(file: string) {
  let i = fileInfo.get(file);
  if (i) return i;
  const code = fs.readFileSync(file, "utf8");
  const deps: string[] = [];
  for (const m of code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const r = resolve(file, m[1]!);
    if (r) deps.push(r);
  }
  const keys = new Set<string>();
  const add = (k: string) => {
    const ns = k.split(".")[0]!;
    if (NAMESPACES.has(ns)) keys.add(k);
  };
  // "a.b.c" / 'a.b' / `a.b` literals that look like keys, and "ns." prefixes
  for (const m of code.matchAll(/["'`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)*\.?)["'`]/g)) if (m[1]!.includes(".") || m[1]!.endsWith(".")) add(m[1]!);
  // `ns.part.${x}` → prefix "ns.part."
  for (const m of code.matchAll(/`([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)*\.)\$\{/g)) add(m[1]!);
  // dict.ns / dict?.ns / dict["ns"] → whole namespace
  for (const m of code.matchAll(/\bdict\??\.([a-zA-Z]+)\b/g)) add(m[1]! + ".");
  // a bare namespace literal ("store") passed as a sub-dictionary selector
  i = { deps, keys };
  fileInfo.set(file, i);
  return i;
}

function reach(entries: string[]): Set<string> {
  const keys = new Set<string>();
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    // src/i18n holds the dictionaries and the generated scope lists: following it would count
    // every key as read.
    if (f.startsWith(path.join(SRC, "i18n") + path.sep)) continue;
    const i = info(f);
    for (const k of i.keys) keys.add(k);
    stack.push(...i.deps);
  }
  return keys;
}

function routeFiles(dir: string, skip: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (skip.includes(p)) continue;
        walk(p);
      } else if (ROUTE_FILE.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** Collapse a key set: drop keys covered by a prefix, sort. */
function normalise(keys: Set<string>): string[] {
  const prefixes = [...keys].filter((k) => k.endsWith("."));
  return [...keys].filter((k) => k.endsWith(".") || !prefixes.some((p) => k.startsWith(p))).filter((k, _i, all) => !(k.endsWith(".") && all.some((o) => o !== k && o.endsWith(".") && k.startsWith(o)))).sort();
}

export function computeScopes(): Record<string, string[]> {
  const scopeDirs = Object.values(SCOPES).map((d) => path.join(APP, d));
  const rootEntries = [
    ...routeFiles(APP, scopeDirs),
    ...fs.readdirSync(path.join(SRC, "app")).filter((f) => ROUTE_FILE.test(f) || f === "global-error.tsx").map((f) => path.join(SRC, "app", f)),
  ];
  const root = reach(rootEntries);
  const out: Record<string, string[]> = { root: normalise(root) };
  const covered = (k: string) => root.has(k) || [...root].some((r) => r.endsWith(".") && k.startsWith(r));
  for (const [name, dir] of Object.entries(SCOPES)) {
    const nested = scopeDirs.filter((d) => d !== path.join(APP, dir) && d.startsWith(path.join(APP, dir) + path.sep));
    const keys = reach(routeFiles(path.join(APP, dir), nested));
    out[name] = normalise(new Set([...keys].filter((k) => !covered(k))));
  }
  return out;
}

export function render(scopes: Record<string, string[]>): string {
  return `// Generated by scripts/generate-i18n-scopes.ts (R5-PL-08). Do not edit; re-run the script.\n// Keys ending in "." are prefixes (the whole subtree). Each scope lists what it adds to "root".\nexport const I18N_SCOPES = ${JSON.stringify(scopes, null, 2)} as const;\n\nexport type I18nScopeName = keyof typeof I18N_SCOPES;\n`;
}

if (process.argv[1] && /generate-i18n-scopes/.test(process.argv[1])) {
  const next = render(computeScopes());
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (cur !== next) { console.error("src/i18n/scopes.generated.ts is stale: npx tsx scripts/generate-i18n-scopes.ts"); process.exit(1); }
    console.log("i18n scopes up to date");
  } else {
    fs.writeFileSync(OUT, next);
    const s = computeScopes();
    console.log(Object.entries(s).map(([k, v]) => `${k}: ${v.length}`).join(", "));
  }
}
