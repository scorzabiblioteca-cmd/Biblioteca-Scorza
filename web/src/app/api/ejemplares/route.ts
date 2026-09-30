import { withAuth, ok, page } from "@/lib/http";
import { q, q1, pool } from "@/lib/db";
import { EJEMPLAR_SELECT } from "@/lib/libros";
import { norm } from "@/lib/sql";

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page: p, pageSize, offset } = page(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  for (const [k, col] of [["estado", "e.estado"], ["condicion", "e.condicion"]] as const) {
    const v = sp.get(k);
    if (v) where.push(`${col} = ${add(v)}`);
  }
  if (sp.get("libroId")) where.push(`e.libro_id = ${add(Number(sp.get("libroId")))}`);
  if (sp.get("ubicacionId")) where.push(`e.ubicacion_id = ${add(Number(sp.get("ubicacionId")))}`);
  const t = sp.get("q")?.trim();
  if (t) {
    const n = add(t);
    where.push(`(e.codigo_interno ILIKE '%' || ${n} || '%' OR ${norm("l.titulo")} LIKE '%' || ${norm(n)} || '%'
                 OR l.isbn LIKE '%' || ${n} || '%'
                 OR EXISTS (SELECT 1 FROM categorias ca WHERE ca.id = l.categoria_id
                            AND ${norm("ca.nombre")} LIKE '%' || ${norm(n)} || '%'))`);
  }
  const W = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await q1<{ n: number }>(pool,
    `SELECT count(*)::int AS n FROM ejemplares e JOIN libros l ON l.id = e.libro_id ${W}`, params))!.n;
  const items = await q(pool, `${EJEMPLAR_SELECT} ${W} ORDER BY e.codigo_interno DESC LIMIT ${add(pageSize)} OFFSET ${add(offset)}`, params);
  return ok({ items, page: p, pageSize, total });
});
