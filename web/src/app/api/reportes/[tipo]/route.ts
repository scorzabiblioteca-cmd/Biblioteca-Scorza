import { NextResponse } from "next/server";
import { withAuth, ok, HttpError } from "@/lib/http";
import { q, pool } from "@/lib/db";
import { UBIC_TXT } from "@/lib/sql";
import { LIBRO_SELECT } from "@/lib/libros";
import ExcelJS from "exceljs";

const HOY = "(now() AT TIME ZONE 'America/Lima')::date";
const REPORTES: Record<string, string> = {
  inventario: `SELECT isbn, titulo, autores, editorial, categoria, tipo_control, nivel_educativo, grado_recomendado, anio_publicacion, total, disponibles, prestados, danados, perdidos, ubicaciones
               FROM (${LIBRO_SELECT} WHERE l.estado = 'ACTIVO') t ORDER BY titulo`,
  disponibles: `SELECT titulo, autores, categoria, editorial, tipo_control, nivel_educativo, grado_recomendado, anio_publicacion, disponibles, prestados, ubicaciones FROM (${LIBRO_SELECT} WHERE l.estado='ACTIVO') t WHERE disponibles > 0 ORDER BY titulo`,
  prestados: `SELECT e.codigo_interno AS codigo, l.titulo, p.fecha_prestamo, p.fecha_prevista_devolucion,
                COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario,
                al.grado, al.seccion
              FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
              LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN existencias x ON x.id = pd.existencia_id
              JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
              LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
              WHERE pd.estado = 'PRESTADO'
                AND p.fecha_prestamo >= COALESCE($1::date, '1900-01-01')
                AND p.fecha_prestamo < COALESCE($2::date, '2999-01-01') + 1
              ORDER BY p.fecha_prevista_devolucion`,
  vencidos: `SELECT e.codigo_interno AS codigo, l.titulo, p.fecha_prevista_devolucion, (${HOY} - p.fecha_prevista_devolucion) AS dias_atraso,
                p.fecha_prestamo, COALESCE(al.nombres || ' ' || al.apellidos, pr.nombres || ' ' || pr.apellidos) AS prestatario, al.grado, al.seccion
              FROM prestamo_detalles pd JOIN prestamos p ON p.id = pd.prestamo_id
              LEFT JOIN ejemplares e ON e.id = pd.ejemplar_id LEFT JOIN existencias x ON x.id = pd.existencia_id
              JOIN libros l ON l.id = COALESCE(e.libro_id, x.libro_id)
              LEFT JOIN alumnos al ON al.id = p.alumno_id LEFT JOIN profesores pr ON pr.id = p.profesor_id
              WHERE pd.estado = 'PRESTADO' AND p.fecha_prevista_devolucion < ${HOY}
                AND p.fecha_prestamo >= COALESCE($1::date, '1900-01-01')
                AND p.fecha_prestamo < COALESCE($2::date, '2999-01-01') + 1
              ORDER BY p.fecha_prevista_devolucion`,
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
const CON_FECHAS = new Set(["movimientos", "prestamos-alumno", "prestados", "vencidos"]);
const FILTROS_COLUMNAS: Record<string, Record<string, string>> = {
  inventario: {
    categoria: "categoria", editorial: "editorial", grado: "grado_recomendado",
    tipoControl: "tipo_control", nivel: "nivel_educativo", ubicacion: "ubicaciones",
    anioDesde: "anio_publicacion", anioHasta: "anio_publicacion",
  },
  disponibles: {
    categoria: "categoria", editorial: "editorial", grado: "grado_recomendado",
    tipoControl: "tipo_control", nivel: "nivel_educativo", ubicacion: "ubicaciones",
    anioDesde: "anio_publicacion", anioHasta: "anio_publicacion",
  },
  prestados: { grado: "grado", seccion: "seccion" },
  vencidos: { grado: "grado", seccion: "seccion" },
  danados: { tipoControl: "tipo_control" },
  perdidos: { tipoControl: "tipo_control" },
  "nunca-prestados": { grado: "grado_recomendado", tipoControl: "tipo_control" },
  "por-categoria": { categoria: "categoria" },
  "por-grado": { grado: "grado" },
  "por-editorial": { editorial: "editorial" },
  "por-ubicacion": { ubicacion: "ubicacion" },
  "prestamos-alumno": { grado: "grado", seccion: "seccion" },
};
const ORDENES: Record<string, string> = {
  inventario: "titulo",
  disponibles: "titulo",
  prestados: "fecha_prevista_devolucion",
  vencidos: "fecha_prevista_devolucion",
  danados: "titulo",
  perdidos: "titulo",
  "mas-prestados": "veces_prestado DESC, titulo",
  "nunca-prestados": "titulo",
  "por-categoria": "categoria",
  "por-grado": "grado",
  "por-editorial": "editorial",
  "por-ubicacion": "ubicacion",
  movimientos: "created_at DESC",
  "prestamos-alumno": "prestamos DESC, alumno",
};
const FILTROS_DISPONIBILIDAD: Record<string, Record<string, string>> = {
  inventario: {
    disponibles: "r.disponibles > 0", "sin-disponibles": "r.disponibles = 0",
    prestados: "r.prestados > 0", danados: "r.danados > 0", perdidos: "r.perdidos > 0",
  },
  disponibles: { prestados: "r.prestados > 0" },
  danados: { danados: "r.danados > 0" },
  perdidos: { perdidos: "r.perdidos > 0" },
};
const ETIQUETAS: Record<string, string> = {
  isbn: "ISBN",
  titulo: "Título",
  autores: "Autores",
  editorial: "Editorial",
  categoria: "Categoría",
  tipo_control: "Tipo de control",
  nivel_educativo: "Nivel educativo",
  grado_recomendado: "Grado recomendado",
  anio_publicacion: "Año de publicación",
  total: "Total de ejemplares",
  disponibles: "Disponibles",
  prestados: "Prestados",
  danados: "Dañados",
  perdidos: "Perdidos",
  ubicaciones: "Ubicaciones",
  codigo: "Código",
  fecha_prestamo: "Fecha de préstamo",
  fecha_prevista_devolucion: "Fecha prevista de devolución",
  prestatario: "Prestatario",
  dias_atraso: "Días de atraso",
  grado: "Grado",
  seccion: "Sección",
  veces_prestado: "Veces prestado",
  titulos: "Títulos",
  ejemplares: "Ejemplares",
  ubicacion: "Ubicación",
  created_at: "Fecha y hora",
  tipo_evento: "Tipo de evento",
  estado_anterior: "Estado anterior",
  estado_nuevo: "Estado nuevo",
  usuario: "Usuario",
  codigo_alumno: "Código de alumno",
  alumno: "Alumno",
  prestamos: "Préstamos",
  unidades: "Unidades",
};

function aplicarFiltros(tipo: string, sql: string, sp: URLSearchParams, params: unknown[]) {
  const columnas = FILTROS_COLUMNAS[tipo] ?? {};
  const condiciones: string[] = [];
  const add = (value: string) => {
    params.push(value);
    return `$${params.length}`;
  };
  const buscar = sp.get("buscar")?.trim();
  if (buscar) condiciones.push(`to_jsonb(r)::text ILIKE '%' || ${add(buscar)} || '%'`);
  for (const key of ["categoria", "editorial", "ubicacion", "seccion"] as const) {
    const value = sp.get(key)?.trim();
    const column = columnas[key];
    if (value && column) {
      condiciones.push(key === "categoria"
        ? `r.${column}::text = ${add(value)}`
        : `r.${column}::text ILIKE '%' || ${add(value)} || '%'`);
    }
  }
  for (const key of ["grado", "tipoControl", "nivel"] as const) {
    const value = sp.get(key);
    const column = columnas[key];
    if (value && column) condiciones.push(`r.${column}::text = ${add(value)}`);
  }
  const disponibilidad = sp.get("disponibilidad");
  if (disponibilidad) {
    const condicion = FILTROS_DISPONIBILIDAD[tipo]?.[disponibilidad];
    if (!condicion) throw new HttpError(400, "Disponibilidad no válida para este reporte");
    condiciones.push(condicion);
  }
  for (const key of ["anioDesde", "anioHasta"] as const) {
    const value = sp.get(key);
    const column = columnas[key];
    if (!value || !column) continue;
    if (!/^\d{4}$/.test(value)) throw new HttpError(400, "El año debe tener cuatro dígitos");
    condiciones.push(`r.${column} ${key === "anioDesde" ? ">=" : "<="} ${add(value)}::int`);
  }
  return condiciones.length
    ? { sql: `SELECT * FROM (${sql}) r WHERE ${condiciones.join(" AND ")} ORDER BY ${ORDENES[tipo]}`, params }
    : { sql, params };
}

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita inyección de fórmulas en Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [cols.map((c) => ETIQUETAS[c] ?? c).join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n");
}

async function xlsx(rows: Record<string, unknown>[], tipo: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(tipo.slice(0, 31));
  const cols = rows.length ? Object.keys(rows[0]) : [];
  if (!cols.length) {
    worksheet.addRow(["Sin datos para este reporte."]);
  } else {
    worksheet.columns = cols.map((key) => ({
      header: ETIQUETAS[key] ?? key,
      key,
      width: Math.min(50, Math.max(12, (ETIQUETAS[key] ?? key).length + 2, ...rows.map((row) => String(row[key] ?? "").length + 2))),
    }));
    worksheet.addRows(rows.map((row) => cols.map((key) => {
      const value = row[key];
      return value == null ? "" : value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value);
    })));
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: cols.length },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export const GET = withAuth(["BIBLIOTECARIO"], async (req, { params }) => {
  const sql = REPORTES[params.tipo];
  if (!sql) throw new HttpError(404, "Reporte no existe", "REPORTE_NO_EXISTE");
  const sp = req.nextUrl.searchParams;
  const queryParams = CON_FECHAS.has(params.tipo) ? [sp.get("desde"), sp.get("hasta")] : [];
  const filteredQuery = aplicarFiltros(params.tipo, sql, sp, queryParams);
  const rows = await q(pool, filteredQuery.sql, filteredQuery.params);
  const formato = sp.get("formato") ?? "json";
  if (formato === "csv") {
    return new NextResponse(csv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${params.tipo}.csv"` },
    });
  }
  if (formato === "xlsx") {
    return new NextResponse(await xlsx(rows, params.tipo), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${params.tipo}.xlsx"` },
    });
  }
  if (formato !== "json") throw new HttpError(400, "Formato no soportado todavía (usa json, csv o xlsx)");
  return ok(rows);
});
