import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postgresSchema, SOURCE, TARGET } from "../../../scripts/generate-postgres-schema";

vi.mock("server-only", () => ({}));

const SLOT = Symbol.for("__cloudflare-context__");
type G = Record<symbol, unknown>;

/** Pretend to be inside a Workers request with these bindings (the OpenNext ALS slot). */
function onWorkers(env: Record<string, unknown>) {
  (globalThis as G)[SLOT] = { env, ctx: { waitUntil: () => {} } };
}
afterEach(() => {
  delete (globalThis as G)[SLOT];
  delete process.env.TRUST_CF_CONNECTING_IP;
});

/** In-memory R2 bucket with the surface src/lib/storage/blob.ts uses. */
function fakeR2() {
  const m = new Map<string, Uint8Array>();
  return {
    m,
    async put(k: string, v: Uint8Array) {
      m.set(k, new Uint8Array(v));
    },
    async get(k: string) {
      const v = m.get(k);
      return v ? { arrayBuffer: async () => v.slice().buffer } : null;
    },
    async head(k: string) {
      return m.has(k) ? {} : null;
    },
    async delete(k: string) {
      m.delete(k);
    },
    async list({ prefix }: { prefix: string }) {
      return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false };
    },
  };
}

describe("Postgres schema (Cloudflare + Neon)", () => {
  it("prisma/postgres/schema.prisma is up to date with prisma/schema.prisma", () => {
    expect(fs.readFileSync(TARGET, "utf8")).toBe(postgresSchema(fs.readFileSync(SOURCE, "utf8")));
  });
  it("swaps only the provider and the engine", () => {
    const pg = postgresSchema(fs.readFileSync(SOURCE, "utf8"));
    expect(pg).toContain('provider = "postgresql"');
    expect(pg).toContain('engineType = "client"');
    expect(pg).not.toContain('provider = "sqlite"');
    expect(pg.match(/^model /gm)?.length).toBe(fs.readFileSync(SOURCE, "utf8").match(/^model /gm)?.length);
  });
  it("has a baseline migration", () => {
    const sql = fs.readFileSync(path.join(path.dirname(TARGET), "migrations", "0001_init", "migration.sql"), "utf8");
    expect(sql).toContain('CREATE TABLE "User"');
  });
});

describe("db connection setup", () => {
  it("recognises Postgres URLs and keeps the SQLite single-writer rule", async () => {
    const { isPostgresUrl, databaseUrl } = await import("@/lib/db");
    expect(isPostgresUrl("postgresql://u:p@h/db")).toBe(true);
    expect(isPostgresUrl("postgres://u:p@h/db")).toBe(true);
    expect(isPostgresUrl("file:./dev.db")).toBe(false);
    expect(isPostgresUrl(undefined)).toBe(false);
    expect(databaseUrl("postgresql://h/db")).toBe("postgresql://h/db");
    expect(databaseUrl("file:./x.db")).toBe("file:./x.db?connection_limit=1");
  });
  it("refuses to run on Workers without a Postgres connection", async () => {
    const { currentDb } = await import("@/lib/db");
    onWorkers({});
    const before = process.env.ELBA_DATABASE_URL;
    process.env.ELBA_DATABASE_URL = "file:./nope.db";
    try {
      expect(() => currentDb()).toThrow(/HYPERDRIVE/);
    } finally {
      process.env.ELBA_DATABASE_URL = before;
    }
  });
});

