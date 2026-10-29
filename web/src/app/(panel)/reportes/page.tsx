"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

type Categoria = { id: number; nombre: string };

const TIPOS: [string, string][] = [
  ["inventario", "Inventario completo"], ["disponibles", "Libros disponibles"], ["prestados", "Libros prestados"], ["vencidos", "Préstamos vencidos"],
  ["danados", "Libros dañados"], ["perdidos", "Libros perdidos"], ["mas-prestados", "Libros más prestados"], ["nunca-prestados", "Libros nunca prestados"],
  ["por-categoria", "Inventario por categoría"], ["por-grado", "Inventario por grado"], ["por-editorial", "Inventario por editorial"],
  ["por-ubicacion", "Inventario por ubicación"], ["movimientos", "Movimientos por fechas"], ["prestamos-alumno", "Préstamos por alumno"],
];

const FILTROS: Record<string, string[]> = {
  inventario: ["categoria", "editorial", "grado", "tipoControl", "nivel", "disponibilidad", "ubicacion", "anioDesde", "anioHasta"],
  disponibles: ["categoria", "editorial", "grado", "tipoControl", "nivel", "disponibilidad", "ubicacion", "anioDesde", "anioHasta"],
  prestados: ["grado", "seccion"],
  vencidos: ["grado", "seccion"],
  danados: ["tipoControl", "disponibilidad"],
  perdidos: ["tipoControl", "disponibilidad"],
  "nunca-prestados": ["grado", "tipoControl"],
  "por-categoria": ["categoria"],
  "por-grado": ["grado"],
  "por-editorial": ["editorial"],
  "por-ubicacion": ["ubicacion"],
  "prestamos-alumno": ["grado", "seccion"],
};
const ETIQUETAS_FILTRO: Record<string, string> = {
  categoria: "Categoría",
  editorial: "Editorial",
  grado: "Grado",
  tipoControl: "Tipo de control",
  nivel: "Nivel educativo",
  disponibilidad: "Disponibilidad",
  ubicacion: "Ubicación",
  seccion: "Sección",
  anioDesde: "Año desde",
  anioHasta: "Año hasta",
};
const CON_FECHAS = ["movimientos", "prestamos-alumno", "prestados", "vencidos"];

export default function Reportes() {
  const [tipo, setTipo] = useState("inventario");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [buscar, setBuscar] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Categoria[]>("/categorias").then(setCategorias).catch((x) => setErr((x as Error).message));
  }, []);
  const qs = (formato?: string) => {
    const params = new URLSearchParams();
    if (CON_FECHAS.includes(tipo)) {
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
    }
    if (buscar.trim()) params.set("buscar", buscar.trim());
    for (const key of FILTROS[tipo] ?? []) {
      if (filtros[key]) params.set(key, filtros[key]);
    }
    if (formato) params.set("formato", formato);
    const query = params.toString();
    return query ? `?${query}` : "";
  };
  const filtro = (key: string) => (
    <label key={key} className="w-full sm:w-auto">
      <span className="label">{ETIQUETAS_FILTRO[key]}</span>
      {key === "categoria" ? (
        <select className="input" value={filtros[key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}>
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
        </select>
      ) : key === "grado" ? (
        <select className="input" value={filtros[key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}>
          <option value="">Todos</option>
          {[1, 2, 3, 4, 5, 6].map((grado) => <option key={grado} value={grado}>{grado}°</option>)}
        </select>
      ) : key === "tipoControl" ? (
        <select className="input" value={filtros[key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}>
          <option value="">Todos</option><option value="INDIVIDUAL">Individual</option><option value="CANTIDAD">Por cantidad</option>
        </select>
      ) : key === "nivel" ? (
        <select className="input" value={filtros[key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}>
          <option value="">Todos</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option>
          <option value="SECUNDARIA">Secundaria</option><option value="GENERAL">General</option>
        </select>
      ) : key === "disponibilidad" ? (
        <select className="input" value={filtros[key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}>
          <option value="">Todas</option>
          {tipo === "inventario" && <><option value="disponibles">Con disponibilidad</option><option value="sin-disponibles">Sin disponibilidad</option><option value="prestados">Con préstamos</option><option value="danados">Con ejemplares dañados</option><option value="perdidos">Con ejemplares perdidos</option></>}
          {tipo === "disponibles" && <option value="prestados">Con préstamos</option>}
          {tipo === "danados" && <option value="danados">Con ejemplares dañados</option>}
          {tipo === "perdidos" && <option value="perdidos">Con ejemplares perdidos</option>}
        </select>
      ) : (
        <input
          type={key.startsWith("anio") ? "number" : "search"}
          min={key.startsWith("anio") ? 1400 : undefined}
          max={key.startsWith("anio") ? 2100 : undefined}
          className="input"
          value={filtros[key] ?? ""}
          onChange={(e) => setFiltros({ ...filtros, [key]: e.target.value })}
          placeholder={key.startsWith("anio") ? "YYYY" : "Filtrar"}
        />
      )}
    </label>
  );
  async function generar() {
    setErr(""); setRows(null);
    try { setRows(await api<any[]>(`/reportes/${tipo}${qs()}`)); } catch (x) { setErr((x as Error).message); }
  }
  const cols = rows?.[0] ? Object.keys(rows[0]) : [];
  return (
    <>
      <PageTitle>Reportes</PageTitle>
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-auto sm:min-w-52"><span className="label">Reporte</span><select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="w-full sm:w-auto"><span className="label">Buscar</span><input type="search" className="input" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Texto en los resultados" /></label>
        {CON_FECHAS.includes(tipo) && (<>
          <label><span className="label">{["prestados", "vencidos", "prestamos-alumno"].includes(tipo) ? "Préstamo desde" : "Fecha desde"}</span><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label><span className="label">{["prestados", "vencidos", "prestamos-alumno"].includes(tipo) ? "Préstamo hasta" : "Fecha hasta"}</span><input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label></>)}
        {(FILTROS[tipo] ?? []).map(filtro)}
        <button className="btn w-full sm:w-auto" onClick={generar}>Generar</button>
        <a className="btn-ghost w-full sm:w-auto" href={`/api/reportes/${tipo}${qs("csv")}`}>Descargar CSV (punto y coma)</a>
        <a className="btn-ghost w-full sm:w-auto" href={`/api/reportes/${tipo}${qs("xlsx")}`}>Descargar Excel (.xlsx)</a>
      </div>
      <Msg type="error">{err}</Msg>
      {rows && (
        <div className="card responsive-table-shell overflow-x-auto p-0">
            <table className="responsive-table w-full"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="td" data-label={c}>{r[c] == null ? "—" : String(r[c])}</td>)}</tr>)}
              {rows.length === 0 && <tr><td className="td text-slate-500">Sin datos para este reporte.</td></tr>}
            </tbody></table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">El CSV usa punto y coma como separador para facilitar su apertura en Excel con configuración regional en español.</p>
    </>
  );
}
