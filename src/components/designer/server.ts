import "server-only";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fromJson, toJson } from "@/lib/json";
import { ANON_COOKIE } from "@/lib/auth/constants";
import { randomToken } from "@/lib/auth/crypto";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { isProd } from "@/lib/env";
import {
  ANON_DESIGN_TTL_DAYS,
  FINISH_CODES,
  MATERIAL_CODES,
  STRUCTURE_CODES,
  emptyArtwork,
  type Artwork,
  type ArtworkLayer,
  type DesignDoc,
  type Dims,
  type DimsPreset,
  type FinishCode,
  type MaterialCode,
  type PrintSides,
  type StructureCode,
  type StructureFamily,
  type StructureParamLimits,
} from "@/types";
import { DEFAULT_DIMS, STRUCTURE_FAMILY, STRUCTURE_LIMITS, defaultMaterialFor, materialFitsStructure } from "@/lib/dieline";
import { FALLBACK_PRESETS, STRUCTURE_SLUGS } from "./lib/catalog";
import { designConfigSchema as configSchema, designDocSchema, layerSchema } from "./lib/doc";
import { canRead, canWrite, type Actor as AccessActor } from "./lib/access";

export { canRead, canWrite };

/**
 * Designer data access (owner: designer). Server-only.
 *
 * Access rules for a Design row:
 * - owner: `ownerId === session user` (ADMIN may read any design);
 * - anonymous: `ownerId === null && anonId === elba_anon cookie` and not expired;
 * - shared: read-only through `shareToken` (owner must create it while signed in).
 */

const ANON_TTL_MS = ANON_DESIGN_TTL_DAYS * 86_400_000;
const ANON_ID_RE = /^[\w-]{16,64}$/;

type DesignRow = Prisma.DesignGetPayload<{ include: { material: true } }>;


export interface Actor extends AccessActor {
  user: SessionUser | null;
}

export async function currentActor(): Promise<Actor> {
  const [session, jar] = await Promise.all([getSession(), cookies()]);
  const anon = jar.get(ANON_COOKIE)?.value ?? null;
  return { user: session?.user ?? null, anonId: anon && ANON_ID_RE.test(anon) ? anon : null };
}

/** Make sure the browser has an anonymous id (route handlers / server actions only). */
export async function ensureAnonId(actor: Actor): Promise<string> {
  if (actor.anonId) return actor.anonId;
  const id = randomToken(18);
  const jar = await cookies();
  jar.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd && !process.env.E2E_INSECURE_COOKIES,
    path: "/",
    maxAge: ANON_DESIGN_TTL_DAYS * 86_400,
  });
  actor.anonId = id;
  return id;
}

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/** Lenient row → DesignDoc: invalid layers are dropped instead of failing the whole design. */
export function rowToDoc(row: DesignRow): DesignDoc | null {
  if (!isIn(STRUCTURE_CODES, row.structureCode)) return null;
  const code = row.structureCode as StructureCode;
  const dims = fromJson<Dims>(row.dims);
  const okDims = dims && [dims.L, dims.W, dims.H].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
  const matCode = row.material?.code;
  const materialCode: MaterialCode =
    isIn(MATERIAL_CODES, matCode) && materialFitsStructure(matCode, code) ? matCode : defaultMaterialFor(code);
  const raw = fromJson<Partial<Artwork> | null>(row.artwork) ?? {};
  const art = emptyArtwork();
  for (const side of ["outside", "inside"] as const) {
    const s = raw[side];
    if (!s) continue;
    art[side].background = typeof s.background === "string" && /^#[0-9a-fA-F]{6}$/.test(s.background) ? s.background : null;
    art[side].layers = (Array.isArray(s.layers) ? s.layers : [])
      .map((l) => layerSchema.safeParse(l))
      .filter((r) => r.success)
      .map((r) => r.data as ArtworkLayer)
      .filter((l) => l.surface === side);
  }
  const doc: DesignDoc = {
    v: 1,
    id: row.id,
    name: row.name,
    structureCode: code,
    dims: okDims ? { L: dims.L, W: dims.W, H: dims.H } : { ...DEFAULT_DIMS[code] },
    materialCode,
    finishCode: isIn(FINISH_CODES, row.finishCode) ? (row.finishCode as FinishCode) : "NONE",
    printSides: row.printSides === "BOTH" ? "BOTH" : ("OUTSIDE" as PrintSides),
    artwork: art,
  };
  // Added by 3D integration: library model + config (features, finishes, container).
  const extra = configSchema.safeParse({ modelCode: row.modelCode ?? undefined, ...(fromJson<object | null>(row.config ?? null) ?? {}) });
  if (extra.success) {
    const e = extra.data;
    const withModel = { ...doc, ...(e.modelCode ? { modelCode: e.modelCode } : {}), ...(e.features ? { features: e.features } : {}), ...(e.finishes ? { finishes: e.finishes } : {}), ...(e.vessel ? { vessel: e.vessel } : {}) } as DesignDoc;
    // A model whose material was changed underneath (admin edits): keep the base design.
    if (designDocSchema.safeParse(withModel).success) return withModel;
  }
  return doc;
}

