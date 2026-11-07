import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { cloudflareContext } from "@/lib/runtime/cloudflare";

/**
 * Prisma client for the server. Import as `import { db } from "@/lib/db"`.
 * Server-only: never import from a client component.
 *
 * Three setups, one import:
 *  - SQLite (`file:` URL; dev, unit tests, e2e, local `next start`): one Rust-engine client.
 *  - PostgreSQL from Node (`postgres://` URL with the client generated from
 *    prisma/postgres/schema.prisma; the local Postgres check, migrations, scripts): one client
 *    over the pg driver adapter.
 *  - Cloudflare Workers (production): a client PER REQUEST over Hyperdrive. Workers forbids
 *    reusing a socket opened by another request, so a shared client would fail on the second
 *    request. `db` is a proxy that resolves to the current request's client.
 */
type Global = { __elbaPrisma?: PrismaClient };
const globalForPrisma = globalThis as unknown as Global;

/**
 * SQLite allows one writer. With Prisma's default pool, two interactive transactions (e.g. two
 * payment callbacks or two "accept" clicks at once) each take a read lock, then both wait to
 * upgrade it: the requests hang until the socket timeout and fail with P1008/P2028, so none of
 * them is applied. One connection makes them queue instead. Postgres URLs are left untouched. An
 * explicit `connection_limit` always wins.
 */
export function databaseUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("file:") || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

/** Whether a connection string points at PostgreSQL (pure, unit-tested). */
export function isPostgresUrl(url: string | undefined): boolean {
  return !!url && /^postgres(ql)?:\/\//.test(url);
}

const log: ("warn" | "error")[] = process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

/** pg driver adapter. Hyperdrive pools connections at the edge, so a Workers request opens one socket. */
function pgAdapter(connectionString: string, perRequest: boolean): PrismaPg {
  return new PrismaPg(perRequest ? { connectionString, maxUses: 1 } : { connectionString });
}

/**
 * A standalone Node client for `url` (seed, scripts, e2e fixtures): the pg adapter for Postgres
 * (the client generated from prisma/postgres/schema.prisma has no Rust engine), the engine for
 * SQLite. The app itself uses `db`.
 */
export function createClient(url: string | undefined = process.env.ELBA_DATABASE_URL, opts: { sqliteSingleWriter?: boolean } = {}): PrismaClient {
  if (isPostgresUrl(url)) return new PrismaClient({ adapter: pgAdapter(url!, false), log });
  const u = opts.sqliteSingleWriter === false ? url : databaseUrl(url);
  return new PrismaClient({ ...(u ? { datasourceUrl: u } : {}), log });
}

/** Lazily built client for Node (SQLite or Postgres), one per process. */
function nodeClient(): PrismaClient {
  return (globalForPrisma.__elbaPrisma ??= createClient());
}

/** One client per Workers request, dropped with the request (keyed by its ExecutionContext). */
const perRequest = new WeakMap<object, PrismaClient>();

function workersClient(ctx: { ctx: object; env: Record<string, unknown> }): PrismaClient {
  const hit = perRequest.get(ctx.ctx);
  if (hit) return hit;
  const hyperdrive = ctx.env.HYPERDRIVE as { connectionString?: string } | undefined;
  const url = hyperdrive?.connectionString ?? process.env.ELBA_DATABASE_URL;
  if (!isPostgresUrl(url)) throw new Error("No PostgreSQL connection: bind HYPERDRIVE (wrangler.jsonc) or set ELBA_DATABASE_URL");
  const client = new PrismaClient({ adapter: pgAdapter(url!, true), log });
  perRequest.set(ctx.ctx, client);
  return client;
}

/** The client for the current call site. */
export function currentDb(): PrismaClient {
  const cf = cloudflareContext();
  return cf ? workersClient(cf) : nodeClient();
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = currentDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
