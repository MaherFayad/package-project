import "server-only";
import fs from "node:fs";
import path from "node:path";
import { workersPublicFileExists } from "./build-facts";

/**
 * Whether an optional file under public/ shipped with this build (the marketing turntable loops
 * land from a separate assets branch). `urlPath` is the URL path, e.g. "/marketing/loop.webm".
 * Node reads the disk; Cloudflare Workers reads the list written at build time (build-facts.ts).
 */
export function publicFileExists(urlPath: string): boolean {
  if (!urlPath.startsWith("/") || urlPath.includes("..")) return false;
  const onWorkers = workersPublicFileExists(urlPath);
  if (onWorkers !== null) return onWorkers;
  return fs.existsSync(path.join(process.cwd(), "public", urlPath));
}
