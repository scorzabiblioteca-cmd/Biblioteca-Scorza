import { withAuth, ok } from "@/lib/http";
import { q1, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async () => {
  const r = await q1(pool, `
    SELECT (SELECT count(*)::int FROM libros WHERE estado = 'ACTIVO')  AS titulos,
           COALESCE(SUM(s.total), 0)::int       AS ejemplares,
           COALESCE(SUM(s.disponibles), 0)::int AS disponibles,
           COALESCE(SUM(s.prestados), 0)::int   AS prestados,
           COALESCE(SUM(s.danados), 0)::int     AS danados,
           COALESCE(SUM(s.perdidos), 0)::int    AS perdidos,
           (SELECT count(*)::int FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
             WHERE pd.estado = 'PRESTADO' AND p.fecha_prevista_devolucion < (now() AT TIME ZONE 'America/Lima')::date) AS vencidos,
           (SELECT count(*)::int FROM alumnos WHERE estado = 'ACTIVO') AS alumnos
    FROM v_stock_libro s JOIN libros l ON l.id = s.libro_id WHERE l.estado = 'ACTIVO'`);
  return ok(r);
});
