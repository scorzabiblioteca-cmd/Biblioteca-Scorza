import { withAuth, ok } from "@/lib/http";
import { q, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const items = await q(
    pool,
    `SELECT h.id, h.tipo_evento, h.estado_anterior, h.estado_nuevo, h.condicion_nueva, h.detalle, h.created_at,
            us.username AS usuario,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
     FROM historial_ejemplares h
     JOIN usuarios us ON us.id = h.usuario_id
     LEFT JOIN prestamo_detalles pd ON pd.id = h.prestamo_detalle_id
     LEFT JOIN prestamos p ON p.id = pd.prestamo_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id
     LEFT JOIN profesores pr ON pr.id = p.profesor_id
     WHERE h.ejemplar_id = $1 ORDER BY h.created_at DESC, h.id DESC`,
    [Number(params.id)]
  );
  return ok(items);
});
