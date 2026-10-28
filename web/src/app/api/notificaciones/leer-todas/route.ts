import { withAuth, ok } from "@/lib/http";
import { pool } from "@/lib/db";

export const POST = withAuth(["BIBLIOTECARIO"], async (_req, { session }) => {
  const result = await pool.query(
    "UPDATE notificaciones SET leida_en = now() WHERE usuario_id = $1 AND leida_en IS NULL",
    [session.id]
  );
  return ok({ actualizadas: result.rowCount ?? 0 });
});
