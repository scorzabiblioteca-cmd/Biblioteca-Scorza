"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, fecha, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";
import { AlumnoAutocomplete, type Alumno } from "@/components/AlumnoAutocomplete";
import { ProfesorAutocomplete, type Profesor } from "@/components/ProfesorAutocomplete";
import { AlumnoFormDialog } from "@/components/AlumnoFormDialog";
import { ProfesorFormDialog } from "@/components/ProfesorFormDialog";
import { EjemplarAutocomplete, type LibroCantidad } from "@/components/EjemplarAutocomplete";
import PrestamosDevolucionesTabs from "@/components/PrestamosDevolucionesTabs";
import { HistorialPrestatarioDialog, seleccionarPrestatario, type PrestatarioSeleccionado, type RegistroPrestatario } from "@/components/HistorialPrestatarioDialog";

type LibroTop = { titulo: string; vecesPrestado: number; categoria: string };

type LibroPrestamo = { titulo: string; cantidad: number; codigos: string | null };
type PrestamoFila = RegistroPrestatario & {
  id: number;
  estado: string;
  fechaPrestamo: string;
  fechaPrevistaDevolucion: string;
  fechaCierre: string | null;
  vencido: boolean;
  prestatario: string;
  registradoPor: string;
  unidades: number;
  libros: LibroPrestamo[];
  items: string | null;
};

