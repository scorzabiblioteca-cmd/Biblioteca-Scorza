import { withAuth, ok, created, body, page, HttpError } from "@/lib/http";
import { q, q1, tx, pool } from "@/lib/db";
import { prestamoSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

const R = ["BIBLIOTECARIO"];
const LIMA_HOY = "(now() AT TIME ZONE 'America/Lima')::date";

export const GET = withAuth(R, async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page: p, pageSize, offset } = page(req);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (sp.get("estado")) where.push(`p.estado = ${add(sp.get("estado"))}`);
  if (sp.get("vencidos") === "true") where.push(`p.estado = 'ACTIVO' AND p.fecha_prevista_devolucion < ${LIMA_HOY}`);
  if (sp.get("alumnoId")) where.push(`p.alumno_id = ${add(Number(sp.get("alumnoId")))}`);
  if (sp.get("desde")) where.push(`p.fecha_prestamo >= ${add(sp.get("desde"))}::date`);
  if (sp.get("hasta")) where.push(`p.fecha_prestamo < ${add(sp.get("hasta"))}::date + 1`);
  const W = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await q1<{ n: number }>(pool, `SELECT count(*)::int AS n FROM prestamos p ${W}`, params))!.n;
  const items = await q(
    pool,
    `SELECT p.id, p.estado, p.tipo_prestatario, p.fecha_prestamo, p.fecha_prevista_devolucion, p.fecha_cierre,
            (p.estado = 'ACTIVO' AND p.fecha_prevista_devolucion < ${LIMA_HOY}) AS vencido,
            COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
            us.username AS registrado_por,
            (SELECT string_agg(COALESCE(e.codigo_interno, l2.titulo) || ' — ' || COALESCE(l.titulo, l2.titulo), '; ')
               FROM prestamo_detalles pd
               LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN libros l ON l.id = e.libro_id
               LEFT JOIN existencias x ON x.id = pd.existencia_id LEFT JOIN libros l2 ON l2.id = x.libro_id
              WHERE pd.prestamo_id = p.id) AS items
     FROM prestamos p JOIN usuarios us ON us.id = p.usuario_id
     LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
     ${W} ORDER BY p.id DESC LIMIT ${add(pageSize)} OFFSET ${add(offset)}`,
    params
  );
  return ok({ items, page: p, pageSize, total });
});

