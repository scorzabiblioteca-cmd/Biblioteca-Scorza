import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { libroSchema } from "@/lib/validators";
import { normalizarIsbn } from "@/lib/isbn";
import { LIBRO_SELECT, getOrCreate, setAutores, agregarUnidades } from "@/lib/libros";
import { audit } from "@/lib/audit";
import { notificar } from "@/lib/notificaciones";
import { UBIC_TXT } from "@/lib/sql";
import { z } from "zod";
import type { PoolClient } from "pg";

const R = ["BIBLIOTECARIO"];

export const GET = withAuth(R, async (_req, { params }) => {
  const id = Number(params.id);
  const libro = await q1(pool, `${LIBRO_SELECT} WHERE l.id = $1`, [id]);
  if (!libro) throw new HttpError(404, "Libro no encontrado");
  const ubicacionInventario = await q1<{
    ubicacionInventario: number | null;
    ubicacionesMultiples: boolean;
    tieneInventario: boolean;
  }>(
    pool,
    `SELECT CASE WHEN count(DISTINCT COALESCE(ubicacion_id, 0)) = 1 THEN min(ubicacion_id) END AS ubicacion_inventario,
            count(DISTINCT COALESCE(ubicacion_id, 0)) > 1 AS ubicaciones_multiples,
            count(*) > 0 AS tiene_inventario
     FROM (
       SELECT ubicacion_id FROM ejemplares WHERE libro_id = $1
       UNION ALL
       SELECT ubicacion_id FROM existencias WHERE libro_id = $1
     ) ubicaciones`,
    [id]
  );
  const ejemplares = await q(
    pool,
    `SELECT e.id, e.codigo_interno, e.estado, e.condicion, e.ubicacion_id, ${UBIC_TXT} AS ubicacion
     FROM ejemplares e LEFT JOIN ubicaciones u ON u.id = e.ubicacion_id WHERE e.libro_id = $1 ORDER BY e.codigo_interno`,
    [id]
  );
  const existencias = await q(
    pool,
    `SELECT x.id, x.ubicacion_id, x.cantidad_total, x.cantidad_danada, x.cantidad_perdida, x.cantidad_baja, ${UBIC_TXT} AS ubicacion
     FROM existencias x LEFT JOIN ubicaciones u ON u.id = x.ubicacion_id WHERE x.libro_id = $1`,
    [id]
  );
  return ok({ ...libro, ...ubicacionInventario, ejemplares, existencias });
});

