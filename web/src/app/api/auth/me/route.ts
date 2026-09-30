import { withAuth, ok } from "@/lib/http";
import { q1, pool } from "@/lib/db";

export const GET = withAuth([], async (_req, { session }) => {
  const u = await q1(pool, "SELECT id, username, nombre_completo, email FROM usuarios WHERE id = $1", [session.id]);
  return ok({ ...u, roles: session.roles });
});
