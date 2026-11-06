/** R5-PL-11: the vendored strict CSS chunking plugin must stay in step with the installed Next. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const upstream = fs.readFileSync(path.join(root, "node_modules/next/dist/build/webpack/plugins/css-chunking-plugin.js"), "utf8");
const vendored = fs.readFileSync(path.join(root, "scripts/next/css-chunking-plugin.cjs"), "utf8");

describe("vendored CssChunkingPlugin", () => {
  it("matches next's file except the header comment and the ELBA line (re-copy after a Next upgrade)", () => {
    const body = vendored.slice(vendored.indexOf("*/\n") + 3);
    const expected = upstream.replace(" */ const MIN_CSS_CHUNK_SIZE = 30 * 1024;", " */ const MIN_CSS_CHUNK_SIZE = 0; // ELBA: upstream 30 * 1024");
    expect(expected).not.toBe(upstream); // the upstream line still exists
    expect(body).toBe(expected);
  });

  it("is wired in next.config.ts", () => {
    const cfg = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(cfg).toContain("scripts/next/css-chunking-plugin.cjs");
    expect(cfg).toMatch(/cssChunking:\s*"strict"/);
  });
});
