import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("modelPosterSrc", () => {
  it("inlines small posters as a data: URL that decodes to the same SVG", async () => {
    const { modelPosterSrc } = await import("@/app/model-poster");
    const src = modelPosterSrc("mailer-box");
    expect(src.startsWith("data:image/svg+xml,")).toBe(true);
    const svg = decodeURIComponent(src.slice("data:image/svg+xml,".length));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 480 360"');
  });
  it("keeps large or unknown posters as a URL", async () => {
    const { modelPosterSrc } = await import("@/app/model-poster");
    expect(modelPosterSrc("paper-tube-rolled-edge")).toBe("/models/paper-tube-rolled-edge.svg");
    expect(modelPosterSrc("no-such-model")).toBe("/models/no-such-model.svg");
    expect(modelPosterSrc("../etc/passwd")).toBe("/models/../etc/passwd.svg");
  });
});

describe("inlinePublicImage", () => {
  it("inlines a small model render as base64 and leaves other paths alone", async () => {
    const { inlinePublicImage } = await import("@/app/model-poster");
    expect(inlinePublicImage("/models/FEFCO_0427.webp").startsWith("data:image/webp;base64,")).toBe(true);
    expect(inlinePublicImage("/models/FEFCO_0427.webp", 100)).toBe("/models/FEFCO_0427.webp");
    expect(inlinePublicImage("/models/../secret.webp")).toBe("/models/../secret.webp");
    expect(inlinePublicImage("/models/NO_SUCH.webp")).toBe("/models/NO_SUCH.webp");
  });
});
