"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, fecha, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";
import { AlumnoAutocomplete, type Alumno } from "@/components/AlumnoAutocomplete";
import { EjemplarAutocomplete, type LibroCantidad } from "@/components/EjemplarAutocomplete";

function fechaDespuesDe(dias: number) {
  const date = new Date();
  date.setDate(date.getDate() + dias);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Prestamos() {
  const [data, setData] = useState<Paged<any> | null>(null);
  const [filtro, setFiltro] = useState("");
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [cantidades, setCantidades] = useState<LibroCantidad[]>([]);
  const [codigos, setCodigos] = useState("");
  const [fechaDevolucion, setFechaDevolucion] = useState(() => fechaDespuesDe(7));
  const [formVersion, setFormVersion] = useState(0);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ pageSize: "30" });
    if (filtro === "vencidos") p.set("vencidos", "true"); else if (filtro) p.set("estado", filtro);
    api<Paged<any>>(`/prestamos?${p}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!alumno) {
      setMsg({ t: "error", m: "Selecciona un alumno registrado de las sugerencias." });
      return;
    }
    const items = [...codigos.split(/[\s,;]+/).filter(Boolean).map((c) => ({ codigoEjemplar: c })),
      ...cantidades.map(({ libroId, cantidad }) => ({ libroId, cantidad }))];
    try {
      await api("/prestamos", { json: { alumnoId: alumno.id, items, fechaPrevistaDevolucion: fechaDevolucion } });
      setCantidades([]);
      setFormVersion((v) => v + 1);
      setMsg({ t: "ok", m: "Préstamo registrado correctamente" });
      setCodigos("");
      setAlumno(null);
      setFechaDevolucion(fechaDespuesDe(7));
      dialogRef.current?.close();
      cargar();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PageTitle action={
        <button type="button" className="btn" onClick={() => { setMsg(null); dialogRef.current?.showModal(); }}>
          Registrar préstamo
        </button>
      }>Préstamos</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <dialog
        ref={dialogRef}
        aria-labelledby="prestamo-dialog-title"
        className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="prestamo-dialog-title" className="text-lg font-semibold text-slate-900">Registrar préstamo</h2>
            <p className="mt-1 text-sm text-slate-500">Selecciona el alumno y los libros que se prestarán.</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            aria-label="Cerrar ventana"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <form onSubmit={crear} className="grid gap-4 p-5 sm:p-6">
          <AlumnoAutocomplete value={alumno} onChange={setAlumno} />
          <EjemplarAutocomplete key={formVersion} codigos={codigos} onChange={setCodigos} cantidades={cantidades} onCantidadesChange={setCantidades} />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Fecha de devolución
            <input
              className="input"
              type="date"
              value={fechaDevolucion}
              min={fechaDespuesDe(0)}
              max={fechaDespuesDe(365)}
              onChange={(e) => setFechaDevolucion(e.target.value)}
              required
            />
          </label>
          {msg?.t === "error" && <Msg type="error">{msg.m}</Msg>}
          <p className="text-xs text-slate-500">Busca por título, código, ISBN o categoría y agrega los libros al préstamo.</p>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <button type="submit" className="btn">Confirmar préstamo</button>
          </div>
        </form>
      </dialog>
      <select className="input mb-3 w-full sm:max-w-xs" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtro">
        <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="vencidos">Vencidos</option><option value="CERRADO">Cerrados</option>
      </select>
      <div className="card responsive-table-shell overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[720px]"><thead className="border-b bg-slate-50"><tr>{["#", "Prestatario", "Libros", "Préstamo", "Devolver antes de", "Estado", "Registró"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((p) => (
              <tr key={p.id}><td className="td" data-label="#">{p.id}</td><td className="td font-medium" data-label="Prestatario">{p.prestatario}</td><td className="td" data-label="Libros">{p.items}</td>
                <td className="td" data-label="Préstamo">{fecha(p.fechaPrestamo)}</td>
                <td className={`td ${p.vencido ? "font-medium text-red-700" : ""}`} data-label="Devolver antes de">{fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " (vencido)" : ""}</td>
                <td className="td" data-label="Estado"><Badge v={p.estado === "CERRADO" ? "BAJA" : "PRESTADO"} /><span className="sr-only">{p.estado}</span></td><td className="td" data-label="Registró">{p.registradoPor}</td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay préstamos todavía.</td></tr>}
          </tbody></table>
      </div>
    </>
  );
}
