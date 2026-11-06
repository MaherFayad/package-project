// R5-PL-16: metric-match IBM Plex Sans Arabic against the local Arabic fonts the fallback lands on.
// Loads Plex (400/600/700) and Noto Sans Arabic from the built media files, measures real UI strings
// on a canvas against each local face, and prints size-adjust / ascent / descent / line-gap overrides.
//   BASE=http://localhost:3000 node docs/audit/tools/arabic-fallback-metrics.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(BASE + "/robots.txt");
const html = await (await p.request.get(BASE + "/ar")).text();
const pick = (re) => (html.match(re) || [])[1];
const plex = Object.fromEntries([400, 600, 700].map((w) => [w, pick(new RegExp(`font-family:IBM Plex Sans Arabic;font-style:normal;font-weight:${w};font-display:swap;src:url\\((/_next/static/media/[a-z0-9]+-s\\.woff2)\\) format\\("woff2"\\);unicode-range:u\\+06`))]));
const noto = pick(/font-family:Noto Sans Arabic;font-style:normal;font-weight:100 900;[^}]*?src:url\((\/_next\/static\/media\/[a-z0-9]+-s\.woff2)\)[^}]*unicode-range:u\+06/);
const SAMPLES = [
  "نستخدم ملفات تعريف الارتباط الضرورية لإبقائك مسجلا للدخول وتذكر لغتك والاحتفاظ بتصميمك غير المحفوظ، وقياسا داخليا لاستخدام الموقع لا نشاركه مع أي جهة أخرى. لا نستخدم ملفات إعلانية.",
  "الكمية والسعر ومتابعة الطلب وتأكيد البروفة قبل الطباعة",
  "علبة بريدية مطبوعة حسب الطلب، تصممها ثلاثية الأبعاد، وتصنع في مصر",
  "طلبات بانتظار ردك تسليم خلال ثلاثة أيام المدفوع لك التقييم",
];
const out = await p.evaluate(async ({ plex, noto, SAMPLES }) => {
  for (const [w, url] of Object.entries(plex)) { const f = new FontFace("MPlex", `url(${url})`, { weight: w }); await f.load(); document.fonts.add(f); }
  if (noto) { const f = new FontFace("MNoto", `url(${noto})`, { weight: "100 900" }); await f.load(); document.fonts.add(f); }
  const c = document.createElement("canvas").getContext("2d");
  const m = (family, w) => {
    c.font = `${w} 100px ${family}`;
    let width = 0, asc = 0, desc = 0;
    for (const s of SAMPLES) { const t = c.measureText(s); width += t.width; asc = t.fontBoundingBoxAscent; desc = t.fontBoundingBoxDescent; }
    return { width, asc, desc };
  };
  const res = {};
  for (const w of [400, 600, 700]) {
    const P = m("MPlex", w);
    res[w] = { plex: P };
    for (const [name, fam] of [["dejavu", "'DejaVu Sans'"], ["noto", "MNoto"]]) {
      const F = m(fam, w);
      const size = P.width / F.width; // size-adjust that makes the fallback run as wide as Plex
      res[w][name] = { sizeAdjust: +(size * 100).toFixed(2), ascent: +((P.asc / 100 / size) * 100).toFixed(2), descent: +((P.desc / 100 / size) * 100).toFixed(2), raw: F };
    }
  }
  return res;
}, { plex, noto, SAMPLES });
console.log(JSON.stringify({ plex, noto, out }, null, 1));
await b.close();
