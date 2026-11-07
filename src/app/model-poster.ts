import "server-only";
import fs from "node:fs";
import path from "node:path";
import { warmPublicFile } from "@/lib/runtime/build-facts";

/**
 * Model poster for a server-rendered first paint (PERF-R4-02 / R4-07).
 *
 * The posters in public/models/<slug>.svg are the phone LCP on the editor and the share page.
 * Most are 0.8-2 KB, so inlining them as a data: URL lets the LCP paint with the HTML that
 * carries it instead of one more Slow 4G round trip (~560 ms) after that HTML arrived. Larger
 * files (> 4 KB, the paper tubes) stay a normal URL. CSP allows `img-src data:`.
 */
const MAX_INLINE = 4096;
const cache = new Map<string, string>();

export function modelPosterSrc(slug: string): string {
  const url = `/models/${slug}.svg`;
  if (!/^[a-z0-9-]+$/.test(slug)) return url;
  const hit = cache.get(slug);
  if (hit) return hit;
  // Cloudflare Workers (no public/ on disk): link the URL this time, fetch the file from the
  // static assets in the background and inline it from the next render in this isolate on.
  if (warmPublicFile(url, (bytes) => cache.set(slug, bytes ? svgDataUrl(new TextDecoder().decode(bytes), url) : url))) return url;
  let out = url;
  try {
    out = svgDataUrl(fs.readFileSync(path.join(process.cwd(), "public", "models", `${slug}.svg`), "utf8"), url);
  } catch {
    // Missing file: the URL 404s exactly as before.
  }
  cache.set(slug, out);
  return out;
}

function svgDataUrl(svg: string, url: string): string {
  if (svg.length > MAX_INLINE) return url;
  const compact = svg.replace(/>\s+</g, "><").trim();
  return `data:image/svg+xml,${encodeURIComponent(compact).replace(/%20/g, " ").replace(/%3D/g, "=").replace(/%3A/g, ":").replace(/%2F/g, "/")}`;
}

/**
 * A raster image under public/ as a base64 data: URL when it is at most `max` bytes, else its
 * URL. For the share page's catalogue render (`/models/<CODE>.webp`, ~12 KB), which streams with
 * the page segment and otherwise costs one more round trip after it (PERF R4-06).
 */
const rasterCache = new Map<string, string>();
export function inlinePublicImage(url: string, max = 16_384): string {
  const m = /^\/models\/([A-Za-z0-9_-]+)\.(webp|png)$/.exec(url);
  if (!m) return url;
  const key = `${max}:${url}`;
  const hit = rasterCache.get(key);
  if (hit) return hit;
  const toData = (buf: Uint8Array) => (buf.length <= max ? `data:image/${m[2]};base64,${Buffer.from(buf).toString("base64")}` : url);
  if (warmPublicFile(url, (bytes) => rasterCache.set(key, bytes ? toData(bytes) : url))) return url;
  let out = url;
  try {
    out = toData(fs.readFileSync(path.join(process.cwd(), "public", "models", `${m[1]}.${m[2]}`)));
  } catch {
    // Missing file: the URL 404s exactly as before.
  }
  rasterCache.set(key, out);
  return out;
}