describe("blob storage", () => {
  it("validates keys", async () => {
    const { validKey } = await import("@/lib/storage/blob");
    expect(validKey("uploads/apply/u1/abc.pdf")).toBe(true);
    expect(validKey("storage/proofs/p1.img")).toBe(true);
    for (const bad of ["../x/y", "uploads/../etc/passwd", "/abs/path", "uploads//x", "uploads", "uploads/a b/c"]) expect(validKey(bad)).toBe(false);
  });

  it("uses the disk in Node with the same layout as before", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elba-blob-"));
    process.env.ELBA_STORAGE_DIR = path.join(dir, "storage");
    process.env.ELBA_UPLOAD_DIR = path.join(dir, "uploads");
    try {
      const { putBlob, getBlob, hasBlob, listBlobs, deleteBlob } = await import("@/lib/storage/blob");
      await putBlob("storage/proofs/p1.img", new Uint8Array([1, 2, 3]));
      expect(fs.existsSync(path.join(dir, "storage", "proofs", "p1.img"))).toBe(true);
      await putBlob("uploads/apply/u1/a.pdf", new Uint8Array([4]), { createOnly: true });
      await expect(putBlob("uploads/apply/u1/a.pdf", new Uint8Array([5]), { createOnly: true })).rejects.toThrow();
      expect(fs.existsSync(path.join(dir, "uploads", "apply", "u1", "a.pdf"))).toBe(true);
      expect([...(await getBlob("storage/proofs/p1.img"))!]).toEqual([1, 2, 3]);
      expect(await hasBlob("uploads/apply/u1/a.pdf")).toBe(true);
      expect(await listBlobs("uploads/apply/u1")).toEqual(["uploads/apply/u1/a.pdf"]);
      await deleteBlob("uploads/apply/u1/a.pdf");
      expect(await hasBlob("uploads/apply/u1/a.pdf")).toBe(false);
      expect(await getBlob("storage/missing.img")).toBeNull();
    } finally {
      delete process.env.ELBA_STORAGE_DIR;
      delete process.env.ELBA_UPLOAD_DIR;
    }
  });

  it("uses the ELBA_FILES R2 bucket on Workers", async () => {
    const r2 = fakeR2();
    onWorkers({ ELBA_FILES: r2 });
    const { putBlob, getBlob, hasBlob, listBlobs, deleteBlob } = await import("@/lib/storage/blob");
    await putBlob("uploads/dispute-photo/o1/x.jpg", new Uint8Array([9]), { createOnly: true });
    await putBlob("uploads/dispute-photo/o1/y.jpg", new Uint8Array([8]));
    await putBlob("uploads/dispute-photo/o12/z.jpg", new Uint8Array([7]));
    await expect(putBlob("uploads/dispute-photo/o1/x.jpg", new Uint8Array([1]), { createOnly: true })).rejects.toThrow("STORAGE_KEY_EXISTS");
    expect([...(await getBlob("uploads/dispute-photo/o1/x.jpg"))!]).toEqual([9]);
    expect(await hasBlob("uploads/dispute-photo/o1/y.jpg")).toBe(true);
    // a prefix lists its own folder only (o1, not o12)
    expect((await listBlobs("uploads/dispute-photo/o1")).sort()).toEqual(["uploads/dispute-photo/o1/x.jpg", "uploads/dispute-photo/o1/y.jpg"]);
    await deleteBlob("uploads/dispute-photo/o1/x.jpg");
    expect(r2.m.has("uploads/dispute-photo/o1/x.jpg")).toBe(false);
  });

  it("vendor uploads and order files map onto their areas", async () => {
    const r2 = fakeR2();
    onWorkers({ ELBA_FILES: r2 });
    const { putFile, getFile } = await import("@/lib/orders/storage");
    await putFile("proofs/p9.img", new Uint8Array([1]));
    expect(r2.m.has("storage/proofs/p9.img")).toBe(true);
    expect(await getFile("proofs/p9.img")).not.toBeNull();
    await expect(putFile("../x", new Uint8Array([1]))).rejects.toThrow();
    const { uploadExists, readUpload } = await import("@/components/vendor/server/storage");
    expect(await uploadExists("apply/u1/../../x.pdf")).toBe(false);
    expect(await readUpload("not-a-key")).toBeNull();
  });
});

describe("client IP behind Cloudflare", () => {
  it("trusts only CF-Connecting-IP when TRUST_CF_CONNECTING_IP=1", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    const h = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "6.6.6.6", "x-forwarded-for": "7.7.7.7" });
    process.env.TRUST_CF_CONNECTING_IP = "1";
    expect(clientIp(h)).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "6.6.6.6" }))).toBe("unknown");
    delete process.env.TRUST_CF_CONNECTING_IP;
    expect(clientIp(h)).toBe("6.6.6.6");
  });
});

describe("build facts on Workers", () => {
  it("font, chunk and public-file lookups read the facts instead of the disk", async () => {
    vi.resetModules();
    const { setBuildFacts } = await import("@/lib/runtime/build-facts");
    setBuildFacts({
      v: 1,
      fonts: { plexArabic: { "400": "/_next/static/media/p4.woff2" }, inter: "/_next/static/media/i.woff2", noto: "/_next/static/media/n.woff2" },
      loadable: { "components/designer/DesignerApp.tsx -> ./Stage3D": ["static/chunks/abc.js", "static/css/x.css"] },
      publicFiles: ["/marketing/r6/loops/mailer-720p.webm"],
    });
    onWorkers({});
    const fonts = await import("@/app/font-preload");
    expect(fonts.plexArabicPreloadUrls([400, 700])).toEqual(["/_next/static/media/p4.woff2"]);
    expect(fonts.interPreloadUrl()).toBe("/_next/static/media/i.woff2");
    expect(fonts.notoArabicPreloadUrl()).toBe("/_next/static/media/n.woff2");
    const { publicFileExists } = await import("@/lib/runtime/public-files");
    expect(publicFileExists("/marketing/r6/loops/mailer-720p.webm")).toBe(true);
    expect(publicFileExists("/marketing/r6/loops/can-720p.webm")).toBe(false);
    expect(publicFileExists("/../secret")).toBe(false);
  });

  it("the build-facts writer reads the real build layout", async () => {
    const { computeBuildFacts } = await import("../../../scripts/cloudflare/write-build-facts");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elba-facts-"));
    fs.mkdirSync(path.join(dir, "dist/static/css"), { recursive: true });
    fs.mkdirSync(path.join(dir, "public/marketing/a"), { recursive: true });
    fs.writeFileSync(path.join(dir, "public/marketing/a/loop.webm"), "x");
    fs.writeFileSync(path.join(dir, "dist/static/css/a.css"), "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/l.woff2);unicode-range:u+00??}");
    fs.writeFileSync(path.join(dir, "dist/react-loadable-manifest.json"), JSON.stringify({ "components/designer/DesignerApp.tsx -> ./Stage3D": { files: ["static/chunks/z.js"] }, other: { files: ["static/chunks/o.js"] } }));
    const facts = computeBuildFacts(path.join(dir, "dist"), path.join(dir, "public"));
    expect(facts.fonts.inter).toBe("/_next/static/media/l.woff2");
    expect(facts.loadable).toEqual({ "components/designer/DesignerApp.tsx -> ./Stage3D": ["static/chunks/z.js"] });
    expect(facts.publicFiles).toEqual(["/marketing/a/loop.webm"]);
  });
});
