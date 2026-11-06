import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R4-09 guard: measureText / fitTextBox estimate on the server and measure with canvas in the
 * browser (and change when the webfont loads), so they may only run in event handlers. Only
 * DesignerApp's add-text and layer-change handlers call them today; a new caller must be reviewed
 * for render-path use (it would break hydration of the designer pages).
 */
describe("measureText stays out of render paths", () => {
  const dir = join(process.cwd(), "src/components/designer");
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && f !== "fonts.ts");
  it("is imported by DesignerApp only", () => {
    const users = files.filter((f) => /\b(measureText|fitTextBox)\b/.test(readFileSync(join(dir, f), "utf8")));
    expect(users).toEqual(["DesignerApp.tsx"]);
  });
  it("is called from the add-text and layer-change handlers only", () => {
    const src = readFileSync(join(dir, "DesignerApp.tsx"), "utf8");
    const calls = src.split("\n").filter((l) => /\b(measureText|fitTextBox)\(/.test(l));
    expect(calls.length).toBeGreaterThan(0);
    const onAddText = src.slice(src.indexOf("const onAddText"), src.indexOf("const onAddShape"));
    const onLayerChange = src.slice(src.indexOf("const onLayerChange"), src.indexOf("const add ="));
    expect(calls.length).toBeLessThanOrEqual(4);
    for (const l of calls) expect(onAddText.includes(l) || onLayerChange.includes(l)).toBe(true);
  });
});
