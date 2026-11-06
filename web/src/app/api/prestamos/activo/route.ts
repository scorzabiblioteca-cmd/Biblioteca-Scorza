import { withAuth, ok } from "@/lib/http";
import { q, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const sp = req.nextUrl.searchParams;
  const termino = sp.get("q")?.trim() ?? "";
  const incluirInactivos = sp.get("incluirInactivos") === "true";
  const patron = `%${termino}%`;
  const items = await q(
    pool,
    `SELECT pd.id AS "detalleId", pd.estado AS "estadoDetalle",
            p.id AS "prestamoId", COALESCE(e.libro_id, x.libro_id) AS "libroId",
            p.tipo_prestatario AS "tipoPrestatario", p.alumno_id AS "alumnoId", p.profesor_id AS "profesorId",
            (pd.estado = 'PRESTADO' AND p.estado = 'ACTIVO') AS activo,
            e.codigo_interno AS "codigoInterno", l.titulo,
            l.isbn, p.fecha_prestamo AS "fechaPrestamo",
            p.fecha_prevista_devolucion AS "fechaPrevistaDevolucion",
            (p.fecha_prevista_devolucion < (now() AT TIME ZONE 'America/Lima')::date) AS vencido,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
            COALESCE(al.nombres, pr.nombres) AS nombres, COALESCE(al.apellidos, pr.apellidos) AS apellidos,
            COALESCE(al.dni, pr.dni) AS dni, COALESCE(al.telefono, pr.telefono) AS telefono,
            COALESCE(al.correo, pr.correo) AS correo, COALESCE(al.estado, pr.estado) AS "estadoPrestatario",
            al.codigo_alumno AS "codigoAlumno", al.nivel_educativo AS "nivelEducativo", al.grado, al.seccion,
            al.fecha_registro AS "fechaRegistro", pr.area, pr.created_at AS "createdAt"
       FROM prestamo_detalles pd
       JOIN prestamos p ON p.id = pd.prestamo_id
       LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
       LEFT JOIN existencias x ON x.id = pd.existencia_id
       JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
       LEFT JOIN alumnos al ON al.id = p.alumno_id
       LEFT JOIN profesores pr ON pr.id = p.profesor_id
      WHERE ($3::boolean OR (pd.estado = 'PRESTADO' AND p.estado = 'ACTIVO'))
        AND ($1 = '' OR f_unaccent(lower(concat_ws(' ',
          al.nombres, al.apellidos, al.dni, al.codigo_alumno,
          pr.nombres, pr.apellidos, pr.dni,
          l.titulo, l.isbn, e.codigo_interno
        ))) LIKE f_unaccent(lower($2)))
      ORDER BY (pd.estado = 'PRESTADO' AND p.estado = 'ACTIVO') DESC,
               p.fecha_prevista_devolucion ASC, pd.id ASC
      LIMIT 50`,
    [termino, patron, incluirInactivos]
  );
  return ok({ items });
});