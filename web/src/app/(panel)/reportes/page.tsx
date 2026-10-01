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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{
    total: number;
    importados: number;
    duplicados: number;
    errores: { fila: number; mensaje: string }[];
    advertencias: { fila: number; mensaje: string }[];
  } | null>(null);
  const qs = (extra = "") => `?${new URLSearchParams({ ...(desde && { desde }), ...(hasta && { hasta }) })}${extra}`;
  async function generar() {
    setErr(""); setRows(null);
    try { setRows(await api<any[]>(`/reportes/${tipo}${qs()}`)); } catch (x) { setErr((x as Error).message); }
  }
  async function importarCsv() {
    if (!csvFile) return;
    setImportando(true); setErr(""); setResultadoImport(null);
    const formData = new FormData();
    formData.append("file", csvFile);
    try {
      setResultadoImport(await api<typeof resultadoImport extends infer T ? Exclude<T, null> : never>(
        "/libros/importar-csv", { method: "POST", formData }
      ));
      setCsvFile(null);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setImportando(false);
    }
  }
  const cols = rows?.[0] ? Object.keys(rows[0]) : [];
  return (
    <>
      <PageTitle>Reportes</PageTitle>
      <section className="card mb-4">
        <h2 className="mb-3 text-base font-semibold">Importar libros desde CSV</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 sm:max-w-md">
            <span className="label">Archivo CSV</span>
            <input className="input" type="file" accept=".csv,text/csv" onChange={(event) => {
              setCsvFile(event.target.files?.[0] ?? null);
              setResultadoImport(null);
            }} />
          </label>
          <button className="btn" type="button" onClick={importarCsv} disabled={!csvFile || importando}>
            {importando ? "Importando..." : "Importar libros"}
          </button>
        </div>
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer">Ver columnas aceptadas</summary>
          <p className="mt-2">Acepta el CSV del formulario de inventario con columnas como Título del libro, Autor, Editorial, Año, Categoría, Cantidad de ejemplares, Estado libro y Ubicación, además del CSV de Inventario completo de esta pantalla. La primera fila descriptiva se ignora; cantidades se importan como stock inicial. La ubicación debe existir en el catálogo para asociarse.</p>
        </details>
        {resultadoImport && (
          <div role="status" className="mt-3 text-sm">
            <p>{resultadoImport.importados} importados, {resultadoImport.duplicados} duplicados omitidos y {resultadoImport.errores.length} con errores.</p>
            {resultadoImport.errores.length > 0 && (
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-amber-800">
                {resultadoImport.errores.map((error, index) => <li key={`${error.fila}-${index}`}>Fila {error.fila}: {error.mensaje}</li>)}
              </ul>
            )}
            {resultadoImport.advertencias.length > 0 && (
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-amber-800">
                {resultadoImport.advertencias.map((warning, index) => <li key={`${warning.fila}-${index}`}>Fila {warning.fila}: {warning.mensaje}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label><span className="label">Reporte</span><select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {["movimientos", "prestamos-alumno"].includes(tipo) && (<>
          <label><span className="label">Desde</span><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label><span className="label">Hasta</span><input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label></>)}
        <button className="btn" onClick={generar}>Generar</button>
        <a className="btn-ghost" href={`/api/reportes/${tipo}${qs("&formato=csv")}`}>Descargar CSV (Excel)</a>
      </div>
      <Msg type="error">{err}</Msg>
      {rows && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="border-b bg-slate-50"><tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="td">{r[c] == null ? "—" : String(r[c])}</td>)}</tr>)}
              {rows.length === 0 && <tr><td className="td text-slate-500">Sin datos para este reporte.</td></tr>}
            </tbody></table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">La exportación a PDF llegará en una siguiente versión; el CSV se abre directamente en Excel.</p>
    </>
  );
}
