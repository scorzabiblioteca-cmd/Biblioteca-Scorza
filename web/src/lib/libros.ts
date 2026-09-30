import { PoolClient } from "pg";
import { q, q1, Db } from "./db";
import { UBIC_TXT } from "./sql";

/** SELECT común de libros con stock calculado. Agrega WHERE/ORDER por fuera. */
export const LIBRO_SELECT = `
SELECT l.id, l.isbn, l.titulo, l.subtitulo, l.anio_publicacion, l.edicion, l.idioma,
       l.nivel_educativo, l.grado_recomendado, l.descripcion, l.imagen_url, l.tipo_control,
       l.prefijo_codigo, l.estado, l.observaciones, l.editorial_id, l.categoria_id,
       ed.nombre AS editorial, ca.nombre AS categoria,
       (SELECT string_agg(a.nombre, ', ' ORDER BY la.orden)
          FROM libros_autores la JOIN autores a ON a.id = la.autor_id WHERE la.libro_id = l.id) AS autores,
       (SELECT string_agg(DISTINCT u.codigo, ', ')
          FROM (SELECT ubicacion_id FROM ejemplares WHERE libro_id = l.id
                UNION SELECT ubicacion_id FROM existencias WHERE libro_id = l.id) x
          JOIN ubicaciones u ON u.id = x.ubicacion_id) AS ubicaciones,
       s.total, s.disponibles, s.prestados, s.danados, s.perdidos
FROM libros l
LEFT JOIN editoriales ed ON ed.id = l.editorial_id
LEFT JOIN categorias  ca ON ca.id = l.categoria_id
JOIN v_stock_libro s ON s.libro_id = l.id`;

export async function getOrCreate(db: Db, tabla: "autores" | "editoriales" | "categorias", nombre: string) {
  const ex = await q1<{ id: number }>(
    db,
    `SELECT id FROM ${tabla} WHERE lower(nombre) = lower($1) ${tabla === "categorias" ? "AND padre_id IS NULL" : ""}`,
    [nombre]
  );
  if (ex) return ex.id;
  const r = await q1<{ id: number }>(db, `INSERT INTO ${tabla} (nombre) VALUES ($1) RETURNING id`, [nombre]);
  return r!.id;
}

export async function setAutores(db: Db, libroId: number, autorTxt: string | null) {
  await db.query("DELETE FROM libros_autores WHERE libro_id = $1", [libroId]);
  if (!autorTxt) return;
  const nombres = [...new Set(autorTxt.split(/[;,]/).map((s) => s.trim()).filter(Boolean))];
  let orden = 1;
  for (const n of nombres) {
    const id = await getOrCreate(db, "autores", n);
    await db.query("INSERT INTO libros_autores (libro_id, autor_id, orden) VALUES ($1,$2,$3)", [libroId, id, orden++]);
  }
}

/** Agrega N unidades a un libro. INDIVIDUAL → filas en ejemplares; CANTIDAD → suma en existencias. */
export async function agregarUnidades(
  c: PoolClient,
  libro: { id: number; tipoControl: string; prefijoCodigo: string },
  n: number,
  ubicacionId: number | null,
  condicion: string,
  userId: number
) {
  if (n <= 0) return { codigos: [] as string[] };
  if (libro.tipoControl === "INDIVIDUAL") {
    if (n > 500) throw new Error("Máximo 500 ejemplares por operación");
    const rows = await q<{ id: number; codigoInterno: string }>(
      c,
      `INSERT INTO ejemplares (libro_id, codigo_interno, ubicacion_id, condicion, created_by, qr_generado_en)
       SELECT $1, generar_codigo_ejemplar($2), $3, $4, $5, now() FROM generate_series(1, $6::int)
       RETURNING id, codigo_interno`,
      [libro.id, libro.prefijoCodigo.trim(), ubicacionId, condicion, userId, n]
    );
    await c.query(
      `INSERT INTO historial_ejemplares (ejemplar_id, tipo_evento, estado_nuevo, condicion_nueva, ubicacion_nueva_id, usuario_id, detalle)
       SELECT id, 'REGISTRADO', 'DISPONIBLE', $2, $3, $4, 'Registro inicial' FROM ejemplares WHERE id = ANY($1::bigint[])`,
      [rows.map((r) => r.id), condicion, ubicacionId, userId]
    );
    return { codigos: rows.map((r) => r.codigoInterno) };
  }
  const ex = await q1<{ id: number }>(
    c,
    `INSERT INTO existencias (libro_id, ubicacion_id, cantidad_total) VALUES ($1,$2,$3)
     ON CONFLICT (libro_id, COALESCE(ubicacion_id, 0))
     DO UPDATE SET cantidad_total = existencias.cantidad_total + EXCLUDED.cantidad_total
     RETURNING id`,
    [libro.id, ubicacionId, n]
  );
  await c.query(
    `INSERT INTO movimientos_existencias (existencia_id, tipo_movimiento, cantidad, usuario_id, detalle)
     VALUES ($1,'INGRESO',$2,$3,'Ingreso de unidades')`,
    [ex!.id, n, userId]
  );
  return { codigos: [] as string[] };
}

export const EJEMPLAR_SELECT = `
SELECT e.id, e.codigo_interno, e.libro_id, e.estado, e.condicion, e.ubicacion_id, e.fecha_ingreso,
       e.observaciones, e.qr_generado_en,
       l.titulo, l.isbn, l.imagen_url, l.prefijo_codigo,
       (SELECT ca.nombre FROM categorias ca WHERE ca.id = l.categoria_id) AS categoria,
       ${UBIC_TXT} AS ubicacion
FROM ejemplares e
JOIN libros l ON l.id = e.libro_id
LEFT JOIN ubicaciones u ON u.id = e.ubicacion_id`;
