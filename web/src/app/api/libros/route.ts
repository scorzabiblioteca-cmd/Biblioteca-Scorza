import { withAuth, ok, created, body, page, HttpError } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { libroSchema } from "@/lib/validators";
import { normalizarIsbn } from "@/lib/isbn";
import { LIBRO_SELECT, getOrCreate, setAutores, agregarUnidades } from "@/lib/libros";
import { audit } from "@/lib/audit";
import { norm } from "@/lib/sql";

const R = ["BIBLIOTECARIO"];

export const GET = withAuth(R, async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page: p, pageSize, offset } = page(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);

  const estado = sp.get("estado") ?? "ACTIVO";
  if (estado !== "todos") where.push(`l.estado = ${add(estado)}`);
  const tipo = sp.get("tipoControl");
  if (tipo) where.push(`l.tipo_control = ${add(tipo)}`);
  const cat = sp.get("categoriaId");
  if (cat) where.push(`l.categoria_id = ${add(Number(cat))}`);
  const edi = sp.get("editorialId");
  if (edi) where.push(`l.editorial_id = ${add(Number(edi))}`);
  const grado = sp.get("grado");
  if (grado) where.push(`l.grado_recomendado = ${add(Number(grado))}`);
  const anio = sp.get("anio");
  if (anio) where.push(`l.anio_publicacion = ${add(Number(anio))}`);
  const ubi = sp.get("ubicacionId");
  if (ubi) {
    const n = add(Number(ubi));
    where.push(`(EXISTS (SELECT 1 FROM ejemplares e WHERE e.libro_id = l.id AND e.ubicacion_id = ${n})
                 OR EXISTS (SELECT 1 FROM existencias x WHERE x.libro_id = l.id AND x.ubicacion_id = ${n}))`);
  }
  const disp = sp.get("disponibilidad");
  if (disp === "disponibles") where.push("s.disponibles > 0");
  if (disp === "prestados") where.push("s.prestados > 0");
  if (disp === "danados") where.push("s.danados > 0");
  if (disp === "perdidos") where.push("s.perdidos > 0");

  const qtxt = sp.get("q")?.trim();
  if (qtxt) {
    const n = add(qtxt);
    const like = (expr: string) => `${norm(expr)} LIKE '%' || ${norm(n)} || '%'`;
    where.push(`(${like("l.titulo")} OR ${like("COALESCE(l.subtitulo,'')")} OR l.isbn LIKE '%' || ${n} || '%'
      OR ${like("COALESCE(ed.nombre,'')")} OR ${like("COALESCE(ca.nombre,'')")}
      OR EXISTS (SELECT 1 FROM libros_autores la JOIN autores a ON a.id = la.autor_id
                 WHERE la.libro_id = l.id AND ${like("a.nombre")})
      OR EXISTS (SELECT 1 FROM ejemplares e WHERE e.libro_id = l.id AND e.codigo_interno ILIKE '%' || ${n} || '%')
      OR EXISTS (SELECT 1 FROM ejemplares e JOIN ubicaciones u ON u.id = e.ubicacion_id WHERE e.libro_id = l.id
                 AND (u.codigo ILIKE '%' || ${n} || '%' OR COALESCE(u.estante,'') ILIKE '%' || ${n} || '%'))
      OR ${like("l.nivel_educativo::text")})`);
  }
  const W = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await q1<{ n: number }>(
    pool,
    `SELECT count(*)::int AS n FROM libros l LEFT JOIN editoriales ed ON ed.id = l.editorial_id
     LEFT JOIN categorias ca ON ca.id = l.categoria_id JOIN v_stock_libro s ON s.libro_id = l.id ${W}`,
    params
  ))!.n;
  const items = await q(pool, `${LIBRO_SELECT} ${W} ORDER BY l.titulo LIMIT ${add(pageSize)} OFFSET ${add(offset)}`, params);
  return ok({ items, page: p, pageSize, total });
});

export const POST = withAuth(R, async (req, { session }) => {
  const d = await body(req, libroSchema);
  let isbn: string | null = null;
  if (d.isbn) {
    isbn = normalizarIsbn(d.isbn);
    if (!isbn) throw new HttpError(400, "El ISBN no es válido", "ISBN_INVALIDO", { isbn: ["ISBN no válido"] });
    const dup = await q1<{ id: number }>(pool, "SELECT id FROM libros WHERE isbn = $1", [isbn]);
    if (dup) throw new HttpError(409, "El ISBN ya se encuentra registrado", "ISBN_DUPLICADO");
  }
  const cantidad = d.cantidad ?? 1;
  const libroId = await tx(async (c) => {
    const editorialId = d.editorial ? await getOrCreate(c, "editoriales", d.editorial) : null;
    const categoriaId = d.categoria ? await getOrCreate(c, "categorias", d.categoria) : null;
    const l = (await q1<{ id: number }>(
      c,
      `INSERT INTO libros (isbn, titulo, subtitulo, editorial_id, anio_publicacion, edicion, categoria_id, descripcion,
         idioma, nivel_educativo, grado_recomendado, imagen_url, tipo_control, prefijo_codigo, observaciones, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`,
      [isbn, d.titulo, d.subtitulo, editorialId, d.anioPublicacion ?? null, d.edicion, categoriaId, d.descripcion,
       d.idioma, d.nivelEducativo ?? null, d.gradoRecomendado ?? null, d.imagenUrl ?? null, d.tipoControl,
       d.prefijoCodigo, d.observaciones, session.id]
    ))!;
    await setAutores(c, l.id, d.autor);
    await agregarUnidades(c, { id: l.id, tipoControl: d.tipoControl, prefijoCodigo: d.prefijoCodigo }, cantidad,
      d.ubicacionId ?? null, d.condicion, session.id);
    await audit(c, session, "CREAR_LIBRO", "libros", l.id, null, { isbn, titulo: d.titulo, tipo: d.tipoControl, cantidad }, req);
    return l.id;
  });
  const libro = await q1(pool, `${LIBRO_SELECT} WHERE l.id = $1`, [libroId]);
  return created(libro, "Libro registrado correctamente");
});