export const POST = withAuth(R, async (req, { session }) => {
  const d = await body(req, prestamoSchema);
  const resumen = await tx(async (c) => {
    // 1) Prestatario
    let alumnoId: number | null = null;
    let profesorId: number | null = null;
    if (d.profesorId) {
      const pr = await q1(c, "SELECT id FROM profesores WHERE id=$1 AND estado='ACTIVO'", [d.profesorId]);
      if (!pr) throw new HttpError(404, "Profesor no encontrado o inactivo");
      profesorId = d.profesorId;
    } else {
      const al = await q1<{ id: number; estado: string }>(
        c,
        d.alumnoId ? "SELECT id, estado FROM alumnos WHERE id=$1"
          : d.alumnoDni ? "SELECT id, estado FROM alumnos WHERE dni=$1" : "SELECT id, estado FROM alumnos WHERE codigo_alumno=$1",
        [d.alumnoId ?? d.alumnoDni ?? d.alumnoCodigo ?? ""]
      );
      if (!al) throw new HttpError(404, "Alumno no encontrado", "ALUMNO_NO_ENCONTRADO");
      if (al.estado !== "ACTIVO") throw new HttpError(409, "El alumno no está activo", "ALUMNO_INACTIVO");
      alumnoId = al.id;
      const max = Number((await q1<{ valor: number }>(c, "SELECT valor FROM configuracion WHERE clave='max_prestamos_activos_alumno'"))?.valor ?? 3);
      const activos = (await q1<{ n: number }>(c,
        `SELECT count(*)::int AS n FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
         WHERE p.alumno_id = $1 AND pd.estado = 'PRESTADO'`, [alumnoId]))!.n;
      const nuevos = d.items.reduce((s, i) => s + (i.cantidad ?? 1), 0);
      if (activos + nuevos > max) throw new HttpError(409, `El alumno ya tiene ${activos} unidad(es) prestada(s); el máximo es ${max}`, "LIMITE_PRESTAMOS");
    }
    let p: { id: number };
    if (d.fechaPrevistaDevolucion) {
      const { valida } = (await q1<{ valida: boolean }>(
        c,
        `SELECT $1::date BETWEEN ${LIMA_HOY} AND ${LIMA_HOY} + 365 AS valida`,
        [d.fechaPrevistaDevolucion]
      ))!;
      if (!valida) throw new HttpError(400, "La fecha de devolución debe estar entre hoy y los próximos 365 días");
      p = (await q1<{ id: number }>(
        c,
        `INSERT INTO prestamos (usuario_id, tipo_prestatario, alumno_id, profesor_id, fecha_prevista_devolucion, observaciones)
         VALUES ($1,$2,$3,$4,$5::date,$6) RETURNING id`,
        [session.id, alumnoId ? "ALUMNO" : "PROFESOR", alumnoId, profesorId, d.fechaPrevistaDevolucion, d.observaciones]
      ))!;
    } else {
      const dias = d.diasPrestamo ?? Number((await q1<{ valor: number }>(c, "SELECT valor FROM configuracion WHERE clave='dias_prestamo_defecto'"))?.valor ?? 7);
      p = (await q1<{ id: number }>(
        c,
        `INSERT INTO prestamos (usuario_id, tipo_prestatario, alumno_id, profesor_id, fecha_prevista_devolucion, observaciones)
         VALUES ($1,$2,$3,$4, ${LIMA_HOY} + $5::int, $6) RETURNING id`,
        [session.id, alumnoId ? "ALUMNO" : "PROFESOR", alumnoId, profesorId, dias, d.observaciones]
      ))!;
    }

    // 2) Ítems
    const detalles: { titulo: string; codigo?: string; cantidad: number }[] = [];
    const vistos = new Set<string>();
    for (const it of d.items) {
      if (it.codigoEjemplar) {
        const codigo = it.codigoEjemplar.toUpperCase();
        if (vistos.has(codigo)) throw new HttpError(409, `El ejemplar ${codigo} está repetido en el préstamo`);
        vistos.add(codigo);
        const e = await q1<{ id: number; estado: string; condicion: string; titulo: string }>(
          c, `SELECT e.id, e.estado, e.condicion, l.titulo FROM ejemplares e JOIN libros l ON l.id = e.libro_id
              WHERE e.codigo_interno = $1 FOR UPDATE OF e`, [codigo]);
        if (!e) throw new HttpError(404, `No existe el ejemplar ${codigo}`, "EJEMPLAR_NO_ENCONTRADO");
        if (e.estado !== "DISPONIBLE") throw new HttpError(409, `El ejemplar ${codigo} no está disponible (estado: ${e.estado})`, "NO_DISPONIBLE");
        const det = (await q1<{ id: number }>(c,
          `INSERT INTO prestamo_detalles (prestamo_id, ejemplar_id, condicion_salida) VALUES ($1,$2,$3) RETURNING id`,
          [p.id, e.id, e.condicion]))!;
        await c.query("UPDATE ejemplares SET estado = 'PRESTADO' WHERE id = $1", [e.id]);
        await c.query(
          `INSERT INTO historial_ejemplares (ejemplar_id, tipo_evento, estado_anterior, estado_nuevo, prestamo_detalle_id, usuario_id, detalle)
           VALUES ($1,'PRESTADO','DISPONIBLE','PRESTADO',$2,$3,$4)`,
          [e.id, det.id, session.id, `Préstamo #${p.id}`]
        );
        detalles.push({ titulo: e.titulo, codigo, cantidad: 1 });
      } else if (it.libroId) {
        const n = it.cantidad ?? 1;
        const libro = await q1<{ titulo: string; tipoControl: string }>(c, "SELECT titulo, tipo_control FROM libros WHERE id=$1 AND estado='ACTIVO'", [it.libroId]);
        if (!libro) throw new HttpError(404, "Libro no encontrado o archivado");
        if (libro.tipoControl !== "CANTIDAD") throw new HttpError(400, `"${libro.titulo}" es de control INDIVIDUAL: escanea el QR del ejemplar`, "USAR_QR");
        const ex = await q<{ id: number; disponibles: number }>(
          c,
          `SELECT x.id, (x.cantidad_total - x.cantidad_baja - x.cantidad_danada - x.cantidad_perdida
                  - (SELECT count(*) FROM prestamo_detalles pd WHERE pd.existencia_id = x.id AND pd.estado = 'PRESTADO'))::int AS disponibles
           FROM existencias x WHERE x.libro_id = $1 ${it.ubicacionId ? "AND x.ubicacion_id = $2" : ""} ORDER BY x.id FOR UPDATE`,
          it.ubicacionId ? [it.libroId, it.ubicacionId] : [it.libroId]
        );
        // Los cálculos de disponibilidad se hacen con la fila bloqueada; se recalculan por cada unidad.
        let restante = n;
        for (const row of ex) {
          const disp = (await q1<{ d: number }>(c,
            `SELECT (x.cantidad_total - x.cantidad_baja - x.cantidad_danada - x.cantidad_perdida
               - (SELECT count(*) FROM prestamo_detalles pd WHERE pd.existencia_id = x.id AND pd.estado = 'PRESTADO'))::int AS d
             FROM existencias x WHERE x.id = $1`, [row.id]))!.d;
          const toma = Math.min(disp, restante);
          for (let i = 0; i < toma; i++) {
            const det = (await q1<{ id: number }>(c, "INSERT INTO prestamo_detalles (prestamo_id, existencia_id) VALUES ($1,$2) RETURNING id", [p.id, row.id]))!;
            await c.query(
              "INSERT INTO movimientos_existencias (existencia_id, tipo_movimiento, cantidad, prestamo_detalle_id, usuario_id, detalle) VALUES ($1,'PRESTAMO',1,$2,$3,$4)",
              [row.id, det.id, session.id, `Préstamo #${p.id}`]
            );
          }
          restante -= toma;
          if (restante === 0) break;
        }
        if (restante > 0) throw new HttpError(409, `No hay suficientes copias disponibles de "${libro.titulo}"`, "NO_DISPONIBLE");
        detalles.push({ titulo: libro.titulo, cantidad: n });
      } else {
        throw new HttpError(400, "Cada ítem requiere codigoEjemplar o libroId");
      }
    }
    await audit(c, session, "CREAR_PRESTAMO", "prestamos", p.id, null, { alumnoId, profesorId, detalles }, req);
    return { id: p.id, detalles };
  });
  return created(resumen, "Préstamo registrado correctamente");
});
