"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

const TIPOS: [string, string][] = [
  ["inventario", "Inventario completo"], ["disponibles", "Libros disponibles"], ["prestados", "Libros prestados"], ["vencidos", "Préstamos vencidos"],
  ["danados", "Libros dañados"], ["perdidos", "Libros perdidos"], ["mas-prestados", "Libros más prestados"], ["nunca-prestados", "Libros nunca prestados"],
  ["por-categoria", "Inventario por categoría"], ["por-grado", "Inventario por grado"], ["por-editorial", "Inventario por editorial"],
  ["por-ubicacion", "Inventario por ubicación"], ["movimientos", "Movimientos por fechas"], ["prestamos-alumno", "Préstamos por alumno"],
];

export default function Reportes() {
  const [tipo, setTipo] = useState("inventario");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const qs = (extra = "") => `?${new URLSearchParams({ ...(desde && { desde }), ...(hasta && { hasta }) })}${extra}`;
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
        {["movimientos", "prestamos-alumno"].includes(tipo) && (<>
          <label><span className="label">Desde</span><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label><span className="label">Hasta</span><input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label></>)}
        <button className="btn w-full sm:w-auto" onClick={generar}>Generar</button>
        <a className="btn-ghost w-full sm:w-auto" href={`/api/reportes/${tipo}${qs("&formato=csv")}`}>Descargar CSV (Excel)</a>
      </div>
      <Msg type="error">{err}</Msg>
      {rows && (
        <div className="card responsive-table-shell overflow-x-auto p-0">
            <table className="responsive-table w-full"><thead className="border-b bg-slate-50"><tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="td" data-label={c}>{r[c] == null ? "—" : String(r[c])}</td>)}</tr>)}
              {rows.length === 0 && <tr><td className="td text-slate-500">Sin datos para este reporte.</td></tr>}
            </tbody></table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">La exportación a PDF llegará en una siguiente versión; el CSV se abre directamente en Excel.</p>
    </>
  );
}
