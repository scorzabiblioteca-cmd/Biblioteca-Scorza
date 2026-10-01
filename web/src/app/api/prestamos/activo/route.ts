import { withAuth, ok } from "@/lib/http";
import { q, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const termino = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const patron = `%${termino}%`;
  const items = await q(
    pool,
    `SELECT pd.id AS "detalleId", e.codigo_interno AS "codigoInterno", l.titulo,
            l.isbn, p.fecha_prestamo AS "fechaPrestamo",
            p.fecha_prevista_devolucion AS "fechaPrevistaDevolucion",
            (p.fecha_prevista_devolucion < (now() AT TIME ZONE 'America/Lima')::date) AS vencido,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
            COALESCE(al.dni, pr.dni) AS dni, al.codigo_alumno AS "codigoAlumno"
       FROM prestamo_detalles pd
       JOIN prestamos p ON p.id = pd.prestamo_id
       LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
       LEFT JOIN existencias x ON x.id = pd.existencia_id
       JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
       LEFT JOIN alumnos al ON al.id = p.alumno_id
       LEFT JOIN profesores pr ON pr.id = p.profesor_id
      WHERE pd.estado = 'PRESTADO' AND p.estado = 'ACTIVO'
        AND ($1 = '' OR f_unaccent(lower(concat_ws(' ',
          al.nombres, al.apellidos, al.dni, al.codigo_alumno,
          pr.nombres, pr.apellidos, pr.dni,
          l.titulo, l.isbn, e.codigo_interno
        ))) LIKE f_unaccent(lower($2)))
      ORDER BY p.fecha_prevista_devolucion ASC, pd.id ASC
      LIMIT 50`,
    [termino, patron]
  );
  return ok({ items });
});