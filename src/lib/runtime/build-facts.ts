import { binding, cloudflareContext, type AssetsLike } from "./cloudflare";

/**
 * Facts about the build that Node pages read from disk at runtime (built CSS for font preloads,
 * the react-loadable manifest for the 3D chunk preload, which optional public files shipped).
 * Workers has no such disk, so `scripts/cloudflare/write-build-facts.ts` writes them after the
 * build to the static assets as BUILD_FACTS_PATH, and the worker entry (worker.ts) loads them
 * once per isolate before the first request. Everywhere else this slot is empty and callers keep
 * their Node code path.
 */
export type BuildFacts = {
  v: 1;
  fonts: { plexArabic: Record<string, string>; inter: string | null; noto: string | null };
  /** react-loadable-manifest entries we preload, e.g. "components/designer/DesignerApp.tsx -> ./Stage3D". */
  loadable: Record<string, string[]>;
  /** Optional public files that pages check before linking (the marketing loops). */
  publicFiles: string[];
};

export const BUILD_FACTS_PATH = "/_elba/build-facts.json";
const SLOT = Symbol.for("elba.build-facts");

type Slot = { facts?: BuildFacts; publicSet?: Set<string> };
function slot(): Slot {
  const g = globalThis as Record<symbol, Slot | undefined>;
  return (g[SLOT] ??= {});
}

/** Build facts on Workers (null in Node, or before the worker entry loaded them). */
export function workersBuildFacts(): BuildFacts | null {
  return cloudflareContext() ? (slot().facts ?? null) : null;
}

export function setBuildFacts(facts: BuildFacts): void {
  const s = slot();
  s.facts = facts;
  s.publicSet = new Set(facts.publicFiles);
}

/** On Workers: whether an optional public file shipped; null off Workers (use the disk). */
export function workersPublicFileExists(urlPath: string): boolean | null {
  if (!cloudflareContext()) return null;
  return slot().publicSet?.has(urlPath) ?? false;
}

/**
 * On Workers: fetch a public file through the ASSETS binding in the background and hand its
 * bytes to `fill` (kept alive with waitUntil). Returns false off Workers. Used for the inline
 * model posters: the first render in an isolate links the URL, later renders inline the file.
 */
const inFlight = new Set<string>();
export function warmPublicFile(urlPath: string, fill: (bytes: Uint8Array | null) => void): boolean {
  const cf = cloudflareContext();
  if (!cf) return false;
  const assets = binding<AssetsLike>("ASSETS");
  if (!assets || inFlight.has(urlPath)) return true;
  inFlight.add(urlPath);
  const job = assets
    .fetch(new Request(new URL(urlPath, "https://assets.local")))
    .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : null))
    .catch(() => null)
    .then((bytes) => {
      fill(bytes);
      inFlight.delete(urlPath);
    });
  (cf.ctx as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(job);
  return true;
}
