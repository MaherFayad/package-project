// Builds the per-page markdown tables of docs/audit/performance.md from docs/audit/perf-data/*.json.
//   node docs/audit/tools/report-tables.mjs > /tmp/tables.md
import fs from "node:fs";
const D = "docs/audit/perf-data/";
const pages = JSON.parse(fs.readFileSync(D + "pages.json", "utf8"));
const server = JSON.parse(fs.readFileSync(D + "server.json", "utf8"));
const lh = JSON.parse(fs.readFileSync(D + "lighthouse.json", "utf8"));
const RTT = 562.5;

const NAMES = {
  home: ["Home", "/{l}", "ar"], boxes: ["Boxes", "/{l}/boxes", "ar_boxes"], bottles: ["Bottles", "/{l}/bottles", "ar_bottles"], catalog: ["Catalog", "/{l}/catalog", "ar_catalog"],
  vendors: ["Vendors", "/{l}/vendors", "ar_vendors"], "design-picker": ["Design picker (no 3D)", "/{l}/design", "ar_design"],
  "designer-box": ["Designer: box (mailer, FEFCO 0427)", "/{l}/design/mailer-box", "ar_design_mailer-box"],
  "designer-bottle": ["Designer: bottle (round bottle)", "/{l}/design/round-bottle", "ar_design_round-bottle"],
  "designer-pouch": ["Designer: pouch (stand-up pouch)", "/{l}/design/stand-up-pouch", "ar_design_stand-up-pouch"],
  "designer-fefco09": ["Designer: FEFCO 09 fitting (0920 compartment liner)", "/{l}/design/fefco-0920-compartment-liner-across", "ar_design_fefco-0920-compartment-liner-across"],
  share: ["Share page", "/{l}/s/[token]", "ar_s_9Useh2K1F7ywjBRC"], checkout: ["Checkout", "/{l}/checkout/[designId]", "ar_checkout_cmw47w8jz00gq7df78v14utjs"],
  "order-tracking": ["Order tracking", "/{l}/orders/ELB-26001", "ar_orders_ELB-26001"], "vendor-portal": ["Vendor portal", "/{l}/vendor", "ar_vendor"],
  "vendor-jobs": ["Vendor portal: jobs", "/{l}/vendor/jobs", null], admin: ["Admin", "/{l}/admin", "ar_admin"], "admin-orders": ["Admin: orders", "/{l}/admin/orders", null],
};
const THREE_D = new Set(["designer-box", "designer-bottle", "designer-pouch", "designer-fefco09", "share"]);
const STORE = new Set(["home", "boxes", "catalog", "vendors", "bottles"]);
const COOKIE_LCP = new Set(["share", "checkout", "order-tracking"]);