const ubicacionEdicionSchema = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : value === null || value === 0 || value === "0" ? null : Number(value),
  z.number().int().positive().nullable().optional()
);
const editSchema = libroSchema.omit({ cantidad: true, ubicacionId: true, condicion: true, tipoControl: true, prefijoCodigo: true })
  .extend({
    ubicacionId: ubicacionEdicionSchema,
    cantidad: z.preprocess(
      (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
      z.number().int().min(1).max(100000).optional()
    ),
  });

async function ajustarCantidad(
  c: PoolClient,
  libro: { id: number; tipoControl: string; prefijoCodigo: string },
  anterior: number,
  objetivo: number,
  ubicacionId: number | null | undefined,
  usuarioId: number
) {
  const diferencia = objetivo - anterior;
  if (diferencia === 0) return;
  if (diferencia > 0) {
    if (libro.tipoControl === "INDIVIDUAL" && diferencia > 500) {
      throw new HttpError(400, "Se pueden agregar hasta 500 ejemplares individuales por operación");
    }
    let ubicacion = ubicacionId;
    if (ubicacion === undefined) {
      const tabla = libro.tipoControl === "INDIVIDUAL" ? "ejemplares" : "existencias";
      const existente = await q1<{ ubicacionId: number | null }>(
        c,
        `SELECT ubicacion_id AS "ubicacionId" FROM ${tabla} WHERE libro_id = $1 ORDER BY id LIMIT 1`,
        [libro.id]
      );
      ubicacion = existente?.ubicacionId ?? null;
    }
    await agregarUnidades(c, libro, diferencia, ubicacion, "BUENO", usuarioId);
    return;
  }

  const reducir = -diferencia;
  if (libro.tipoControl === "INDIVIDUAL") {
    const ejemplares = await q<{ id: number; ubicacionId: number | null }>(
      c,
      `SELECT id, ubicacion_id AS "ubicacionId" FROM ejemplares
       WHERE libro_id = $1 AND estado = 'DISPONIBLE'
       ORDER BY id DESC LIMIT $2 FOR UPDATE`,
      [libro.id, reducir]
    );
    if (ejemplares.length !== reducir) {
      throw new HttpError(409, "El inventario cambió mientras se editaba. Actualiza el libro e inténtalo otra vez.",
        "INVENTARIO_CAMBIADO");
    }
    const ids = ejemplares.map((item) => item.id);
    await c.query(
      "UPDATE ejemplares SET estado = 'BAJA', fecha_baja = CURRENT_DATE, updated_at = now() WHERE id = ANY($1::bigint[])",
      [ids]
    );
    await c.query(
      `INSERT INTO historial_ejemplares
         (ejemplar_id, tipo_evento, estado_anterior, estado_nuevo, ubicacion_anterior_id, usuario_id, detalle)
       SELECT movido.id, 'BAJA', 'DISPONIBLE', 'BAJA', movido.ubicacion_id, $2,
              'Retiro por ajuste de cantidad desde edición del libro'
       FROM unnest($1::bigint[], $3::bigint[]) AS movido(id, ubicacion_id)`,
      [ids, usuarioId, ejemplares.map((item) => item.ubicacionId)]
    );
    return;
  }

  const existencias = await q<{
    id: number; total: number; danadas: number; perdidas: number; bajas: number;
  }>(
    c,
    `SELECT id, cantidad_total AS total, cantidad_danada AS danadas,
            cantidad_perdida AS perdidas, cantidad_baja AS bajas
     FROM existencias WHERE libro_id = $1 ORDER BY id FOR UPDATE`,
    [libro.id]
  );
  const prestadas = await q<{ existenciaId: number; cantidad: number }>(
    c,
    `SELECT existencia_id AS "existenciaId", count(*)::int AS cantidad
     FROM prestamo_detalles
     WHERE estado = 'PRESTADO' AND existencia_id = ANY($1::bigint[])
     GROUP BY existencia_id`,
    [existencias.map((existencia) => existencia.id)]
  );
  const prestamosPorExistencia = new Map(prestadas.map((item) => [item.existenciaId, item.cantidad]));
  const disponiblesActuales = existencias.reduce((total, existencia) => total
    + existencia.total - existencia.danadas - existencia.perdidas - existencia.bajas
    - (prestamosPorExistencia.get(existencia.id) ?? 0), 0);
  if (reducir > disponiblesActuales) {
    throw new HttpError(409,
      `No se puede reducir a ${objetivo}: solo hay ${disponiblesActuales} ejemplar(es) disponible(s) para retirar`,
      "CANTIDAD_INSUFICIENTE");
  }
  let restante = reducir;
  for (const existencia of existencias) {
    const disponible = existencia.total - existencia.danadas - existencia.perdidas
      - existencia.bajas - (prestamosPorExistencia.get(existencia.id) ?? 0);
    const retirar = Math.min(restante, Math.max(0, disponible));
    if (!retirar) continue;
    await c.query("UPDATE existencias SET cantidad_total = cantidad_total - $2, updated_at = now() WHERE id = $1",
      [existencia.id, retirar]);
    await c.query(
      `INSERT INTO movimientos_existencias (existencia_id, tipo_movimiento, cantidad, usuario_id, detalle)
       VALUES ($1, 'BAJA', $2, $3, 'Retiro por ajuste de cantidad desde edición del libro')`,
      [existencia.id, retirar, usuarioId]
    );
    restante -= retirar;
    if (restante === 0) break;
  }
  if (restante > 0) {
    throw new HttpError(409, "No hay suficientes unidades disponibles para aplicar la reducción",
      "CANTIDAD_INSUFICIENTE");
  }
}

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
    const libroInventario = await q1<{
      id: number; tipoControl: string; prefijoCodigo: string;
    }>(
      c,
      `SELECT id, tipo_control AS "tipoControl", prefijo_codigo AS "prefijoCodigo"
       FROM libros WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!libroInventario) throw new HttpError(404, "Libro no encontrado");
    if (d.ubicacionId !== undefined) {
      if (d.ubicacionId !== null) {
        const ubicacion = await q1<{ id: number }>(c, "SELECT id FROM ubicaciones WHERE id = $1 AND activo", [d.ubicacionId]);
        if (!ubicacion) throw new HttpError(400, "La ubicación seleccionada no está disponible", "UBICACION_INVALIDA");
      }
      const distribucion = await q1<{ ubicacionesMultiples: boolean; tieneInventario: boolean }>(
        c,
        `SELECT count(DISTINCT COALESCE(ubicacion_id, 0)) > 1 AS ubicaciones_multiples,
                count(*) > 0 AS tiene_inventario
         FROM (
           SELECT ubicacion_id FROM ejemplares WHERE libro_id = $1
           UNION ALL
           SELECT ubicacion_id FROM existencias WHERE libro_id = $1
         ) ubicaciones`,
        [id]
      );
      if (!distribucion?.tieneInventario && (d.cantidad === undefined || d.cantidad <= 0)) {
        throw new HttpError(409, "No hay inventario registrado al que asignar una ubicación", "SIN_INVENTARIO");
      }
      if (distribucion?.ubicacionesMultiples) {
        throw new HttpError(409, "Este libro tiene inventario en varias ubicaciones. Cambia sus ubicaciones desde el detalle del inventario para evitar mover copias incorrectamente.", "UBICACIONES_MULTIPLES");
      }
    }
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
    if (d.ubicacionId !== undefined) {
      const ejemplaresMovidos = await q<{ id: number; ubicacionAnteriorId: number | null }>(
        c,
        "SELECT id, ubicacion_id AS ubicacion_anterior_id FROM ejemplares WHERE libro_id = $1 AND ubicacion_id IS DISTINCT FROM $2",
        [id, d.ubicacionId]
      );
      await c.query(
        "UPDATE ejemplares SET ubicacion_id = $2, updated_at = now() WHERE libro_id = $1 AND ubicacion_id IS DISTINCT FROM $2",
        [id, d.ubicacionId]
      );
      if (ejemplaresMovidos.length) {
        await c.query(
          `INSERT INTO historial_ejemplares
             (ejemplar_id, tipo_evento, ubicacion_anterior_id, ubicacion_nueva_id, usuario_id, detalle)
           SELECT id, 'CAMBIO_UBICACION', ubicacion_anterior_id, $4, $2, 'Cambio de ubicación desde edición del libro'
           FROM unnest($1::bigint[], $3::bigint[]) AS movidos(id, ubicacion_anterior_id)`,
          [
            ejemplaresMovidos.map((ejemplar) => ejemplar.id),
            session.id,
            ejemplaresMovidos.map((ejemplar) => ejemplar.ubicacionAnteriorId),
            d.ubicacionId,
          ]
        );
      }
      const existenciasMovidas = await c.query(
        "UPDATE existencias SET ubicacion_id = $2, updated_at = now() WHERE libro_id = $1 AND ubicacion_id IS DISTINCT FROM $2",
        [id, d.ubicacionId]
      );
      if (ejemplaresMovidos.length || (existenciasMovidas.rowCount ?? 0) > 0) {
        await notificar(c, {
          tipo: "INVENTARIO",
          titulo: "Ubicación del inventario actualizada",
          mensaje: `Se actualizó la ubicación del inventario de "${d.titulo}".`,
          enlace: `/libros/${id}`,
        });
      }
    }
    if (d.cantidad !== undefined) {
      const stock = await q1<{ total: number }>(
        c,
        "SELECT total FROM v_stock_libro WHERE libro_id = $1",
        [id]
      );
      if (!stock) throw new HttpError(404, "No se encontró el inventario del libro");
      await ajustarCantidad(c, libroInventario, stock.total, d.cantidad,
        d.ubicacionId, session.id);
      if (d.cantidad !== stock.total) {
        await notificar(c, {
          tipo: "INVENTARIO",
          titulo: "Cantidad del inventario actualizada",
          mensaje: `El inventario de "${d.titulo}" pasó de ${stock.total} a ${d.cantidad} ejemplar(es).`,
          enlace: `/libros/${id}`,
        });
      }
    }
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
