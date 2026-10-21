"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, fecha, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";
import { AlumnoAutocomplete, type Alumno } from "@/components/AlumnoAutocomplete";
import { ProfesorAutocomplete, type Profesor } from "@/components/ProfesorAutocomplete";
import { EjemplarAutocomplete, type LibroCantidad } from "@/components/EjemplarAutocomplete";

type LibroTop = { titulo: string; vecesPrestado: number; categoria: string };

const NUMBER_FORMAT = new Intl.NumberFormat("es-PE");
const PERIODOS = [
  { value: 7, label: "Últimos 7 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
] as const;

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
  const [tipoPrestatario, setTipoPrestatario] = useState<"ALUMNO" | "PROFESOR">("ALUMNO");
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [profesor, setProfesor] = useState<Profesor | null>(null);
  const [cantidades, setCantidades] = useState<LibroCantidad[]>([]);
  const [codigos, setCodigos] = useState("");
  const [fechaDevolucion, setFechaDevolucion] = useState(() => fechaDespuesDe(7));
  const [formVersion, setFormVersion] = useState(0);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [top, setTop] = useState<LibroTop[]>([]);
  const [diasTop, setDiasTop] = useState(30);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ pageSize: "30" });
    if (filtro === "vencidos") p.set("vencidos", "true"); else if (filtro) p.set("estado", filtro);
    api<Paged<any>>(`/prestamos?${p}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api<{ dias: number; masPrestados: LibroTop[] }>(`/prestamos/mas-prestados?dias=${diasTop}`)
      .then((r) => setTop(r.masPrestados))
      .catch(() => setTop([]));
  }, [diasTop]);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (tipoPrestatario === "ALUMNO" ? !alumno : !profesor) {
      setMsg({ t: "error", m: `Selecciona un ${tipoPrestatario === "ALUMNO" ? "alumno" : "profesor"} registrado de las sugerencias.` });
      return;
    }
    const items = [...codigos.split(/[\s,;]+/).filter(Boolean).map((c) => ({ codigoEjemplar: c })),
      ...cantidades.map(({ libroId, cantidad }) => ({ libroId, cantidad }))];
    try {
      await api("/prestamos", { json: {
        ...(tipoPrestatario === "ALUMNO" ? { alumnoId: alumno!.id } : { profesorId: profesor!.id }),
        items,
        fechaPrevistaDevolucion: fechaDevolucion,
      } });
      setCantidades([]);
      setFormVersion((v) => v + 1);
      setMsg({ t: "ok", m: "Préstamo registrado correctamente" });
      setCodigos("");
      setAlumno(null);
      setProfesor(null);
      setTipoPrestatario("ALUMNO");
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
        className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
          <div>
            <h2 id="prestamo-dialog-title" className="text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">Registrar préstamo</h2>
            <p className="mt-1 text-sm text-[#718096]">Elige a quién y qué prestar.</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            aria-label="Cerrar ventana"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <form onSubmit={crear} className="grid gap-4 p-5 sm:p-6">
          <fieldset className="grid gap-2">
            <legend className="label">Tipo de prestatario</legend>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="radio" name="tipoPrestatario" value="ALUMNO" checked={tipoPrestatario === "ALUMNO"} onChange={() => { setTipoPrestatario("ALUMNO"); setProfesor(null); }} />Alumno</label>
              <label className="flex items-center gap-2"><input type="radio" name="tipoPrestatario" value="PROFESOR" checked={tipoPrestatario === "PROFESOR"} onChange={() => { setTipoPrestatario("PROFESOR"); setAlumno(null); }} />Profesor</label>
            </div>
          </fieldset>
          {tipoPrestatario === "ALUMNO"
            ? <AlumnoAutocomplete value={alumno} onChange={setAlumno} />
            : <ProfesorAutocomplete value={profesor} onChange={setProfesor} />}
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
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <button type="submit" className="btn">Confirmar préstamo</button>
          </div>
        </form>
      </dialog>
      <section className="card mb-4 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ecf4] px-4 py-3">
          <div>
            <h2 className="text-[0.98rem] font-bold tracking-[-0.01em] text-[#172b4d]">Libros más prestados</h2>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Ranking por préstamos del periodo</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="top-periodo">Periodo del ranking</label>
            <select
              id="top-periodo"
              className="input w-auto min-h-0 py-1.5 text-sm"
              value={diasTop}
              onChange={(e) => setDiasTop(Number(e.target.value))}
            >
              {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <a className="btn-ghost" href="/api/reportes/mas-prestados?formato=csv">Exportar CSV</a>
          </div>
        </div>
        {top.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#94a3b8]">Aún no hay préstamos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full min-w-[560px]">
              <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]">
                <tr>
                  <th className="th w-12">#</th>
                  <th className="th">Título</th>
                  <th className="th">Categoría</th>
                  <th className="th">Préstamos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7]">
                {top.map((libro, i) => (
                  <tr key={libro.titulo} className="transition hover:bg-[#f7faff]">
                    <td className="td w-12" data-label="#">{i + 1}</td>
                    <td className="td font-medium text-[#172b4d]" data-label="Título">{libro.titulo}</td>
                    <td className="td" data-label="Categoría">{libro.categoria}</td>
                    <td className="td" data-label="Préstamos">
                      <span className="font-semibold text-[#2563eb]">{NUMBER_FORMAT.format(libro.vecesPrestado)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <select className="input mb-3 w-full sm:max-w-xs" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Estado del préstamo">
        <option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="vencidos">Vencidos</option><option value="CERRADO">Cerrados</option><option value="ANULADO">Anulados</option>
      </select>
      <div className="card responsive-table-shell overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[720px]"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["#", "Prestatario", "Libros", "Préstamo", "Devolver antes de", "Estado", "Registró"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((p) => (
              <tr key={p.id}><td className="td" data-label="#">{p.id}</td><td className="td font-medium" data-label="Prestatario">{p.prestatario}</td><td className="td" data-label="Libros">{p.items}</td>
                <td className="td" data-label="Préstamo">{fecha(p.fechaPrestamo)}</td>
                <td className={`td ${p.vencido ? "font-medium text-red-700" : ""}`} data-label="Devolver antes de">{fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " (vencido)" : ""}</td>
                <td className="td" data-label="Estado"><Badge v={p.estado} /><span className="sr-only">{p.estado}</span></td><td className="td" data-label="Registró">{p.registradoPor}</td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay préstamos todavía.</td></tr>}
          </tbody></table>
      </div>
    </>
  );
}
