import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";
import { EJEMPLAR_SELECT } from "@/lib/libros";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const codigo = decodeURIComponent(params.codigo).trim().toUpperCase();
  const e = await q1<{ id: number; estado: string }>(pool, `${EJEMPLAR_SELECT} WHERE e.codigo_interno = $1`, [codigo]);
  if (!e) throw new HttpError(404, "No existe un ejemplar con ese código", "EJEMPLAR_NO_ENCONTRADO");
  const ultimo = await q1(
    pool,
    `SELECT pd.id AS detalle_id, pd.estado, p.fecha_prestamo, p.fecha_prevista_devolucion, pd.fecha_devolucion,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
     FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
     WHERE pd.ejemplar_id = $1 ORDER BY pd.id DESC LIMIT 1`,
    [e.id]
  );
  const acciones: Record<string, string[]> = {
    DISPONIBLE: ["PRESTAR", "MARCAR_DANADO", "MARCAR_PERDIDO", "DAR_BAJA"],
    PRESTADO: ["DEVOLVER"],
    RESERVADO: ["PRESTAR", "MARCAR_DISPONIBLE"],
    DANADO: ["MARCAR_REPARACION", "MARCAR_DISPONIBLE", "DAR_BAJA"],
    PERDIDO: ["MARCAR_DISPONIBLE", "DAR_BAJA"],
    REPARACION: ["MARCAR_DISPONIBLE", "DAR_BAJA"],
    BAJA: [],
  };
  return ok({ ...e, ultimoPrestamo: ultimo, acciones: acciones[e.estado] ?? [] });
});
