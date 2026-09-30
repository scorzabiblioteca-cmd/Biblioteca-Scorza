import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { libroSchema } from "@/lib/validators";
import { normalizarIsbn } from "@/lib/isbn";
import { LIBRO_SELECT, getOrCreate, setAutores } from "@/lib/libros";
import { audit } from "@/lib/audit";
import { UBIC_TXT } from "@/lib/sql";
import { z } from "zod";

const R = ["BIBLIOTECARIO"];

export const GET = withAuth(R, async (_req, { params }) => {
  const id = Number(params.id);
  const libro = await q1(pool, `${LIBRO_SELECT} WHERE l.id = $1`, [id]);
  if (!libro) throw new HttpError(404, "Libro no encontrado");
  const ejemplares = await q(
    pool,
    `SELECT e.id, e.codigo_interno, e.estado, e.condicion, ${UBIC_TXT} AS ubicacion
     FROM ejemplares e LEFT JOIN ubicaciones u ON u.id = e.ubicacion_id WHERE e.libro_id = $1 ORDER BY e.codigo_interno`,
    [id]
  );
  const existencias = await q(
    pool,
    `SELECT x.id, x.cantidad_total, x.cantidad_danada, x.cantidad_perdida, x.cantidad_baja, ${UBIC_TXT} AS ubicacion
     FROM existencias x LEFT JOIN ubicaciones u ON u.id = x.ubicacion_id WHERE x.libro_id = $1`,
    [id]
  );
  return ok({ ...libro, ejemplares, existencias });
});

const editSchema = libroSchema.omit({ cantidad: true, ubicacionId: true, condicion: true, tipoControl: true, prefijoCodigo: true });

export const PUT = withAuth(R, async (req, { params, session }) => {
  const id = Number(params.id);
  const d = await body(req, editSchema);
  const antes = await q1(pool, "SELECT * FROM libros WHERE id = $1", [id]);
  if (!antes) throw new HttpError(404, "Libro no encontrado");
  let isbn: string | null = null;
  if (d.isbn) {
    isbn = normalizarIsbn(d.isbn);
    if (!isbn) throw new HttpError(400, "El ISBN no es válido", "ISBN_INVALIDO");
    const dup = await q1(pool, "SELECT id FROM libros WHERE isbn = $1 AND id <> $2", [isbn, id]);
    if (dup) throw new HttpError(409, "El ISBN ya se encuentra registrado", "ISBN_DUPLICADO");
  }
  await tx(async (c) => {
    const editorialId = d.editorial ? await getOrCreate(c, "editoriales", d.editorial) : null;
    const categoriaId = d.categoria ? await getOrCreate(c, "categorias", d.categoria) : null;
    await c.query(
      `UPDATE libros SET isbn=$2, titulo=$3, subtitulo=$4, editorial_id=$5, anio_publicacion=$6, edicion=$7,
         categoria_id=$8, descripcion=$9, idioma=$10, nivel_educativo=$11, grado_recomendado=$12,
         imagen_url=COALESCE($13, imagen_url), observaciones=$14, updated_by=$15 WHERE id=$1`,
      [id, isbn, d.titulo, d.subtitulo, editorialId, d.anioPublicacion ?? null, d.edicion, categoriaId, d.descripcion,
       d.idioma, d.nivelEducativo ?? null, d.gradoRecomendado ?? null, d.imagenUrl ?? null, d.observaciones, session.id]
    );
    await setAutores(c, id, d.autor);
    await audit(c, session, "EDITAR_LIBRO", "libros", id, antes, { ...d, isbn }, req);
  });
  return ok(await q1(pool, `${LIBRO_SELECT} WHERE l.id = $1`, [id]), "Libro actualizado correctamente");
});

export const PATCH = withAuth(R, async (req, { params, session }) => {
  const id = Number(params.id);
  const { archivado } = await body(req, z.object({ archivado: z.boolean() }));
  const nuevo = archivado ? "ARCHIVADO" : "ACTIVO";
  const r = await q1(pool, "UPDATE libros SET estado = $2 WHERE id = $1 RETURNING id", [id, nuevo]);
  if (!r) throw new HttpError(404, "Libro no encontrado");
  await audit(pool, session, archivado ? "ARCHIVAR_LIBRO" : "RESTAURAR_LIBRO", "libros", id, null, { estado: nuevo }, req);
  return ok({ id, estado: nuevo }, archivado ? "Libro archivado" : "Libro restaurado");
});
