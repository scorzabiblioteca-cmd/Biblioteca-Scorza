import { withAuth, ok } from "@/lib/http";
import { q, pool } from "@/lib/db";

const LIMA = "(now() AT TIME ZONE 'America/Lima')::date";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const raw = Number(req.nextUrl.searchParams.get("dias") ?? 30);
  const dias = [7, 30, 90].includes(raw) ? raw : 30;

  const masPrestados = await q<{ titulo: string; vecesPrestado: number; categoria: string }>(pool, `
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
    LIMIT 10
  `, [dias]);

  return ok({ dias, masPrestados });
});
