/**
 * Preload for `next start` that logs every Prisma query with its duration, WITHOUT touching
 * src/lib/db.ts. Usage:
 *   PRISMA_QUERY_LOG=/path/queries.ndjson NODE_OPTIONS="--require ./docs/audit/tools/prisma-query-log.cjs" npm start
 * Each line: {"t":epochMs,"ms":duration,"q":"SELECT ...","target":"..."}
 */
const Module = require("module");
const fs = require("fs");
const out = process.env.PRISMA_QUERY_LOG || "prisma-queries.ndjson";
const origLoad = Module._load;
let patched = false;
Module._load = function (request, parent, isMain) {
  const mod = origLoad.apply(this, arguments);
  if (!patched && (request === "@prisma/client" || request === ".prisma/client/default") && mod && mod.PrismaClient) {
    patched = true;
    const Base = mod.PrismaClient;
    class LoggedPrismaClient extends Base {
      constructor(opts = {}) {
        const log = [...(opts.log || []), { emit: "event", level: "query" }];
        super({ ...opts, log });
        this.$on("query", (e) => {
          try {
            fs.appendFileSync(out, JSON.stringify({ t: Date.now(), ms: Number(e.duration), q: String(e.query).slice(0, 600), p: String(e.params).slice(0, 200) }) + "\n");
          } catch {}
        });
      }
    }
    try {
      Object.defineProperty(mod, "PrismaClient", { value: LoggedPrismaClient, configurable: true, writable: true, enumerable: true });
    } catch {
      return { ...mod, PrismaClient: LoggedPrismaClient };
    }
  }
  return mod;
};
