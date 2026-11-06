import { withAuth, ok, HttpError } from "@/lib/http";
import { q, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const libroId = Number(params.libroId);
  if (!Number.isSafeInteger(libroId) || libroId < 1) {
    throw new HttpError(400, "Identificador de libro no válido");
  }

  const items = await q(
    pool,
    `SELECT pd.id AS "detalleId", p.id AS "prestamoId", e.codigo_interno AS "codigoInterno",
            l.titulo, l.isbn, p.fecha_prestamo AS "fechaPrestamo",
            p.fecha_prevista_devolucion AS "fechaPrevistaDevolucion",
            (p.fecha_prevista_devolucion < (now() AT TIME ZONE 'America/Lima')::date) AS vencido,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
       FROM prestamo_detalles pd
       JOIN prestamos p ON p.id = pd.prestamo_id
       LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
       LEFT JOIN existencias x ON x.id = pd.existencia_id
       JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
       LEFT JOIN alumnos al ON al.id = p.alumno_id
       LEFT JOIN profesores pr ON pr.id = p.profesor_id
      WHERE l.id = $1 AND pd.estado = 'PRESTADO' AND p.estado = 'ACTIVO'
      ORDER BY p.fecha_prevista_devolucion ASC, pd.id ASC`,
    [libroId]
  );
  return ok({ items });
});
