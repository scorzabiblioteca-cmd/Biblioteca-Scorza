"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, fecha, fechaHora, Paged } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";
import PrestamosDevolucionesTabs from "@/components/PrestamosDevolucionesTabs";
import { HistorialPrestatarioDialog, seleccionarPrestatario, type PrestatarioSeleccionado, type RegistroPrestatario } from "@/components/HistorialPrestatarioDialog";

type DevolucionHistorial = RegistroPrestatario & {
  id: number;
  fechaDevolucion: string;
  resultado: string;
  observaciones: string | null;
  titulo: string;
  codigoInterno: string | null;
};

type PrestamoBusqueda = RegistroPrestatario & {
  prestamoId: number;
  libroId: number;
  detalleId: number;
  estadoDetalle: string;
  activo: boolean;
  codigoInterno: string | null;
  titulo: string;
  fechaPrestamo: string;
  fechaPrevistaDevolucion: string;
  vencido: boolean;
};

type LibroGrupoDevolucion = {
  libroId: number;
  titulo: string;
  unidades: PrestamoBusqueda[];
};

type PrestamoGrupo = {
  prestamoId: number;
  prestatario: string;
  dni: string | null;
  codigoAlumno: string | null;
  fechaPrestamo: string;
  fechaPrevistaDevolucion: string;
  vencido: boolean;
  unidades: PrestamoBusqueda[];
  libros: LibroGrupoDevolucion[];
};

