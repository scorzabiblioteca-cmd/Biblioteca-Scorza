import { withAuth, ok, HttpError, page } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";

export const GET = withAuth(["BIBLIOTECARIO"], async (req, { params }) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Identificador de libro no válido");
  const libro = await q1<{ id: number }>(pool, "SELECT id FROM libros WHERE id = $1", [id]);
  if (!libro) throw new HttpError(404, "Libro no encontrado");

  const { page: pageNumber, pageSize, offset } = page(req);
  const total = (await q1<{ total: number }>(
    pool,
    `SELECT count(*)::int AS total
     FROM prestamo_detalles pd
     LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
     LEFT JOIN existencias x ON x.id = pd.existencia_id
     WHERE COALESCE(e.libro_id, x.libro_id) = $1`,
    [id]
  ))!.total;
  const items = await q(
    pool,
    `SELECT pd.id, pd.estado, pd.resultado_devolucion, pd.fecha_devolucion,
            p.id AS prestamo_id, p.tipo_prestatario, p.fecha_prestamo, p.fecha_prevista_devolucion,
            e.codigo_interno AS codigo_ejemplar,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
            us.username AS registrado_por, ud.username AS devuelto_por
     FROM prestamo_detalles pd
     JOIN prestamos p ON p.id = pd.prestamo_id
     LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id
     LEFT JOIN profesores pr ON pr.id = p.profesor_id
     JOIN usuarios us ON us.id = p.usuario_id
     LEFT JOIN usuarios ud ON ud.id = pd.usuario_devolucion_id
     LEFT JOIN existencias x ON x.id = pd.existencia_id
     WHERE COALESCE(e.libro_id, x.libro_id) = $1
     ORDER BY p.fecha_prestamo DESC, pd.id DESC
     LIMIT $2 OFFSET $3`,
    [id, pageSize, offset]
  );
  return ok({ items, page: pageNumber, pageSize, total });
});
