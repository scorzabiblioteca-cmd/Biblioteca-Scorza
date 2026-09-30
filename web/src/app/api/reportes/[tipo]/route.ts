import { NextResponse } from "next/server";
import { withAuth, ok, HttpError } from "@/lib/http";
import { q, pool } from "@/lib/db";
import { UBIC_TXT } from "@/lib/sql";
import { LIBRO_SELECT } from "@/lib/libros";

const HOY = "(now() AT TIME ZONE 'America/Lima')::date";
const REPORTES: Record<string, string> = {
  inventario: `SELECT isbn, titulo, autores, editorial, categoria, tipo_control, total, disponibles, prestados, danados, perdidos, ubicaciones
               FROM (${LIBRO_SELECT} WHERE l.estado = 'ACTIVO') t ORDER BY titulo`,
  disponibles: `SELECT titulo, autores, tipo_control, disponibles, ubicaciones FROM (${LIBRO_SELECT} WHERE l.estado='ACTIVO') t WHERE disponibles > 0 ORDER BY titulo`,
  prestados: `SELECT e.codigo_interno AS codigo, l.titulo, p.fecha_prestamo, p.fecha_prevista_devolucion,
                COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario
              FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
              LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN existencias x ON x.id = pd.existencia_id
              JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
              LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
              WHERE pd.estado = 'PRESTADO' ORDER BY p.fecha_prevista_devolucion`,
  vencidos: `SELECT e.codigo_interno AS codigo, l.titulo, p.fecha_prevista_devolucion, (${HOY} - p.fecha_prevista_devolucion) AS dias_atraso,
                COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario, al.grado, al.seccion
              FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
              LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN existencias x ON x.id = pd.existencia_id
              JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
              LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
              WHERE pd.estado = 'PRESTADO' AND p.fecha_prevista_devolucion < ${HOY} ORDER BY p.fecha_prevista_devolucion`,
  danados: `SELECT titulo, tipo_control, danados FROM (${LIBRO_SELECT}) t WHERE danados > 0 ORDER BY titulo`,
  perdidos: `SELECT titulo, tipo_control, perdidos FROM (${LIBRO_SELECT}) t WHERE perdidos > 0 ORDER BY titulo`,
  "mas-prestados": `SELECT l.titulo, count(*)::int AS veces_prestado FROM prestamo_detalles pd
              LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN existencias x ON x.id = pd.existencia_id
              JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id) GROUP BY l.id, l.titulo ORDER BY veces_prestado DESC, l.titulo LIMIT 50`,
  "nunca-prestados": `SELECT l.titulo, l.tipo_control, s.total FROM libros l JOIN v_stock_libro s ON s.libro_id = l.id
              WHERE l.estado = 'ACTIVO' AND NOT EXISTS (
                SELECT 1 FROM prestamo_detalles pd LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id
                LEFT JOIN existencias x ON x.id = pd.existencia_id WHERE COALESCE(e.libro_id, x.libro_id) = l.id) ORDER BY l.titulo`,
  "por-categoria": `SELECT COALESCE(categoria, '(Sin categoría)') AS categoria, count(*)::int AS titulos, SUM(total)::int AS ejemplares, SUM(disponibles)::int AS disponibles
              FROM (${LIBRO_SELECT} WHERE l.estado='ACTIVO') t GROUP BY 1 ORDER BY 1`,
  "por-grado": `SELECT COALESCE(grado_recomendado::text, '(Sin grado)') AS grado, count(*)::int AS titulos, SUM(total)::int AS ejemplares
              FROM (${LIBRO_SELECT} WHERE l.estado='ACTIVO') t GROUP BY 1 ORDER BY 1`,
  "por-editorial": `SELECT COALESCE(editorial, '(Sin editorial)') AS editorial, count(*)::int AS titulos, SUM(total)::int AS ejemplares
              FROM (${LIBRO_SELECT} WHERE l.estado='ACTIVO') t GROUP BY 1 ORDER BY 1`,
  "por-ubicacion": `SELECT COALESCE(${UBIC_TXT}, '(Sin ubicación)') AS ubicacion, count(*)::int AS unidades FROM (
                SELECT ubicacion_id FROM ejemplares WHERE estado <> 'BAJA'
                UNION ALL SELECT ubicacion_id FROM existencias, generate_series(1, GREATEST(cantidad_total - cantidad_baja, 0))) x
              LEFT JOIN ubicaciones u ON u.id = x.ubicacion_id GROUP BY 1 ORDER BY 1`,
  movimientos: `SELECT h.created_at, e.codigo_interno AS codigo, l.titulo, h.tipo_evento, h.estado_anterior, h.estado_nuevo, us.username AS usuario
              FROM historial_ejemplares h JOIN ejemplares e ON e.id = h.ejemplar_id JOIN libros l ON l.id = e.libro_id
              JOIN usuarios us ON us.id = h.usuario_id
              WHERE h.created_at >= COALESCE($1::date, ${HOY} - 30) AND h.created_at < COALESCE($2::date, ${HOY}) + 1
              ORDER BY h.created_at DESC LIMIT 5000`,
  "prestamos-alumno": `SELECT al.codigo_alumno, al.apellidos || ' ' || al.nombres AS alumno, al.grado, al.seccion, count(pd.id)::int AS prestamos
              FROM alumnos al JOIN prestamos p ON p.alumno_id = al.id JOIN prestamo_detalles pd ON pd.prestamo_id = p.id
              WHERE p.fecha_prestamo >= COALESCE($1::date, '1900-01-01') AND p.fecha_prestamo < COALESCE($2::date, '2999-01-01')
              GROUP BY al.id ORDER BY prestamos DESC, alumno`,
};
const CON_FECHAS = new Set(["movimientos", "prestamos-alumno"]);

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita inyección de fórmulas en Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}

export const GET = withAuth(["BIBLIOTECARIO"], async (req, { params }) => {
  const sql = REPORTES[params.tipo];
  if (!sql) throw new HttpError(404, "Reporte no existe", "REPORTE_NO_EXISTE");
  const sp = req.nextUrl.searchParams;
  const rows = await q(pool, sql, CON_FECHAS.has(params.tipo) ? [sp.get("desde"), sp.get("hasta")] : []);
  const formato = sp.get("formato") ?? "json";
  if (formato === "csv") {
    return new NextResponse(csv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${params.tipo}.csv"` },
    });
  }
  if (formato !== "json") throw new HttpError(400, "Formato no soportado todavía (usa json o csv)");
  return ok(rows);
});
