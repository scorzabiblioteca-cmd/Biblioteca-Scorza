import { withAuth, ok } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";

const LIMA = "(now() AT TIME ZONE 'America/Lima')::date";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const raw = Number(req.nextUrl.searchParams.get("dias") ?? 30);
  const dias = [7, 30, 90].includes(raw) ? raw : 30;

  const [inventario, periodos, serie, actividad, masPrestados] = await Promise.all([
    q1(pool, `
      SELECT (SELECT count(*)::int FROM libros WHERE estado = 'ACTIVO')  AS titulos,
             COALESCE(SUM(s.total), 0)::int       AS ejemplares,
             COALESCE(SUM(s.disponibles), 0)::int AS disponibles,
             COALESCE(SUM(s.prestados), 0)::int   AS prestados,
             COALESCE(SUM(s.danados), 0)::int     AS danados,
             COALESCE(SUM(s.perdidos), 0)::int    AS perdidos,
             (SELECT count(*)::int FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
               WHERE pd.estado = 'PRESTADO' AND p.fecha_prevista_devolucion < ${LIMA}) AS vencidos,
             (SELECT count(*)::int FROM alumnos WHERE estado = 'ACTIVO') AS alumnos,
             (SELECT count(*)::int FROM profesores WHERE estado = 'ACTIVO') AS profesores
      FROM v_stock_libro s JOIN libros l ON l.id = s.libro_id WHERE l.estado = 'ACTIVO'`),
    q1(pool, `
      SELECT
        (SELECT count(*)::int FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
          WHERE p.estado <> 'ANULADO'
            AND (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date > ${LIMA} - $1::int) AS prestamos_periodo,
        (SELECT count(*)::int FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
          WHERE p.estado <> 'ANULADO'
            AND (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date > ${LIMA} - ($1::int * 2)
            AND (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date <= ${LIMA} - $1::int) AS prestamos_anterior,
        (SELECT count(*)::int FROM prestamo_detalles pd
          WHERE pd.fecha_devolucion IS NOT NULL
            AND (pd.fecha_devolucion AT TIME ZONE 'America/Lima')::date > ${LIMA} - $1::int) AS devoluciones_periodo,
        (SELECT count(*)::int FROM prestamo_detalles pd
          WHERE pd.fecha_devolucion IS NOT NULL
            AND (pd.fecha_devolucion AT TIME ZONE 'America/Lima')::date > ${LIMA} - ($1::int * 2)
            AND (pd.fecha_devolucion AT TIME ZONE 'America/Lima')::date <= ${LIMA} - $1::int) AS devoluciones_anterior
    `, [dias]),
    q<{ fecha: string; cantidad: number }>(pool, `
      WITH dias AS (
        SELECT generate_series(${LIMA} - ($1::int - 1), ${LIMA}, interval '1 day')::date AS dia
      )
      SELECT d.dia::text AS fecha, COALESCE(count(pd.id), 0)::int AS cantidad
      FROM dias d
      LEFT JOIN prestamos p
        ON (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date = d.dia
       AND p.estado <> 'ANULADO'
      LEFT JOIN prestamo_detalles pd ON pd.prestamo_id = p.id
      GROUP BY d.dia
      ORDER BY d.dia
    `, [dias]),
    q<{ dow: number; cantidad: number }>(pool, `
      SELECT EXTRACT(DOW FROM p.fecha_prestamo AT TIME ZONE 'America/Lima')::int AS dow,
             count(pd.id)::int AS cantidad
      FROM prestamos p
      JOIN prestamo_detalles pd ON pd.prestamo_id = p.id
      WHERE p.estado <> 'ANULADO'
        AND (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date > ${LIMA} - $1::int
      GROUP BY 1
    `, [dias]),
    q<{ titulo: string; vecesPrestado: number; categoria: string }>(pool, `
      SELECT l.titulo, count(*)::int AS veces_prestado,
             COALESCE(ca.nombre, 'Sin categoría') AS categoria
      FROM prestamo_detalles pd
      JOIN prestamos p ON p.id = pd.prestamo_id
      LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
      LEFT JOIN existencias x ON x.id = pd.existencia_id
      JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
      LEFT JOIN categorias ca ON ca.id = l.categoria_id
      WHERE p.estado <> 'ANULADO'
        AND (p.fecha_prestamo AT TIME ZONE 'America/Lima')::date > ${LIMA} - $1::int
      GROUP BY l.id, l.titulo, ca.nombre
      ORDER BY veces_prestado DESC, l.titulo
      LIMIT 8
    `, [dias]),
  ]);

  const actividadSemana = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    dow,
    cantidad: actividad.find((a) => a.dow === dow)?.cantidad ?? 0,
  }));

  return ok({
    ...inventario,
    ...periodos,
    dias,
    seriePrestamos: serie,
    actividadSemana,
    masPrestados,
  });
});
