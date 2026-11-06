import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("plexArabicPreloadUrls", () => {
  it("picks the Arabic-block file of each requested weight from the built CSS", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elba-fonts-"));
    fs.mkdirSync(path.join(dir, ".next/static/css"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".next/static/css/a.css"),
      [
        "@font-face{font-family:IBM Plex Sans Arabic;font-weight:400;src:url(/_next/static/media/ar400-s.woff2) format(\"woff2\");unicode-range:u+06??,u+0750-077f}",
        "@font-face{font-family:IBM Plex Sans Arabic;font-weight:400;src:url(/_next/static/media/lat400-s.woff2) format(\"woff2\");unicode-range:u+00??}",
        "@font-face{font-family:IBM Plex Sans Arabic;font-weight:700;src:url(/_next/static/media/ar700-s.woff2) format(\"woff2\");unicode-range:u+06??}",
        "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/inter.woff2);unicode-range:u+00??}",
      ].join("\n"),
    );
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const { plexArabicPreloadUrls } = await import("@/app/font-preload");
    expect(plexArabicPreloadUrls([400, 700])).toEqual(["/_next/static/media/ar400-s.woff2", "/_next/static/media/ar700-s.woff2"]);
    expect(plexArabicPreloadUrls([600])).toEqual([]);
  });
});

describe("interPreloadUrl", () => {
  it("picks the Basic Latin Inter file, not the other subsets", async () => {
    vi.resetModules();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elba-fonts-"));
    fs.mkdirSync(path.join(dir, ".next/static/css"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".next/static/css/b.css"),
      [
        "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/cyr-s.woff2) format(\"woff2\");unicode-range:u+0460-052f}",
        "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/latin-s.woff2) format(\"woff2\");unicode-range:u+00??,u+0131}",
        "@font-face{font-family:IBM Plex Sans Arabic;font-weight:400;src:url(/_next/static/media/plat-s.woff2) format(\"woff2\");unicode-range:u+00??}",
      ].join("\n"),
    );
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const { interPreloadUrl } = await import("@/app/font-preload");
    expect(interPreloadUrl()).toBe("/_next/static/media/latin-s.woff2");
  });
});

describe("notoArabicPreloadUrl", () => {
  it("picks the Arabic-block Noto Sans Arabic file, not its Latin subset", async () => {
    vi.resetModules();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elba-fonts-"));
    fs.mkdirSync(path.join(dir, ".next/static/css"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".next/static/css/c.css"),
      [
        "@font-face{font-family:Noto Sans Arabic;font-weight:100 900;src:url(/_next/static/media/nlat-s.woff2) format(\"woff2\");unicode-range:u+00??,u+0131}",
        "@font-face{font-family:Noto Sans Arabic;font-weight:100 900;src:url(/_next/static/media/nar-s.woff2) format(\"woff2\");unicode-range:u+06??,u+0750-077f}",
        "@font-face{font-family:IBM Plex Sans Arabic;font-weight:400;src:url(/_next/static/media/plex-s.woff2) format(\"woff2\");unicode-range:u+06??}",
      ].join("\n"),
    );
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const { notoArabicPreloadUrl } = await import("@/app/font-preload");
    expect(notoArabicPreloadUrl()).toBe("/_next/static/media/nar-s.woff2");
  });
});