/** The DesignDoc fields stored in Design.config / OrderItem.config. */
export function docConfig(doc: DesignDoc): { features?: DesignDoc["features"]; finishes?: DesignDoc["finishes"]; vessel?: DesignDoc["vessel"] } | null {
  const c = { ...(doc.features ? { features: doc.features } : {}), ...(doc.finishes?.length ? { finishes: doc.finishes } : {}), ...(doc.vessel ? { vessel: doc.vessel } : {}) };
  return Object.keys(c).length ? c : null;
}

export interface LoadedDesign {
  doc: DesignDoc;
  ownerId: string | null;
  shareToken: string | null;
  updatedAt: string;
}

export async function loadDesign(id: string, actor: Actor): Promise<LoadedDesign | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const row = await db.design.findUnique({ where: { id }, include: { material: true } });
  if (!row || !canRead(row, actor)) return null;
  const doc = rowToDoc(row);
  if (!doc) return null;
  return { doc, ownerId: row.ownerId, shareToken: row.shareToken, updatedAt: row.updatedAt.toISOString() };
}

export type SaveResult =
  | { ok: true; id: string; owned: boolean; updatedAt: string }
  | { ok: false; status: 403 | 404; error: "FORBIDDEN" | "NOT_FOUND" };

/** Create or update a design for the current actor (anonymous designs expire in 30 days). */
export async function saveDesign(doc: DesignDoc, actor: Actor, opts: { id?: string; thumbnail?: string | null } = {}): Promise<SaveResult> {
  const material = await db.material.findUnique({ where: { code: doc.materialCode } });
  const data = {
    name: doc.name.trim(),
    structureCode: doc.structureCode,
    modelCode: doc.modelCode ?? null,
    config: docConfig(doc) ? toJson(docConfig(doc)) : Prisma.JsonNull,
    dims: toJson(doc.dims),
    materialId: material?.id ?? null,
    finishCode: doc.finishCode,
    printSides: doc.printSides,
    artwork: toJson(doc.artwork),
    ...(opts.thumbnail !== undefined ? { thumbnailUrl: opts.thumbnail } : {}),
  };
  const now = new Date();

  if (opts.id) {
    const row = await db.design.findUnique({ where: { id: opts.id }, select: { ownerId: true, anonId: true, expiresAt: true } });
    if (!row) return { ok: false, status: 404, error: "NOT_FOUND" };
    if (!canWrite(row, actor, now)) {
      // A signed-in user editing their own earlier anonymous draft from another browser: forbid.
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
    const owned = !!row.ownerId;
    const updated = await db.design.update({
      where: { id: opts.id },
      data: {
        ...data,
        // Signing in claims the draft (verify-otp also claims by cookie).
        ...(!owned && actor.user ? { ownerId: actor.user.id, expiresAt: null } : {}),
        ...(!owned && !actor.user ? { expiresAt: new Date(now.getTime() + ANON_TTL_MS) } : {}),
      },
    });
    return { ok: true, id: updated.id, owned: !!updated.ownerId, updatedAt: updated.updatedAt.toISOString() };
  }

  if (actor.user) {
    const created = await db.design.create({ data: { ...data, ownerId: actor.user.id } });
    return { ok: true, id: created.id, owned: true, updatedAt: created.updatedAt.toISOString() };
  }
  const anonId = await ensureAnonId(actor);
  // Opportunistic clean-up of expired anonymous drafts (they have no proofs or orders).
  await db.design.deleteMany({ where: { ownerId: null, expiresAt: { lt: now } } }).catch(() => undefined);
  const created = await db.design.create({
    data: { ...data, anonId, expiresAt: new Date(now.getTime() + ANON_TTL_MS) },
  });
  return { ok: true, id: created.id, owned: false, updatedAt: created.updatedAt.toISOString() };
}

/** Create (or return) the share token. Signed-in owners only. */
export async function shareDesign(id: string, user: SessionUser): Promise<{ ok: true; token: string; created: boolean } | { ok: false; status: 403 | 404 }> {
  const row = await db.design.findUnique({ where: { id }, select: { ownerId: true, shareToken: true } });
  if (!row) return { ok: false, status: 404 };
  if (row.ownerId !== user.id) return { ok: false, status: 403 };
  if (row.shareToken) return { ok: true, token: row.shareToken, created: false };
  const token = randomToken(12);
  await db.design.update({ where: { id }, data: { shareToken: token } });
  return { ok: true, token, created: true };
}

export async function loadSharedDesign(token: string): Promise<{ doc: DesignDoc; designId: string } | null> {
  if (!/^[\w-]{8,64}$/.test(token)) return null;
  const row = await db.design.findUnique({ where: { shareToken: token }, include: { material: true } });
  if (!row || !row.ownerId) return null;
  const doc = rowToDoc(row);
  return doc ? { doc, designId: row.id } : null;
}

// ───────────────────────── catalog for the picker ─────────────────────────

export interface PickerStructure {
  code: StructureCode;
  slug: string;
  family: StructureFamily;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  params: StructureParamLimits;
  presets: DimsPreset[];
  imageUrl: string;
}

/** Active structures from the DB (sorted), falling back to the static catalog. */
export async function loadPickerStructures(): Promise<PickerStructure[]> {
  const rows = await db.structure.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
  const valid = rows.filter((r) => isIn(STRUCTURE_CODES, r.code));
  if (valid.length) {
    return valid.map((r) => {
      const code = r.code as StructureCode;
      return {
        code,
        slug: STRUCTURE_SLUGS[code],
        family: STRUCTURE_FAMILY[code],
        name: { ar: r.nameAr, en: r.nameEn },
        description: { ar: r.descriptionAr, en: r.descriptionEn },
        params: fromJson<StructureParamLimits>(r.params) ?? STRUCTURE_LIMITS[code],
        presets: fromJson<DimsPreset[]>(r.presets) ?? FALLBACK_PRESETS[code],
        imageUrl: `/seed/structures/${STRUCTURE_SLUGS[code]}.svg`,
      };
    });
  }
  return [];
}

/** Presets for one structure (DB first). */
export async function loadPresets(code: StructureCode): Promise<DimsPreset[]> {
  const row = await db.structure.findUnique({ where: { code }, select: { presets: true } }).catch(() => null);
  const p = row ? fromJson<DimsPreset[]>(row.presets) : null;
  return Array.isArray(p) && p.length ? p : FALLBACK_PRESETS[code];
}

// ── 3D chunk preloads (PERF-10) ───────────────────────────────────────────
let loadable: Record<string, { files?: string[] }> | null | undefined;

/**
 * JS files of a `next/dynamic` import in DesignerApp ("./Scene3D" or "./VesselView"), read from
 * the build's react-loadable manifest, so the page can ask the browser to fetch three.js while it
 * hydrates instead of after. Empty under `next dev` or when the manifest is missing.
 */
export function lazyChunkHrefs(entry: "./Scene3D" | "./VesselView"): string[] {
  if (loadable === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("node:path") as typeof import("node:path");
      loadable = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".next", "react-loadable-manifest.json"), "utf8"));
    } catch {
      loadable = null;
    }
  }
  const files = loadable?.[`components/designer/DesignerApp.tsx -> ${entry}`]?.files ?? [];
  return files.filter((f) => f.endsWith(".js") && /^static\/chunks\/[\w.-]+\.js$/.test(f)).map((f) => `/_next/${f}`);
}