export default function Devoluciones() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PrestamoBusqueda[]>([]);
  const [seleccion, setSeleccion] = useState<PrestamoBusqueda[] | null>(null);
  const [grupoAbiertoId, setGrupoAbiertoId] = useState<number | null>(null);
  const grupoRef = useRef<HTMLDialogElement>(null);
  const seleccionRef = useRef<HTMLDialogElement>(null);
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState("BUENO");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [historial, setHistorial] = useState<Paged<DevolucionHistorial> | null>(null);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [resultadoHistorial, setResultadoHistorial] = useState("");
  const [fechaHistorial, setFechaHistorial] = useState("");
  const [historialDe, setHistorialDe] = useState<PrestatarioSeleccionado | null>(null);

  const grupos = useMemo(() => {
    const porPrestamo = new Map<number, PrestamoGrupo>();
    for (const item of resultados) {
      let grupo = porPrestamo.get(item.prestamoId);
      if (!grupo) {
        grupo = {
          prestamoId: item.prestamoId,
          prestatario: item.prestatario,
          dni: item.dni,
          codigoAlumno: item.codigoAlumno,
          fechaPrestamo: item.fechaPrestamo,
          fechaPrevistaDevolucion: item.fechaPrevistaDevolucion,
          vencido: item.vencido,
          unidades: [],
          libros: [],
        };
        porPrestamo.set(item.prestamoId, grupo);
      }
      grupo.unidades.push(item);
      grupo.vencido = grupo.vencido || item.vencido;
      let libro = grupo.libros.find((l) => l.libroId === item.libroId);
      if (!libro) {
        libro = { libroId: item.libroId, titulo: item.titulo, unidades: [] };
        grupo.libros.push(libro);
      }
      libro.unidades.push(item);
    }
    return [...porPrestamo.values()];
  }, [resultados]);

  const grupoAbierto = useMemo(
    () => grupos.find((grupo) => grupo.prestamoId === grupoAbiertoId) ?? null,
    [grupos, grupoAbiertoId]
  );

  useEffect(() => {
    const dialog = grupoRef.current;
    if (!dialog) return;
    if (grupoAbierto && !dialog.open) dialog.showModal();
    else if (!grupoAbierto && dialog.open) dialog.close();
  }, [grupoAbierto]);

  useEffect(() => {
    const dialog = seleccionRef.current;
    if (!dialog) return;
    const abierto = Boolean(seleccion && seleccion.length > 0);
    if (abierto && !dialog.open) {
      setRes("BUENO");
      setObs("");
      dialog.showModal();
    } else if (!abierto && dialog.open) {
      dialog.close();
    }
  }, [seleccion]);

  const cargarHistorial = useCallback(() => {
    const params = new URLSearchParams({ page: String(paginaHistorial), pageSize: "20" });
    if (busquedaHistorial.trim()) params.set("q", busquedaHistorial.trim());
    if (resultadoHistorial) params.set("resultado", resultadoHistorial);
    if (fechaHistorial) {
      params.set("desde", fechaHistorial);
      params.set("hasta", fechaHistorial);
    }
    return api<Paged<DevolucionHistorial>>(`/devoluciones?${params}`).then(setHistorial)
      .catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [paginaHistorial, busquedaHistorial, resultadoHistorial, fechaHistorial]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setSeleccion(null); setBuscando(true);
    try {
      const params = new URLSearchParams({ q: busqueda.trim(), incluirInactivos: "true" });
      const data = await api<{ items: PrestamoBusqueda[] }>(`/prestamos/activo?${params}`);
      setResultados(data.items);
      if (data.items.length === 0) setMsg({ t: "error", m: "No se encontraron préstamos activos ni inactivos." });
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
    finally { setBuscando(false); }
  }
  async function confirmar() {
    if (!seleccion || seleccion.length === 0) return;
    const ids = new Set(seleccion.map((unidad) => unidad.detalleId));
    try {
      const json = seleccion.length === 1
        ? { prestamoDetalleId: seleccion[0].detalleId, resultado: res, observaciones: obs }
        : { prestamoDetalleIds: [...ids], resultado: res, observaciones: obs };
      await api("/devoluciones", { json });
      setMsg({
        t: "ok",
        m: seleccion.length === 1
          ? "Devolución registrada correctamente"
          : `${seleccion.length} unidades devueltas correctamente`,
      });
      setSeleccion(null);
      setResultados((items) => items.filter((item) => !ids.has(item.detalleId)));
      setBusqueda(""); setObs(""); setRes("BUENO");
      await cargarHistorial();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PrestamosDevolucionesTabs actual="devoluciones" />
      <PageTitle>Devoluciones</PageTitle>
      <HistorialPrestatarioDialog
        key={historialDe ? `${historialDe.tipo}-${historialDe.id}` : "cerrado"}
        prestatario={historialDe}
        onClose={() => setHistorialDe(null)}
      />
      <form onSubmit={buscar} className="card mb-4 flex max-w-2xl flex-wrap items-end gap-3">
        <label className="flex-1"><span className="label">Buscar préstamos activos e inactivos</span>
          <input className="input" autoFocus placeholder="Nombre, DNI, título o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
        <button className="btn" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
      </form>
      <Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg>
      {grupos.length > 0 && (
        <div className="card responsive-table-shell mt-4 overflow-x-auto p-0">
          <table className="responsive-table w-full min-w-[820px]">
            <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>
              {["#", "Prestatario", "Libros", "Unidades", "Prestado", "Vence", "Estado", ""].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {grupos.map((grupo) => {
                const activas = grupo.unidades.filter((unidad) => unidad.activo);
                return (
                  <tr key={grupo.prestamoId}>
                    <td className="td" data-label="#">#{grupo.prestamoId}</td>
                    <td className="td" data-label="Prestatario">
                      <button type="button" className="text-left font-medium hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        onClick={() => { const prestatario = seleccionarPrestatario(grupo.unidades[0]); if (prestatario) setHistorialDe(prestatario); }}>
                        {grupo.prestatario}
                      </button>
                      <p className="text-xs text-slate-500">{grupo.dni ?? "—"}{grupo.codigoAlumno ? ` / ${grupo.codigoAlumno}` : ""}</p>
                    </td>
                    <td className="td" data-label="Libros">
                      <span className="block max-w-[20rem] text-sm text-slate-600">
                        {grupo.libros.map((libro) => libro.unidades.length > 1 ? `${libro.titulo} ×${libro.unidades.length}` : libro.titulo).join("; ")}
                      </span>
                    </td>
                    <td className="td" data-label="Unidades">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
                        {grupo.unidades.length}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap" data-label="Prestado">{fecha(grupo.fechaPrestamo)}</td>
                    <td className={`td whitespace-nowrap ${grupo.vencido ? "font-medium text-red-700" : ""}`} data-label="Vence">{fecha(grupo.fechaPrevistaDevolucion)}{grupo.vencido ? " (vencido)" : ""}</td>
                    <td className="td" data-label="Estado">
                      {activas.length > 0
                        ? <span className="text-sm font-medium text-emerald-700">{activas.length} activa(s)</span>
                        : <span className="text-sm text-slate-500">Sin activas</span>}
                    </td>
                    <td className="td" data-label="Acción">
                      <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setGrupoAbiertoId(grupo.prestamoId)}>
                        Ver unidades
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <dialog
        ref={grupoRef}
        aria-labelledby="detalle-devolucion-title"
        onClose={() => setGrupoAbiertoId(null)}
        className="m-auto max-h-[90dvh] w-[min(46rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        {grupoAbierto && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-600">Préstamo #{grupoAbierto.prestamoId}</p>
                <h2 id="detalle-devolucion-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">{grupoAbierto.prestatario}</h2>
                <p className="mt-1 text-sm text-[#718096]">{grupoAbierto.dni ?? "—"}{grupoAbierto.codigoAlumno ? ` / ${grupoAbierto.codigoAlumno}` : ""}</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                aria-label="Cerrar ventana"
                onClick={() => grupoRef.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="grid gap-5 p-5 sm:p-6">
              <dl className="grid gap-3 rounded-xl border border-[#e6ecf4] bg-[#f7f9fc] p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Unidades</dt>
                  <dd className="mt-1 text-sm font-bold text-[#172b4d]">{grupoAbierto.unidades.length}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Activas</dt>
                  <dd className="mt-1 text-sm font-semibold text-emerald-700">{grupoAbierto.unidades.filter((unidad) => unidad.activo).length}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Prestado</dt>
                  <dd className="mt-1 text-sm text-[#334155]">{fecha(grupoAbierto.fechaPrestamo)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#718096]">Vence</dt>
                  <dd className={`mt-1 text-sm ${grupoAbierto.vencido ? "font-semibold text-red-700" : "text-[#334155]"}`}>
                    {fecha(grupoAbierto.fechaPrevistaDevolucion)}{grupoAbierto.vencido ? " (vencido)" : ""}
                  </dd>
                </div>
              </dl>
              <section aria-labelledby="devolucion-libros-title">
                <h3 id="devolucion-libros-title" className="mb-2 text-sm font-semibold text-[#172b4d]">Libros y unidades</h3>
                <div className="grid gap-2">
                  {grupoAbierto.libros.map((libro) => {
                    const activasLibro = libro.unidades.filter((unidad) => unidad.activo);
                    return (
                      <div key={libro.libroId} className="overflow-hidden rounded-xl border border-[#e6ecf4] bg-[#f7f9fc]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ecf4] px-3 py-2">
                          <span className="text-sm font-semibold text-[#172b4d]">
                            {libro.titulo}
                            {libro.unidades.length > 1 && <span className="ml-1 font-bold text-brand-700">×{libro.unidades.length}</span>}
                          </span>
                          {activasLibro.length > 1 && (
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => { setSeleccion(activasLibro); setGrupoAbiertoId(null); }}
                            >
                              Devolver todas ({activasLibro.length})
                            </button>
                          )}
                        </div>
                        <ul className="divide-y divide-[#eef2f7] bg-white">
                          {libro.unidades.map((unidad) => (
                            <li key={unidad.detalleId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                              <span className="font-mono text-xs text-slate-600">{unidad.codigoInterno ?? "Por cantidad"}</span>
                              <span className={`text-xs font-medium ${unidad.activo ? "text-emerald-700" : "text-slate-500"}`}>
                                {unidad.activo ? "Activa" : unidad.estadoDetalle === "PERDIDO" ? "Perdida" : "Devuelta"}
                              </span>
                              {unidad.activo
                                ? <button type="button" className="btn-ghost" onClick={() => { setSeleccion([unidad]); setGrupoAbiertoId(null); }}>Seleccionar</button>
                                : <span className="text-xs text-slate-400">No admite devolución</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <div className="flex justify-end border-t border-[#e6ecf4] px-5 py-4 sm:px-6">
              <button type="button" className="btn-ghost" onClick={() => grupoRef.current?.close()}>Cerrar</button>
            </div>
          </>
        )}
      </dialog>
      <dialog
        ref={seleccionRef}
        aria-labelledby="confirmar-devolucion-title"
        onClose={() => setSeleccion(null)}
        className="m-auto max-h-[90dvh] w-[min(40rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        {seleccion && seleccion.length > 0 && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-600">Confirmar devolución</p>
                <h2 id="confirmar-devolucion-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">
                  {seleccion.length === 1 ? seleccion[0].titulo : `${seleccion.length} unidades seleccionadas`}
                </h2>
                <p className="mt-1 text-sm text-[#718096]">
                  {seleccion[0].prestatario}{" · "}Prestado: {fecha(seleccion[0].fechaPrestamo)} · Vence: {fecha(seleccion[0].fechaPrevistaDevolucion)}{seleccion[0].vencido ? " (vencido)" : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                aria-label="Cerrar ventana"
                onClick={() => setSeleccion(null)}
              >
                ×
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:p-6">
              {seleccion.length > 1 && (
                <ul className="grid gap-1.5 rounded-xl border border-[#e6ecf4] bg-[#f7f9fc] p-3 text-sm text-slate-600">
                  {seleccion.map((unidad) => (
                    <li key={unidad.detalleId} className="flex items-center justify-between gap-2">
                      <span>{unidad.titulo}</span>
                      <span className="font-mono text-xs text-slate-500">{unidad.codigoInterno ?? "Por cantidad"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <label className="block"><span className="label">Estado en que regresa</span>
                <select className="input" value={res} onChange={(e) => setRes(e.target.value)}>
                  <option value="BUENO">Buena condición</option><option value="DETERIORADO">Deteriorado</option><option value="DANADO">Dañado</option><option value="PERDIDO">Perdido</option>
                </select></label>
              <label className="block"><span className="label">Observaciones</span><textarea className="input" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#e6ecf4] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" className="btn-ghost" onClick={() => setSeleccion(null)}>Cancelar</button>
              <button type="button" className="btn" onClick={confirmar}>Confirmar devolución{seleccion.length > 1 ? ` (${seleccion.length})` : ""}</button>
            </div>
          </>
        )}
      </dialog>
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Historial de devoluciones</h2>
            <p className="text-sm text-slate-500">{historial ? `${historial.total} registro(s)` : "Cargando…"}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label><span className="label">Buscar</span><input className="input" aria-label="Buscar en el historial de devoluciones"
              placeholder="Libro, prestatario o código" value={busquedaHistorial}
              onChange={(e) => { setBusquedaHistorial(e.target.value); setPaginaHistorial(1); }} /></label>
            <label><span className="label">Resultado</span><select className="input" value={resultadoHistorial}
              onChange={(e) => { setResultadoHistorial(e.target.value); setPaginaHistorial(1); }}>
              <option value="">Todos</option><option value="BUENO">Buena condición</option><option value="DETERIORADO">Deteriorado</option>
              <option value="DANADO">Dañado</option><option value="PERDIDO">Perdido</option>
            </select></label>
            <label><span className="label">Fecha de devolución</span><input type="date" className="input" value={fechaHistorial}
              onChange={(e) => { setFechaHistorial(e.target.value); setPaginaHistorial(1); }} /></label>
          </div>
        </div>
        <div className="card responsive-table-shell overflow-x-auto p-0">
          <table className="responsive-table w-full min-w-[720px]">
            <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>
              {["Fecha", "Libro", "Código", "Prestatario", "Resultado", "Observaciones"].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {historial?.items.map((item) => (
                <tr key={item.id}>
                  <td className="td whitespace-nowrap" data-label="Fecha">{fechaHora(item.fechaDevolucion)}</td>
                  <td className="td font-medium" data-label="Libro">{item.titulo}</td>
                  <td className="td font-mono text-sm" data-label="Código">{item.codigoInterno ?? "Por cantidad"}</td>
                  <td className="td" data-label="Prestatario">
                    <button type="button" className="text-left hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      onClick={() => { const prestatario = seleccionarPrestatario(item); if (prestatario) setHistorialDe(prestatario); }}>
                      {item.prestatario}
                    </button>
                  </td>
                  <td className="td" data-label="Resultado">{item.resultado === "BUENO" ? "Buena condición" : item.resultado === "DANADO" ? "Dañado" : item.resultado === "PERDIDO" ? "Perdido" : "Deteriorado"}</td>
                  <td className="td" data-label="Observaciones">{item.observaciones ?? "—"}</td>
                </tr>
              ))}
              {historial && historial.items.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>No hay devoluciones registradas.</td></tr>}
            </tbody>
          </table>
        </div>
        {historial && historial.total > historial.pageSize && (
          <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-600">
            <button className="btn-ghost" disabled={paginaHistorial <= 1} onClick={() => setPaginaHistorial((n) => n - 1)}>Anterior</button>
            <span>{paginaHistorial} / {Math.ceil(historial.total / historial.pageSize)}</span>
            <button className="btn-ghost" disabled={paginaHistorial >= Math.ceil(historial.total / historial.pageSize)} onClick={() => setPaginaHistorial((n) => n + 1)}>Siguiente</button>
          </div>
        )}
      </section>
    </>
  );
}
