import { describe, expect, it } from "vitest";
import { markHost, markLayout, markText } from "../exportMark";

const measure = (chars: number) => (px: number) => chars * px * 0.55;

describe("export attribution mark (B-22)", () => {
  it("uses the brand copy and a short host", () => {
    expect(markText("en", "elba.eg")).toBe("Design your box on Elba · elba.eg");
    expect(markText("ar", "elba.eg")).toBe("صمم علبتك على علبة · elba.eg");
    expect(markHost("https://www.elba.eg/ar")).toBe("elba.eg");
    expect(markHost("http://localhost:3000")).toBe("elba.eg");
    expect(markHost(undefined)).toBe("elba.eg");
  });

  it("sits in the bottom end corner, inside the image, under 46% of the width", () => {
    for (const [w, dir] of [[1080, "ltr"], [1080, "rtl"], [400, "ltr"]] as const) {
      const L = markLayout(w, w, measure(34), dir);
      expect(L.w).toBeLessThanOrEqual(w * 0.46 + 1);
      expect(L.x).toBeGreaterThanOrEqual(0);
      expect(L.x + L.w).toBeLessThanOrEqual(w);
      expect(L.y + L.h).toBeLessThanOrEqual(w);
      expect(L.y).toBeGreaterThan(w * 0.8);
      if (dir === "ltr") expect(L.x).toBeGreaterThan(w / 2);
      else expect(L.x + L.w).toBeLessThan(w / 2);
    }
  });

  it("scales the type with the image (about 2.2% of the width)", () => {
    expect(markLayout(1080, 1080, measure(10), "ltr").fontPx).toBe(24);
  });
});
