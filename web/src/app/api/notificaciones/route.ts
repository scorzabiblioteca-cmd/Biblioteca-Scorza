import { withAuth, ok, page } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import type { Session } from "@/lib/auth";

const HOY = "(now() AT TIME ZONE 'America/Lima')::date";

async function generarAvisosDevolucion(usuario: Session) {
  await pool.query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace, clave_unica)
     SELECT $1, alertas.tipo, alertas.titulo, alertas.mensaje, '/prestamos',
            alertas.tipo || ':' || alertas.detalle_id::text || ':' || alertas.fecha::text
     FROM (
       SELECT pd.id AS detalle_id, p.fecha_prevista_devolucion AS fecha,
              'VENCIDO'::text AS tipo,
              'Préstamo vencido'::text AS titulo,
              l.titulo || ' — ' || COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos, 'Prestatario') || ' debía devolverse el ' ||
                to_char(p.fecha_prevista_devolucion, 'DD/MM/YYYY') AS mensaje
       FROM prestamo_detalles pd
       JOIN prestamos p ON p.id = pd.prestamo_id
       LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
       LEFT JOIN existencias x ON x.id = pd.existencia_id
       JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
       LEFT JOIN alumnos al ON al.id = p.alumno_id
       LEFT JOIN profesores pr ON pr.id = p.profesor_id
       WHERE pd.estado = 'PRESTADO' AND p.fecha_prevista_devolucion < ${HOY}

       UNION ALL

       SELECT pd.id AS detalle_id, p.fecha_prevista_devolucion AS fecha,
              'POR_VENCER'::text AS tipo,
              'Préstamo próximo a vencer'::text AS titulo,
              l.titulo || ' — ' || COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos, 'Prestatario') || ' debe devolverse el ' ||
                to_char(p.fecha_prevista_devolucion, 'DD/MM/YYYY') AS mensaje
       FROM prestamo_detalles pd
       JOIN prestamos p ON p.id = pd.prestamo_id
       LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
       LEFT JOIN existencias x ON x.id = pd.existencia_id
       JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
       LEFT JOIN alumnos al ON al.id = p.alumno_id
       LEFT JOIN profesores pr ON pr.id = p.profesor_id
       WHERE pd.estado = 'PRESTADO'
         AND p.fecha_prevista_devolucion BETWEEN ${HOY} AND ${HOY} + 2
     ) alertas
     ON CONFLICT (usuario_id, clave_unica) DO NOTHING`,
    [usuario.id]
  );
}

export const GET = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  await generarAvisosDevolucion(session);
  const { page: pageNumber, pageSize, offset } = page(req);
  const total = (await q1<{ total: number }>(
    pool,
    "SELECT count(*)::int AS total FROM notificaciones WHERE usuario_id = $1",
    [session.id]
  ))!.total;
  const noLeidas = (await q1<{ total: number }>(
    pool,
    "SELECT count(*)::int AS total FROM notificaciones WHERE usuario_id = $1 AND leida_en IS NULL",
    [session.id]
  ))!.total;
  const items = await q(
    pool,
    `SELECT id, tipo, titulo, mensaje, enlace, leida_en, created_at
     FROM notificaciones WHERE usuario_id = $1
     ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [session.id, pageSize, offset]
  );
  return ok({ items, page: pageNumber, pageSize, total, noLeidas });
});
