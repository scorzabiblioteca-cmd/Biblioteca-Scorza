import { withAuth, ok, created, body, HttpError, page } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { devolucionSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { notificar } from "@/lib/notificaciones";

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
  const sp = req.nextUrl.searchParams;
  const termino = sp.get("q")?.trim();
  const params: unknown[] = [];
  const filtros = ["pd.estado IN ('DEVUELTO', 'PERDIDO')"];
  const add = (value: unknown) => (params.push(value), `$${params.length}`);
  if (termino) {
    const parametro = add(`%${termino}%`);
    filtros.push(`concat_ws(' ', l.titulo, e.codigo_interno, al.nombres, al.apellidos, pr.nombres, pr.apellidos,
      al.dni, pr.dni, pd.observaciones_devolucion) ILIKE ${parametro}`);
  }
  const resultado = sp.get("resultado");
  if (resultado) {
    if (!["BUENO", "DETERIORADO", "DANADO", "PERDIDO"].includes(resultado)) throw new HttpError(400, "Resultado de devolución no válido");
    filtros.push(`pd.resultado_devolucion = ${add(resultado)}`);
  }
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const validaFecha = (value: string | null, etiqueta: string) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new HttpError(400, `La fecha ${etiqueta} no es válida`);
    }
    return value;
  };
  const fechaDesde = validaFecha(desde, "desde");
  const fechaHasta = validaFecha(hasta, "hasta");
  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) throw new HttpError(400, "La fecha inicial debe ser anterior a la fecha final");
  if (fechaDesde) filtros.push(`pd.fecha_devolucion >= ${add(fechaDesde)}::date`);
  if (fechaHasta) filtros.push(`pd.fecha_devolucion < ${add(fechaHasta)}::date + 1`);
  const where = `WHERE ${filtros.join(" AND ")}`;
  const total = (await q1<{ n: number }>(pool, `SELECT count(*)::int AS n ${HISTORIAL_FROM} ${where}`, params))!.n;
  const items = await q(
    pool,
    `SELECT pd.id, pd.fecha_devolucion AS "fechaDevolucion", pd.resultado_devolucion AS resultado,
       pd.observaciones_devolucion AS observaciones, l.titulo, e.codigo_interno AS "codigoInterno",
       p.tipo_prestatario AS "tipoPrestatario", p.alumno_id AS "alumnoId", p.profesor_id AS "profesorId",
       COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
       COALESCE(al.nombres, pr.nombres) AS nombres, COALESCE(al.apellidos, pr.apellidos) AS apellidos,
       COALESCE(al.dni, pr.dni) AS dni, COALESCE(al.telefono, pr.telefono) AS telefono,
       COALESCE(al.correo, pr.correo) AS correo, COALESCE(al.estado, pr.estado) AS "estadoPrestatario",
       al.codigo_alumno AS "codigoAlumno", al.nivel_educativo AS "nivelEducativo", al.grado, al.seccion,
       al.fecha_registro AS "fechaRegistro", pr.area, pr.created_at AS "createdAt"
     ${HISTORIAL_FROM} ${where}
     ORDER BY pd.fecha_devolucion DESC, pd.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  return ok({ items, page: pageN, pageSize, total });
});

export const POST = withAuth(["BIBLIOTECARIO"], async (req, { session }) => {
  const d = await body(req, devolucionSchema);
  const detalleIds = d.prestamoDetalleIds
    ?? (d.prestamoDetalleId == null ? null : [d.prestamoDetalleId]);
  if (d.codigoEjemplar && detalleIds) {
    throw new HttpError(400, "Indica codigoEjemplar o identificadores de préstamo, no ambos");
  }
  if (!d.codigoEjemplar && !detalleIds) {
    throw new HttpError(400, "Indica codigoEjemplar o prestamoDetalleId(s)");
  }
  if (detalleIds && new Set(detalleIds).size !== detalleIds.length) {
    throw new HttpError(400, "La lista contiene préstamos repetidos");
  }
  if (detalleIds && detalleIds.length > 1 && d.prestamoDetalleId != null) {
    throw new HttpError(400, "Usa solo prestamoDetalleIds para devolver varias unidades");
  }

  const r = await tx(async (c) => {
    type DetalleDevolucion = {
      id: number;
      prestamoId: number;
      ejemplarId: number | null;
      existenciaId: number | null;
      estado: string;
      libroId: number;
    };
    const detalles = d.codigoEjemplar
      ? await q<DetalleDevolucion>(
          c,
          `SELECT pd.id, pd.prestamo_id, pd.ejemplar_id, pd.existencia_id, pd.estado,
                  COALESCE(e.libro_id, x.libro_id) AS libro_id
             FROM prestamo_detalles pd
             JOIN ejemplares e ON e.id = pd.ejemplar_id
             JOIN prestamos p ON p.id = pd.prestamo_id AND p.estado = 'ACTIVO'
             LEFT JOIN existencias x ON x.id = pd.existencia_id
            WHERE e.codigo_interno = $1 AND pd.estado = 'PRESTADO'
            FOR UPDATE OF pd`,
          [d.codigoEjemplar.toUpperCase()]
        )
      : await q<DetalleDevolucion>(
          c,
          `SELECT pd.id, pd.prestamo_id, pd.ejemplar_id, pd.existencia_id, pd.estado,
                  COALESCE(e.libro_id, x.libro_id) AS libro_id
             FROM prestamo_detalles pd
             JOIN prestamos p ON p.id = pd.prestamo_id AND p.estado = 'ACTIVO'
             LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
             LEFT JOIN existencias x ON x.id = pd.existencia_id
            WHERE pd.id = ANY($1::bigint[])
            ORDER BY pd.id
            FOR UPDATE OF pd`,
          [detalleIds]
        );

    if (detalles.length === 0) {
      throw new HttpError(404, "No hay un préstamo activo para ese ejemplar", "SIN_PRESTAMO_ACTIVO");
    }
    if (detalleIds && detalles.length !== detalleIds.length) {
      throw new HttpError(404, "Uno o más préstamos ya no están activos", "SIN_PRESTAMO_ACTIVO");
    }
    if (detalles.some((det) => det.estado !== "PRESTADO")) {
      throw new HttpError(409, "Uno o más ejemplares ya fueron devueltos", "YA_DEVUELTO");
    }
    if (new Set(detalles.map((det) => det.libroId)).size !== 1) {
      throw new HttpError(400, "Solo se pueden devolver juntos ejemplares del mismo libro");
    }

    const resultados = [];
    for (const det of detalles) {
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

      const resumenLibro = await q1<{ titulo: string; codigo: string; prestatario: string }>(
        c,
        `SELECT l.titulo, COALESCE(e.codigo_interno, 'Por cantidad') AS codigo,
                COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
         FROM prestamo_detalles pd
         JOIN prestamos p ON p.id = pd.prestamo_id
         LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
         LEFT JOIN existencias x ON x.id = pd.existencia_id
         JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
         LEFT JOIN alumnos al ON al.id = p.alumno_id
         LEFT JOIN profesores pr ON pr.id = p.profesor_id
         WHERE pd.id = $1`,
        [det.id]
      );
      await notificar(c, {
        tipo: "DEVOLUCION",
        titulo: "Devolución registrada",
        mensaje: `${resumenLibro!.titulo} (${resumenLibro!.codigo}) devuelto por ${resumenLibro!.prestatario}. Resultado: ${d.resultado}.`,
        enlace: "/devoluciones",
      });
      if (perdido || d.resultado === "DANADO") {
        await notificar(c, {
          tipo: "INVENTARIO",
          titulo: "Cambio en el inventario",
          mensaje: `${resumenLibro!.titulo} (${resumenLibro!.codigo}) fue marcado como ${perdido ? "perdido" : "dañado"}.`,
          enlace: "/libros",
        });
      }
      const quedan = (await q1<{ n: number }>(
        c, "SELECT count(*)::int AS n FROM prestamo_detalles WHERE prestamo_id=$1 AND estado='PRESTADO'",
        [det.prestamoId]
      ))!.n;
      if (quedan === 0) await c.query("UPDATE prestamos SET estado='CERRADO', fecha_cierre=now() WHERE id=$1", [det.prestamoId]);
      await audit(c, session, "DEVOLUCION", "prestamo_detalles", det.id, { estado: "PRESTADO" }, { resultado: d.resultado }, req);
      resultados.push({
        detalleId: det.id,
        prestamoId: det.prestamoId,
        prestamoCerrado: quedan === 0,
        resultado: d.resultado,
      });
    }

    return resultados.length === 1 ? resultados[0] : { cantidad: resultados.length, devoluciones: resultados };
  });
  const cantidad = "cantidad" in r ? r.cantidad : 1;
  return created(r, cantidad === 1
    ? "Devolución registrada correctamente"
    : `${cantidad} devoluciones registradas correctamente`);
});