// root cause / fix references (detailed in the issue register)
function cause(page, metric, worst) {
  if (metric === "CLS") {
    if (worst <= 0.1) return "–";
    if (STORE.has(page)) return "PERF-01: (store)/loading.tsx skeleton (~340 px) streams first, the footer sits in the first viewport, then 9-11k px of content swaps in";
    if (page === "order-tracking") return "PERF-01: orders/loading.tsx skeleton swap shifts main/footer";
    return "PERF-01 (route loading.tsx swap)";
  }
  if (metric === "LCP") {
    if (page === "home") return "PERF-02: HeroScene3D unmounts the LCP <img> and mounts PackagingScene's poster div (new LCP candidate, rendered after 3D boots) + PERF-13";
    if (COOKIE_LCP.has(page)) return "PERF-07: cookie notice text mounts in useEffect after hydration and becomes the LCP element; + PERF-03/04 JS";
    if (page === "boxes" || page === "catalog") return "PERF-14 (540 KB HTML, 370 cards, 62% RSC payload) + PERF-05/17 FCP floor";
    if (THREE_D.has(page) || page.startsWith("designer")) return "PERF-04/10: 713-722 KB JS before the 3D stage renders; LCP is the SVG poster";
    if (page === "design-picker") return "PERF-03 + PERF-15";
    return "PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files)";
  }
  if (metric === "INP") {
    if (worst <= 200) return "–";
    if (page === "home") return "PERF-13: first tap lands during the 550-770 ms HeroScene3D mount task (input delay 330-440 ms)";
    if (page === "share") return "PERF-11/12: every view-control click waits for a full WebGL frame (shadow pass re-rendered each frame)";
    return "PERF-18: price badge / panel clicks = 50-100 ms input delay + 50-90 ms handlers + WebGL frame before paint";
  }
  if (metric === "TBT") {
    if (worst <= 200) return "–";
    if (page === "home") return "PERF-13 (3D hero boot + continuous turntable)";
    if (page.startsWith("designer") || page === "share") return "PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount)";
    if (page === "design-picker") return "PERF-03 (three core + 370-model library eagerly evaluated)";
    if (page === "boxes" || page === "catalog") return "PERF-14 (hydrating 370 cards / 2,800 DOM nodes)";
    return "framework + page JS under 4x CPU";
  }
  if (metric === "JS") {
    if (page === "design-picker" || page === "checkout") return "PERF-03: three.js core (99 KB) + library/dieline chunk 9786 (172 KB) in the initial bundle of a non-3D page";
    if (page === "home") return "PERF-13: three + r3f + drei (258 KB) lazy-loaded on idle for the hero";
    if (THREE_D.has(page)) return "PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB)";
    return "–";
  }
  if (metric === "Fonts") return "PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin)";
  if (metric === "TTFB") return "PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local";
  return "–";
}
const fixFor = {
  "PERF-01": "Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport",
  "PERF-02": "`src/components/marketing/HeroVisual.tsx`: keep the poster `<img>` mounted under the canvas and pass no `poster` to HeroScene3D",
  "PERF-03": "Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel",
  "PERF-04": "Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`",
  "PERF-05": "`src/app/fonts.ts`: Plex `subsets: [\"arabic\"]`, 3 weights, `preload` only on `/ar`",
  "PERF-06": "Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender",
  "PERF-07": "SSR the cookie notice from the ack cookie in `CookieBar.tsx` / SiteChrome instead of `useEffect`",
  "PERF-13": "Mount the 3D hero only on intent (pointerenter / first tap) or `(hover:hover) and (pointer:fine)`; stop the turntable after one turn",
  "PERF-14": "Render the first 24 cards per group on the server; fetch the search index lazily",
  "PERF-18": "`startTransition` for quote/panel updates; render the badge state before the WebGL frame",
  "PERF-11": "`frames={1}` on every `<ContactShadows>`",
  "PERF-10": "Render the static SVG/WebP poster in the stage immediately and `modulepreload` the three chunks",
  "PERF-15": "Paginate the picker grid (24 per group) and use one SVG sprite",
  "PERF-16": "Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading=\"lazy\"` below the fold; AVIF",
  "PERF-17": "`next.config.ts`: `experimental.cssChunking: \"strict\"`; move designer/library CSS imports out of shared modules",
  "PERF-20": "Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all`",
};
const fix = (c) => {
  const ids = [...new Set((c.match(/PERF-\d+/g) || []))];
  return ids.map((i) => fixFor[i] ? `${i}: ${fixFor[i]}` : i).join("; ") || "–";
};
const sev = (v, budget, crit) => (v == null ? "–" : v > crit ? "**critical**" : v > budget ? "**high**" : v > budget * 0.8 ? "medium" : "ok");
const f0 = (v) => (v == null || Number.isNaN(v) ? "–" : Math.round(v).toLocaleString("en-US"));
const s = (v) => (v == null ? "–" : (v / 1000).toFixed(2) + " s");

