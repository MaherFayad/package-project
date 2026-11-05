import { apiRequireRole } from "@/lib/auth";
import { audit } from "@/components/admin/server/context";
import { exportUserData } from "@/components/admin/server/queries";

/**
 * GET /api/admin/users/:id/export — PDPL access request: everything Elba holds about one user as
 * a JSON download. ADMIN only; every download is written to the audit log.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await apiRequireRole("ADMIN");
  if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!/^[\w-]{1,40}$/.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const data = await exportUserData(id);
  if (!data) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await audit(admin, { action: "DATA_EXPORT", entityType: "USER", entityId: id, summary: `export ${id}` });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="elba-user-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
