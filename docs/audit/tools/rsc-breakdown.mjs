// RSC payload breakdown per route (round 5 platform): total bytes, inline-CSS text rows, CSS
// rows repeated across segments (R5-PL-07), serialised dictionaries (R5-PL-08) and inline <style>.
//   BASE=http://localhost:3000 node docs/audit/tools/rsc-breakdown.mjs /ar /ar/catalog buyer:/ar/account admin:/ar/admin
import { chromium } from "playwright";
const B = process.env.BASE || "http://localhost:3000";
const PH = { buyer: "+201000000002", admin: "+201000000001", vendor: "+201000000010" };
const b = await chromium.launch();
const ctxs = {};
async function ctxFor(role) {
  if (ctxs[role]) return ctxs[role];
  const ctx = await b.newContext();
  if (role !== "anon") {
    for (let i = 0; i < 4; i++) {
      const j = await (await ctx.request.post(B + "/api/auth/request-otp", { data: { phone: PH[role] } })).json();
      if (j.devCode) { await ctx.request.post(B + "/api/auth/verify-otp", { data: { phone: PH[role], code: j.devCode, locale: "en", acceptTerms: true } }); break; }
      await new Promise((z) => setTimeout(z, ((j.retryAfterSec ?? 30) + 1) * 1000));
    }
  }
  return (ctxs[role] = ctx);
}
const rows = [];
for (const arg of process.argv.slice(2)) {
  const [role, url] = arg.includes(":/") ? arg.split(/:(?=\/)/) : ["anon", arg];
  const p = await (await ctxFor(role)).newPage();
  await p.goto(B + url, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const u8 = (s) => new TextEncoder().encode(s).length;
    const rsc = (self.__next_f || []).filter((x) => x[0] === 1 && typeof x[1] === "string").map((x) => x[1]).join("");
    const T = [...rsc.matchAll(/(?:^|\n)([0-9a-f]+):T([0-9a-f]+),/g)];
    const by = new Map();
    for (const m of T) { const k = rsc.slice(m.index + m[0].length, m.index + m[0].length + 60); const v = by.get(k) || [0, parseInt(m[2], 16)]; v[0]++; by.set(k, v); }
    let dup = 0; const dups = [];
    for (const [k, [n, len]] of by) if (n > 1 && /[{}]/.test(k)) { dup += (n - 1) * len; dups.push(`${n}x${(len / 1024).toFixed(1)}K ${k.slice(0, 28)}`); }
    // dictionaries: every "dict":{...} object, brace-matched
    const dicts = []; let from = 0;
    while ((from = rsc.indexOf('"dict":{', from)) >= 0) { let d = 0, i = from + 7; for (; i < rsc.length; i++) { const c = rsc[i]; if (c === '"') { i++; while (i < rsc.length && rsc[i] !== '"') { if (rsc[i] === "\\") i++; i++; } } else if (c === "{") d++; else if (c === "}") { d--; if (!d) break; } } dicts.push(u8(rsc.slice(from, i + 1))); from = i; }
    const styles = [...document.querySelectorAll("style")].reduce((a, s) => a + u8(s.textContent || ""), 0);
    return { rsc: u8(rsc), dup, dups: dups.slice(0, 6), dicts, styles };
  });
  rows.push({ url, role, ...r });
  console.log(`${url} [${role}] rsc=${(r.rsc / 1024).toFixed(0)}K style=${(r.styles / 1024).toFixed(0)}K dup=${(r.dup / 1024).toFixed(1)}K dict=${r.dicts.map((d) => (d / 1024).toFixed(1) + "K").join("+")}  ${r.dups.join(" | ")}`);
  await p.close();
}
await b.close();
if (process.env.OUT) (await import("node:fs")).writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
