import { withAuth, ok, created, body, HttpError, page } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { devolucionSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

const HISTORIAL_FROM = `
  FROM prestamo_detalles pd
  JOIN prestamos p ON p.id = pd.prestamo_id
  LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
  LEFT JOIN existencias x ON x.id = pd.existencia_id
  JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
  LEFT JOIN alumnos al ON al.id = p.alumno_id
  LEFT JOIN profesores pr ON pr.id = p.profesor_id`;

export const GET = withAuth(["BIBLIOTECARIO"], async (req) => {
  const { page: pageN, pageSize, offset } = page(req);
  const termino = req.nextUrl.searchParams.get("q")?.trim();
  const params: unknown[] = [];
  const filtros = ["pd.estado IN ('DEVUELTO', 'PERDIDO')"];
  if (termino) {
    params.push(`%${termino}%`);
    filtros.push(`concat_ws(' ', l.titulo, e.codigo_interno, al.nombres, al.apellidos, pr.nombres, pr.apellidos,
      al.dni, pr.dni, pd.observaciones_devolucion) ILIKE $1`);
  }
  const where = `WHERE ${filtros.join(" AND ")}`;
  const total = (await q1<{ n: number }>(pool, `SELECT count(*)::int AS n ${HISTORIAL_FROM} ${where}`, params))!.n;
  const items = await q(
    pool,
    `SELECT pd.id, pd.fecha_devolucion AS "fechaDevolucion", pd.resultado_devolucion AS resultado,
       pd.observaciones_devolucion AS observaciones, l.titulo, e.codigo_interno AS "codigoInterno",
       COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
     ${HISTORIAL_FROM} ${where}
     ORDER BY pd.fecha_devolucion DESC, pd.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  return ok({ items, page: pageN, pageSize, total });
});

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const d = await body(req, devolucionSchema);
  if (!d.codigoEjemplar && !d.prestamoDetalleId) throw new HttpError(400, "Indica codigoEjemplar o prestamoDetalleId");
  const r = await tx(async (c) => {
    const det = await q1<{ id: number; prestamoId: number; ejemplarId: number | null; existenciaId: number | null; estado: string }>(
      c,
      d.codigoEjemplar
        ? `SELECT pd.* FROM prestamo_detalles pd JOIN ejemplares e ON e.id = pd.ejemplar_id
           WHERE e.codigo_interno = $1 AND pd.estado = 'PRESTADO' FOR UPDATE OF pd`
        : `SELECT * FROM prestamo_detalles WHERE id = $1 FOR UPDATE`,
      [d.codigoEjemplar ? d.codigoEjemplar.toUpperCase() : d.prestamoDetalleId]
    );
    if (!det) throw new HttpError(404, "No hay un préstamo activo para ese ejemplar", "SIN_PRESTAMO_ACTIVO");
    if (det.estado !== "PRESTADO") throw new HttpError(409, "Esa unidad ya fue devuelta", "YA_DEVUELTO");

    const perdido = d.resultado === "PERDIDO";
    await c.query(
      `UPDATE prestamo_detalles SET estado=$2, fecha_devolucion=now(), resultado_devolucion=$3,
         usuario_devolucion_id=$4, observaciones_devolucion=$5 WHERE id=$1`,
      [det.id, perdido ? "PERDIDO" : "DEVUELTO", d.resultado, session.id, d.observaciones]
    );

    if (det.ejemplarId) {
      const nuevoEstado = d.resultado === "DANADO" ? "DANADO" : perdido ? "PERDIDO" : "DISPONIBLE";
      const cond = await q1<{ condicion: string }>(c, "SELECT condicion FROM ejemplares WHERE id = $1 FOR UPDATE", [det.ejemplarId]);
      const nuevaCond = d.resultado === "DETERIORADO" || d.resultado === "DANADO" ? "DETERIORADO" : cond!.condicion;
      await c.query("UPDATE ejemplares SET estado=$2, condicion=$3 WHERE id=$1", [det.ejemplarId, nuevoEstado, nuevaCond]);
      await c.query(
        `INSERT INTO historial_ejemplares (ejemplar_id, tipo_evento, estado_anterior, estado_nuevo, condicion_anterior, condicion_nueva,
           prestamo_detalle_id, usuario_id, detalle)
         VALUES ($1,'DEVUELTO','PRESTADO',$2,$3,$4,$5,$6,$7)`,
        [det.ejemplarId, nuevoEstado, cond!.condicion, nuevaCond, det.id, session.id, `Resultado: ${d.resultado}. ${d.observaciones ?? ""}`.trim()]
      );
      if (nuevoEstado !== "DISPONIBLE") {
        await audit(c, session, "CAMBIO_ESTADO_EJEMPLAR", "ejemplares", det.ejemplarId, { estado: "PRESTADO" }, { estado: nuevoEstado }, req);
      }
    } else if (det.existenciaId) {
      if (d.resultado === "DANADO") await c.query("UPDATE existencias SET cantidad_danada = cantidad_danada + 1 WHERE id = $1", [det.existenciaId]);
      if (perdido) await c.query("UPDATE existencias SET cantidad_perdida = cantidad_perdida + 1 WHERE id = $1", [det.existenciaId]);
      const tipo = d.resultado === "DANADO" ? "MARCADO_DANADO" : perdido ? "MARCADO_PERDIDO" : "DEVOLUCION";
      await c.query(
        "INSERT INTO movimientos_existencias (existencia_id, tipo_movimiento, cantidad, prestamo_detalle_id, usuario_id, detalle) VALUES ($1,$2,1,$3,$4,$5)",
        [det.existenciaId, tipo, det.id, session.id, d.observaciones]
      );
    }
    const quedan = (await q1<{ n: number }>(c, "SELECT count(*)::int AS n FROM prestamo_detalles WHERE prestamo_id=$1 AND estado='PRESTADO'", [det.prestamoId]))!.n;
    if (quedan === 0) await c.query("UPDATE prestamos SET estado='CERRADO', fecha_cierre=now() WHERE id=$1", [det.prestamoId]);
    await audit(c, session, "DEVOLUCION", "prestamo_detalles", det.id, { estado: "PRESTADO" }, { resultado: d.resultado }, req);
    return { detalleId: det.id, prestamoId: det.prestamoId, prestamoCerrado: quedan === 0, resultado: d.resultado };
  });
  return created(r, "Devolución registrada correctamente");
});