const COLUMNAS_PRESTAMOS = ["#", "Prestatario", "Libros", "Unidades", "Préstamo", "Devolver antes de", "Estado", "Registró", ""];

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
  const [data, setData] = useState<Paged<PrestamoFila> | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState("");
  const [busquedaListado, setBusquedaListado] = useState("");
  const busquedaAplicada = useRef("");
  const [tipoListado, setTipoListado] = useState("");
  const [fechaPrestamoFiltro, setFechaPrestamoFiltro] = useState("");
  const [tipoPrestatario, setTipoPrestatario] = useState<"ALUMNO" | "PROFESOR">("ALUMNO");
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [profesor, setProfesor] = useState<Profesor | null>(null);
  const [crearAlumno, setCrearAlumno] = useState(false);
  const [crearProfesor, setCrearProfesor] = useState(false);
  const [cantidades, setCantidades] = useState<LibroCantidad[]>([]);
  const [codigos, setCodigos] = useState("");
  const [fechaDevolucion, setFechaDevolucion] = useState(() => fechaDespuesDe(7));
  const [formVersion, setFormVersion] = useState(0);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [top, setTop] = useState<LibroTop[]>([]);
  const [diasTop, setDiasTop] = useState(30);
  const [mostrarTop, setMostrarTop] = useState(false);
  const [historialDe, setHistorialDe] = useState<PrestatarioSeleccionado | null>(null);
  const [detalle, setDetalle] = useState<PrestamoFila | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detalleRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = detalleRef.current;
    if (!dialog) return;
    if (detalle && !dialog.open) dialog.showModal();
    else if (!detalle && dialog.open) dialog.close();
  }, [detalle]);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ page: String(pagina), pageSize: "10" });
    if (filtro === "vencidos") p.set("vencidos", "true"); else if (filtro) p.set("estado", filtro);
    if (busquedaAplicada.current) p.set("q", busquedaAplicada.current);
    if (tipoListado) p.set("tipoPrestatario", tipoListado);
    if (fechaPrestamoFiltro) {
      p.set("desde", fechaPrestamoFiltro);
      p.set("hasta", fechaPrestamoFiltro);
    }
    api<Paged<PrestamoFila>>(`/prestamos?${p}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [filtro, tipoListado, fechaPrestamoFiltro, pagina]);
  useEffect(() => { cargar(); }, [cargar]);
  const paginasPrestamos = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function buscarListado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    busquedaAplicada.current = busquedaListado.trim();
    setPagina(1);
    cargar();
  }

  useEffect(() => {
    if (!mostrarTop) return;
    api<{ dias: number; masPrestados: LibroTop[] }>(`/prestamos/mas-prestados?dias=${diasTop}`)
      .then((r) => setTop(r.masPrestados))
      .catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [diasTop, mostrarTop]);

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
      <PrestamosDevolucionesTabs actual="prestamos" />
      <PageTitle action={
        <button type="button" className="btn" onClick={() => { setMsg(null); dialogRef.current?.showModal(); }}>
          Registrar préstamo
        </button>
      }>Préstamos</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <HistorialPrestatarioDialog
        key={historialDe ? `${historialDe.tipo}-${historialDe.id}` : "cerrado"}
        prestatario={historialDe}
        onClose={() => setHistorialDe(null)}
      />
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
            ? <AlumnoAutocomplete value={alumno} onChange={setAlumno} onCrear={() => setCrearAlumno(true)} />
            : <ProfesorAutocomplete value={profesor} onChange={setProfesor} onCrear={() => setCrearProfesor(true)} />}
          <EjemplarAutocomplete key={formVersion} codigos={codigos} onChange={setCodigos} cantidades={cantidades} onCantidadesChange={setCantidades} />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            <span className="label">Fecha de devolución</span>
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
      <dialog
        ref={detalleRef}
        aria-labelledby="detalle-prestamo-title"
        onClose={() => setDetalle(null)}
        className="m-auto max-h-[90dvh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        {detalle && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-600">Préstamo #{detalle.id}</p>
                <h2 id="detalle-prestamo-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">{detalle.prestatario}</h2>
                <p className="mt-1 text-sm text-[#718096]">
                  {detalle.tipoPrestatario === "ALUMNO" ? "Alumno" : "Profesor"}
                  {detalle.dni ? ` · DNI ${detalle.dni}` : ""}
                  {detalle.codigoAlumno ? ` · Código ${detalle.codigoAlumno}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                aria-label="Cerrar ventana"
                onClick={() => detalleRef.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="grid gap-5 p-5 sm:p-6">
              <dl className="grid gap-3 rounded-xl border border-[#e6ecf4] bg-[#f7f9fc] p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Estado</dt>
                  <dd className="mt-1"><Badge v={detalle.estado} /></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Unidades</dt>
                  <dd className="mt-1 text-sm font-bold text-[#172b4d]">{detalle.unidades}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Registró</dt>
                  <dd className="mt-1 text-sm text-[#334155]">{detalle.registradoPor}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Fecha de préstamo</dt>
                  <dd className="mt-1 text-sm text-[#334155]">{fecha(detalle.fechaPrestamo)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Devolver antes de</dt>
                  <dd className={`mt-1 text-sm ${detalle.vencido ? "font-semibold text-red-700" : "text-[#334155]"}`}>
                    {fecha(detalle.fechaPrevistaDevolucion)}{detalle.vencido ? " (vencido)" : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Devolución</dt>
                  <dd className="mt-1 text-sm text-[#334155]">{detalle.fechaCierre ? fecha(detalle.fechaCierre) : "Pendiente"}</dd>
                </div>
              </dl>
              <section aria-labelledby="detalle-libros-title">
                <h3 id="detalle-libros-title" className="mb-2 text-sm font-semibold text-[#172b4d]">Libros prestados</h3>
                <div className="grid gap-2">
                  {detalle.libros?.map((libro) => (
                    <div key={libro.titulo} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e6ecf4] bg-[#f7f9fc] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#172b4d]">{libro.titulo}</p>
                        {libro.codigos && <p className="mt-0.5 font-mono text-xs text-slate-500">{libro.codigos}</p>}
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
                        ×{libro.cantidad}
                      </span>
                    </div>
                  ))}
                  {(!detalle.libros || detalle.libros.length === 0) && (
                    <p className="rounded-xl border border-dashed border-[#dbe3ee] px-4 py-6 text-center text-sm text-[#94a3b8]">Sin libros registrados.</p>
                  )}
                </div>
              </section>
            </div>
            <div className="flex justify-end border-t border-[#e6ecf4] px-5 py-4 sm:px-6">
              <button type="button" className="btn-ghost" onClick={() => detalleRef.current?.close()}>Cerrar</button>
            </div>
          </>
        )}
      </dialog>
      <AlumnoFormDialog
        open={crearAlumno}
        onClose={() => setCrearAlumno(false)}
        onSaved={(a) => setAlumno({ id: a.id, nombres: a.nombres, apellidos: a.apellidos, dni: a.dni ?? "", codigoAlumno: a.codigoAlumno })}
      />
      <ProfesorFormDialog
        open={crearProfesor}
        onClose={() => setCrearProfesor(false)}
        onSaved={(p) => setProfesor({ id: p.id, nombres: p.nombres, apellidos: p.apellidos, dni: p.dni, area: p.area })}
      />
      <section className="card mb-4 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ecf4] px-4 py-3">
          <div>
            <h2 id="libros-mas-prestados-heading" className="text-[0.98rem] font-bold tracking-[-0.01em] text-[#172b4d]">Libros más prestados</h2>
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
            <button
              type="button"
              className="btn-ghost"
              aria-expanded={mostrarTop}
              aria-controls="libros-mas-prestados-content"
              onClick={() => setMostrarTop((mostrar) => !mostrar)}
            >
              {mostrarTop ? "Ocultar" : "Buscar"}
            </button>
          </div>
        </div>
        {mostrarTop && (
          <div id="libros-mas-prestados-content" aria-labelledby="libros-mas-prestados-heading">
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
          </div>
        )}
      </section>
      <section className="card mb-3 flex flex-wrap items-end gap-3">
        <form className="flex w-full items-end gap-2 sm:w-auto" onSubmit={buscarListado}>
          <label className="min-w-0 flex-1 sm:min-w-64"><span className="label">Buscar préstamo</span>
            <input className="input" type="search" placeholder="Prestatario, libro o código" value={busquedaListado} onChange={(e) => setBusquedaListado(e.target.value)} /></label>
          <button type="submit" className="btn">Buscar</button>
        </form>
        <label><span className="label">Estado</span><select className="input" value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }}>
          <option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="vencidos">Vencidos</option><option value="CERRADO">Cerrados</option><option value="ANULADO">Anulados</option>
        </select></label>
        <label><span className="label">Tipo de prestatario</span><select className="input" value={tipoListado} onChange={(e) => { setTipoListado(e.target.value); setPagina(1); }}>
          <option value="">Todos</option><option value="ALUMNO">Alumno</option><option value="PROFESOR">Profesor</option>
        </select></label>
        <label><span className="label">Fecha de préstamo</span><input type="date" className="input" value={fechaPrestamoFiltro} onChange={(e) => { setFechaPrestamoFiltro(e.target.value); setPagina(1); }} /></label>
      </section>
      <div className="card responsive-table-shell hidden overflow-x-auto p-0 sm:block">
        <table className="responsive-table w-full min-w-[860px]">
          <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{COLUMNAS_PRESTAMOS.map((h, i) => <th key={`${h}-${i}`} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="td" data-label="#">{p.id}</td>
                <td className="td font-medium" data-label="Prestatario">
                  <button type="button" className="text-left hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    onClick={() => { const prestatario = seleccionarPrestatario(p); if (prestatario) setHistorialDe(prestatario); }}>
                    {p.prestatario}
                  </button>
                </td>
                <td className="td" data-label="Libros">
                  <span className="block max-w-[22rem] text-sm text-slate-600">
                    {p.libros?.length
                      ? p.libros.map((libro) => libro.cantidad > 1 ? `${libro.titulo} ×${libro.cantidad}` : libro.titulo).join("; ")
                      : "—"}
                  </span>
                </td>
                <td className="td" data-label="Unidades">
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
                    {p.unidades}
                  </span>
                </td>
                <td className="td whitespace-nowrap" data-label="Préstamo">{fecha(p.fechaPrestamo)}</td>
                <td className={`td whitespace-nowrap ${p.vencido ? "font-medium text-red-700" : ""}`} data-label="Devolver antes de">{fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " (vencido)" : ""}</td>
                <td className="td" data-label="Estado"><Badge v={p.estado} /><span className="sr-only">{p.estado}</span></td>
                <td className="td" data-label="Registró">{p.registradoPor}</td>
                <td className="td" data-label="Detalle">
                  <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setDetalle(p)}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={COLUMNAS_PRESTAMOS.length}>No hay préstamos todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:hidden" aria-label="Lista de préstamos">
        {data?.items.map((p) => (
          <article key={p.id} className="rounded-xl border border-[#e6ecf4] bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button type="button" className="block max-w-full truncate text-left text-sm font-semibold text-[#172b4d] hover:text-brand-700 hover:underline"
                  onClick={() => { const prestatario = seleccionarPrestatario(p); if (prestatario) setHistorialDe(prestatario); }}>
                  {p.prestatario}
                </button>
                <p className="mt-0.5 text-xs text-slate-500">Préstamo #{p.id} · {p.unidades} unidad(es)</p>
              </div>
              <Badge v={p.estado} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">
              {p.libros?.length
                ? p.libros.map((libro) => libro.cantidad > 1 ? `${libro.titulo} ×${libro.cantidad}` : libro.titulo).join("; ")
                : "Sin libros registrados"}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">Prestado {fecha(p.fechaPrestamo)}</span>
              <span className={p.vencido ? "font-semibold text-red-700" : "text-slate-600"}>
                Vence {fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " · Vencido" : ""}
              </span>
            </div>
            <button type="button" className="mt-2 min-h-9 w-full rounded-lg bg-slate-50 px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              onClick={() => setDetalle(p)}>
              Ver detalle
            </button>
          </article>
        ))}
        {data && data.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#dbe3ee] px-4 py-6 text-center text-sm text-slate-500">No hay préstamos todavía.</p>
        )}
      </div>
      {data && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {data.total === 0
              ? "0 préstamos"
              : `${(pagina - 1) * data.pageSize + 1}–${Math.min(pagina * data.pageSize, data.total)} de ${data.total} préstamos`}
          </span>
          {data.total > data.pageSize && (
            <div className="flex items-center gap-2">
              <button className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
              <span>{pagina} / {paginasPrestamos}</span>
              <button className="btn-ghost" disabled={pagina >= paginasPrestamos} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
