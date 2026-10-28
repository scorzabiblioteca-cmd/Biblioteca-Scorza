import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { z } from "zod";

export const PATCH = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Identificador de notificación no válido");
  const { leida } = await body(req, z.object({ leida: z.boolean() }));
  const notification = await q1(
    pool,
    `UPDATE notificaciones SET leida_en = CASE WHEN $3 THEN COALESCE(leida_en, now()) ELSE NULL END
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, leida_en`,
    [id, session.id, leida]
  );
  if (!notification) throw new HttpError(404, "Notificación no encontrada");
  return ok(notification);
});
