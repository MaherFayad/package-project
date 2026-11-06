/**
 * Request-body readers with a hard byte cap (OWASP ASVS 4.0.3 V12.1.1 / V13.1.3: limit request
 * size). `Content-Length` is checked first, but a chunked upload has none, so the stream itself is
 * also counted and aborted at the cap instead of being buffered in full.
 */
export const tooLarge = () => Response.json({ ok: false, error: "TOO_LARGE" }, { status: 413 });

/** The raw body, or a 413 Response when it is larger than `maxBytes`. */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<Uint8Array | Response> {
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** JSON body with a cap; 400 INVALID_BODY when it does not parse. */
export async function readJsonCapped(req: Request, maxBytes: number): Promise<unknown | Response> {
  const bytes = await readBodyCapped(req, maxBytes);
  if (bytes instanceof Response) return bytes;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  }
}

/** Multipart form with a cap; 400 INVALID when it does not parse. */
export async function readFormCapped(req: Request, maxBytes: number): Promise<FormData | Response> {
  const bytes = await readBodyCapped(req, maxBytes);
  if (bytes instanceof Response) return bytes;
  try {
    return await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return Response.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
}
