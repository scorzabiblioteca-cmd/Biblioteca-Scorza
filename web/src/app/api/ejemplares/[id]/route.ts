import { withAuth, ok, body, HttpError } from "@/lib/http";
import { q1, tx, pool } from "@/lib/db";
import { EJEMPLAR_SELECT } from "@/lib/libros";
import { ejemplarPatchSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const GET = withAuth(["BIBLIOTECARIO"], async (_req, { params }) => {
  const e = await q1(pool, `${EJEMPLAR_SELECT} WHERE e.id = $1`, [Number(params.id)]);
  if (!e) throw new HttpError(404, "Ejemplar no encontrado");
  return ok(e);
});

/** Cambia estado, condición, ubicación u observaciones. Registra historial y auditoría. */
export const PATCH = withAuth(["BIBLIOTECARIO"], async (req, { params, session }) => {
  const id = Number(params.id);
  const d = await body(req, ejemplarPatchSchema);
  await tx(async (c) => {
    const a = await q1<{ estado: string; condicion: string; ubicacionId: number | null; observaciones: string | null; codigoInterno: string }>(
      c, "SELECT * FROM ejemplares WHERE id = $1 FOR UPDATE", [id]);
    if (!a) throw new HttpError(404, "Ejemplar no encontrado");
    if (d.estado && d.estado !== a.estado) {
      if (a.estado === "PRESTADO") throw new HttpError(409, "El ejemplar está prestado; regístralo desde Devoluciones", "EJEMPLAR_PRESTADO");
      if (d.estado === "PRESTADO") throw new HttpError(409, "Para prestar usa el módulo de Préstamos", "USAR_PRESTAMO");
      if (a.estado === "BAJA") throw new HttpError(409, "Un ejemplar dado de baja no puede reactivarse", "EJEMPLAR_BAJA");
    }
    const estado = d.estado ?? a.estado;
    const condicion = d.condicion ?? a.condicion;
    const ubic = d.ubicacionId !== undefined ? d.ubicacionId : a.ubicacionId;
    const obs = d.observaciones !== undefined ? d.observaciones : a.observaciones;
    await c.query(
      `UPDATE ejemplares SET estado=$2, condicion=$3, ubicacion_id=$4, observaciones=$5,
         fecha_baja = CASE WHEN $2 = 'BAJA' THEN COALESCE(fecha_baja, CURRENT_DATE) ELSE NULL END WHERE id=$1`,
      [id, estado, condicion, ubic, obs]
    );
    const ev = async (tipo: string, extra: Record<string, unknown>) =>
      c.query(
        `INSERT INTO historial_ejemplares (ejemplar_id, tipo_evento, estado_anterior, estado_nuevo, condicion_anterior,
           condicion_nueva, ubicacion_anterior_id, ubicacion_nueva_id, usuario_id, detalle)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, tipo, a.estado, estado, a.condicion, condicion, a.ubicacionId, ubic, session.id, extra.detalle ?? null]
      );
    if (estado !== a.estado) {
      await ev(estado === "BAJA" ? "BAJA" : "CAMBIO_ESTADO", { detalle: d.observaciones });
      await audit(c, session, "CAMBIO_ESTADO_EJEMPLAR", "ejemplares", id, { estado: a.estado, codigo: a.codigoInterno }, { estado }, req);
    }
    if (condicion !== a.condicion) await ev("CAMBIO_CONDICION", {});
    if (ubic !== a.ubicacionId) {
      await ev("CAMBIO_UBICACION", {});
      await audit(c, session, "CAMBIO_UBICACION_EJEMPLAR", "ejemplares", id, { ubicacionId: a.ubicacionId }, { ubicacionId: ubic }, req);
    }
  });
  return ok(await q1(pool, `${EJEMPLAR_SELECT} WHERE e.id = $1`, [id]), "Ejemplar actualizado correctamente");
});