let out = "";
for (const [key, [name, path, lhKey]] of Object.entries(NAMES)) {
  const g = (profile, locale) => pages.find((p) => p.page === key && p.profile === profile && p.locale === locale);
  const rows = [["desktop", "ar"], ["desktop", "en"], ["phone", "ar"], ["phone", "en"]].map(([p, l]) => g(p, l));
  if (rows.some((r) => !r)) continue;
  const [da, de, pa, pe] = rows;
  const sv = (l) => server.find((x) => x.key === `${key}-${l}`);
  const L = lh[lhKey];
  const is3d = THREE_D.has(key);
  out += `\n### ${name}\n\n\`${path}\`${is3d ? " (3D page: JS budget not applied; see the 3D section)" : ""}\n\n`;
  out += `| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  const line = (metric, vals, lhv, budget, sevv, c) => {
    out += `| ${metric} | ${vals.join(" | ")} | ${lhv} | ${budget} | ${sevv} | ${c} | ${c === "–" ? "–" : fix(c)} |\n`;
  };
  const ttfbA = sv("ar")?.ttfbMed, ttfbE = sv("en")?.ttfbMed;
  line("TTFB (server, warm median)", [f0(ttfbA) + " ms", f0(ttfbE) + " ms", f0(ttfbA + RTT) + " ms*", f0(ttfbE + RTT) + " ms*"], L ? "–" : "–", "< 800 ms", sev(Math.max(ttfbA, ttfbE) + RTT, 800, 1800), STORE.has(key) ? cause(key, "TTFB") : "–");
  line("FCP", rows.map((r) => s(r.fcp)), L ? s(L.fcp) : "–", "< 1.8 s", sev(Math.max(pa.fcp, pe.fcp), 1800, 3000), Math.max(pa.fcp, pe.fcp) > 1800 ? "PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G" : "–");
  const lcpW = Math.max(pa.lcp, pe.lcp, L?.lcp ?? 0);
  line("LCP", rows.map((r) => s(r.lcp)), L ? s(L.lcp) : "–", "< 2.5 s", sev(lcpW, 2500, 4000), lcpW > 2500 ? cause(key, "LCP") : "–");
  out += `| LCP element (phone ar) | ${(pa.lcpEl || "–").replace(/\|/g, "/").slice(0, 90)} | | | | | | | | |\n`;
  const clsW = Math.max(...rows.map((r) => r.cls), L?.cls ?? 0);
  line("CLS", rows.map((r) => r.cls.toFixed(3)), L ? L.cls.toFixed(3) : "–", "< 0.1", sev(clsW, 0.1, 0.25), cause(key, "CLS", clsW));
  const inpW = Math.max(...rows.map((r) => r.inp ?? 0));
  line("INP (simulated taps/clicks/keys)", rows.map((r) => (r.inp == null ? "–" : f0(r.inp) + " ms")), "n/a", "< 200 ms", sev(inpW, 200, 500), cause(key, "INP", inpW));
  const tbtW = Math.max(pa.tbt, pe.tbt, L?.tbt ?? 0);
  line("TBT (load + interactions)", rows.map((r) => f0(r.tbt) + " ms"), L ? f0(L.tbt) + " ms" : "–", "< 200 ms", sev(tbtW, 200, 600), cause(key, "TBT", tbtW));
  line("Long tasks (count / max)", rows.map((r) => `${r.longTasks} / ${f0(r.longTaskMax)} ms`), "–", "none > 200 ms", sev(Math.max(pa.longTaskMax, pe.longTaskMax), 200, 500), "see TBT");
  const jsW = Math.max(...rows.map((r) => r.bytes.js));
  line("JS transferred (gzip)", rows.map((r) => f0(r.bytes.js / 1024) + " KB"), "–", is3d ? "n/a (3D)" : "< 200 KB", is3d ? "info" : key === "home" ? "**high** (115 KB initial + 258 KB 3D on idle)" : sev(jsW / 1024, 200, 400), cause(key, "JS"));
  line("CSS transferred", rows.map((r) => f0(r.bytes.css / 1024) + " KB"), "–", "< 50 KB, ≤ 2 files", "medium", "PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS)");
  line("Images (KB / formats)", rows.map((r) => `${f0(r.bytes.img / 1024)} KB`), "–", "< 300 KB above-the-fold", sev(Math.max(...rows.map((r) => r.bytes.img / 1024)), 300, 600), Math.max(...rows.map((r) => r.imgsOversized?.length || 0)) ? `PERF-16: ${Math.max(...rows.map((r) => r.imgsOversized?.length || 0))} images served >2.2x their rendered width (WebP, no srcset/AVIF)` : "–");
  line("Fonts transferred", rows.map((r) => `${f0(r.bytes.font / 1024)} KB (${r.fonts.length})`), "–", "< 100 KB", sev(pe.bytes.font / 1024, 100, 200), cause(key, "Fonts"));
  line("HTML (raw) / DOM nodes", rows.map((r) => `${f0(r.htmlDecoded / 1024)} KB / ${f0(r.domNodes)}`), L ? `DOM ${f0(L.domSize)}` : "–", "< 150 KB / < 1,500", sev(Math.max(...rows.map((r) => r.domNodes)), 1500, 2500), Math.max(...rows.map((r) => r.domNodes)) > 1500 ? "PERF-14/15: all 370 models rendered" : "–");
  line("Prisma queries / request (ar)", [`${sv("ar")?.queriesPerReq} q, ${sv("ar")?.queryMsPerReq} ms`, `${sv("en")?.queriesPerReq} q`, "", ""], "–", "< 10 q, < 50 ms", sev(sv("ar")?.queriesPerReq, 10, 25), (sv("ar")?.queriesPerReq ?? 0) > 10 ? "PERF-20: sequential/duplicated reads (session + role + page data)" : "–");
}
console.log(out);
