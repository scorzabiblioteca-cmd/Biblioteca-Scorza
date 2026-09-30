import { withAuth, ok, HttpError } from "@/lib/http";
import { q1, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const codigo = decodeURIComponent(params.codigo).trim().toUpperCase();
  const r = await q1(pool,
    `SELECT pd.id AS detalle_id, p.id AS prestamo_id, e.codigo_interno, l.titulo, l.isbn, l.imagen_url,
            p.fecha_prestamo, p.fecha_prevista_devolucion,
            (p.fecha_prevista_devolucion < (now() AT TIME ZONE 'America/Lima')::date) AS vencido,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
     FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
     JOIN ejemplares e ON e.id = pd.ejemplar_id JOIN libros l ON l.id = e.libro_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
     WHERE e.codigo_interno = $1 AND pd.estado = 'PRESTADO'`, [codigo]);
  if (!r) throw new HttpError(404, "Ese ejemplar no tiene un préstamo activo", "SIN_PRESTAMO_ACTIVO");
  return ok(r);
});
