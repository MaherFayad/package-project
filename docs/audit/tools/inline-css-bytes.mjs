// Inline CSS weight per page (R6 restyle). Usage:
//   node docs/audit/tools/inline-css-bytes.mjs http://localhost:3100 /ar/catalog /en/boxes ...
// Prints, per page: HTML size (raw and gzip), bytes inside <style> tags, and how many of those
// stylesheets are embedded a second time in the RSC payload (the R4-08 inlineCss duplication),
// measured by looking for each stylesheet's first 120 characters in the flight data.
import { gzipSync } from "node:zlib";
const [base, ...paths] = process.argv.slice(2);
for (const p of paths) {
  const res = await fetch(base + p);
  const html = await res.text();
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const styleBytes = styles.reduce((n, s) => n + Buffer.byteLength(s), 0);
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)].map((m) => m[1]).join("");
  // Rules are split into one <style> per chunk by precedence in the head; sample each rule block.
  const blocks = styles.join("").split("}").filter((b) => b.length > 60);
  const sample = blocks.filter((_, i) => i % 50 === 0).map((b) => b.slice(0, 50).replace(/"/g, '\\"'));
  const dup = sample.length ? sample.filter((s) => flight.includes(s)).length / sample.length : 0;
  console.log(
    JSON.stringify({
      path: p,
      status: res.status,
      htmlKB: +(Buffer.byteLength(html) / 1024).toFixed(1),
      htmlGzKB: +(gzipSync(html).length / 1024).toFixed(1),
      styleTags: styles.length,
      inlineCssKB: +(styleBytes / 1024).toFixed(1),
      inlineCssGzKB: +(gzipSync(styles.join("")).length / 1024).toFixed(1),
      flightKB: +(Buffer.byteLength(flight) / 1024).toFixed(1),
      cssAlsoInFlight: `${Math.round(dup * 100)}%`,
    }),
  );
}
