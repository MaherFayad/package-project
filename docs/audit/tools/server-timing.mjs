// Server response time per route + Prisma queries per request (needs the server started with
// docs/audit/tools/prisma-query-log.cjs preloaded and PRISMA_QUERY_LOG pointing at QLOG).
//   BASE=... QLOG=/tmp/queries.ndjson COOKIES_buyer="elba_session=..." node docs/audit/tools/server-timing.mjs
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
const QLOG = process.env.QLOG;
const N = Number(process.env.N || 6);
const routes = JSON.parse(process.env.ROUTES);
const lines = () => (fs.existsSync(QLOG) ? fs.readFileSync(QLOG, "utf8").trim().split("\n").filter(Boolean) : []);
const out = [];
for (const r of routes) {
  const times = [];
  let qn = 0, qms = 0, qmax = 0, bytes = 0, status = 0, cache = "";
  for (let i = 0; i < N + 1; i++) {
    const before = lines().length;
    const t0 = performance.now();
    const res = await fetch(BASE + r.url, { headers: { cookie: r.cookie || "", "accept-encoding": "gzip" }, redirect: "manual" });
    const reader = res.body.getReader();
    let first = null;
    for (;;) { const { done, value } = await reader.read(); if (first === null) first = performance.now() - t0; if (done) break; bytes = i === N ? bytes + value.length : bytes; }
    const total = performance.now() - t0;
    status = res.status; cache = res.headers.get("cache-control") || "";
    await new Promise((s) => setTimeout(s, 60));
    const q = lines().slice(before).map((l) => JSON.parse(l));
    if (i === 0) continue; // warm-up
    times.push({ ttfb: first, total });
    qn += q.length; qms += q.reduce((a, x) => a + x.ms, 0); qmax = Math.max(qmax, ...q.map((x) => x.ms), 0);
  }
  const med = (k) => { const s = times.map((t) => t[k]).sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };
  const row = { key: r.key, url: r.url, status, ttfbMed: med("ttfb"), totalMed: med("total"), ttfbMax: +Math.max(...times.map((t) => t.ttfb)).toFixed(1), queriesPerReq: +(qn / N).toFixed(1), queryMsPerReq: +(qms / N).toFixed(1), queryMax: qmax, gzBytes: bytes, cacheControl: cache };
  out.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(process.env.OUT || "server-timing.json", JSON.stringify(out, null, 1));
