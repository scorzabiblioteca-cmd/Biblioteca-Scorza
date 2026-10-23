import { NextRequest } from "next/server";
import { q, q1, pool } from "@/lib/db";
import { HttpError, ok, page, publicRoute } from "@/lib/http";
import { norm } from "@/lib/sql";

type LibroPublico = {
  id: number;
  titulo: string;
  isbn: string | null;
  imagenUrl: string | null;
  categoria: string | null;
  autores: string | null;
  disponibles: number;
};

export const GET = publicRoute(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const { page: pageNumber, pageSize, offset } = page(req);
  const texto = sp.get("q")?.trim() ?? "";
  if (texto.length > 100) throw new HttpError(400, "La búsqueda no puede superar 100 caracteres");

  const where = ["l.estado = 'ACTIVO'", "s.total > 0"];
  const params: unknown[] = [];
  const add = (value: unknown) => (params.push(value), `$${params.length}`);

  if (texto) {
    const param = add(texto);
    where.push(`(
      ${norm("l.titulo")} LIKE '%' || ${norm(param)} || '%'
      OR ${norm("COALESCE(ca.nombre, '')")} LIKE '%' || ${norm(param)} || '%'
      OR EXISTS (
        SELECT 1 FROM libros_autores la
        JOIN autores a ON a.id = la.autor_id
        WHERE la.libro_id = l.id AND ${norm("a.nombre")} LIKE '%' || ${norm(param)} || '%'
      )
    )`);
  }
  const clause = `WHERE ${where.join(" AND ")}`;
  const joins = `
    FROM libros l
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    JOIN v_stock_libro s ON s.libro_id = l.id`;
  const total = (await q1<{ total: number }>(
    pool,
    `SELECT count(*)::int AS total ${joins} ${clause}`,
    params,
  ))!.total;
  const items = await q<LibroPublico>(
    pool,
    `SELECT l.id, l.titulo, l.isbn, l.imagen_url, ca.nombre AS categoria,
      (SELECT string_agg(a.nombre, ', ' ORDER BY la.orden)
       FROM libros_autores la JOIN autores a ON a.id = la.autor_id
       WHERE la.libro_id = l.id) AS autores,
      s.disponibles
     ${joins} ${clause}
     ORDER BY l.titulo
     LIMIT ${add(pageSize)} OFFSET ${add(offset)}`,
    params,
  );

  return ok({ items, page: pageNumber, pageSize, total });
});
