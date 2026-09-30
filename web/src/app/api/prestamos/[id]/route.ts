import { withAuth, ok, HttpError } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const id = Number(params.id);
  const p = await q1(pool,
    `SELECT p.*, COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario, us.username AS registrado_por
     FROM prestamos p JOIN usuarios us ON us.id = p.usuario_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id WHERE p.id = $1`, [id]);
  if (!p) throw new HttpError(404, "Préstamo no encontrado");
  const detalles = await q(pool,
    `SELECT pd.id, pd.estado, pd.resultado_devolucion, pd.fecha_devolucion, e.codigo_interno, COALESCE(l.titulo, l2.titulo) AS titulo
     FROM prestamo_detalles pd LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN libros l ON l.id = e.libro_id
     LEFT JOIN existencias x ON x.id = pd.existencia_id LEFT JOIN libros l2 ON l2.id = x.libro_id
     WHERE pd.prestamo_id = $1 ORDER BY pd.id`, [id]);
  return ok({ ...p, detalles });
});
