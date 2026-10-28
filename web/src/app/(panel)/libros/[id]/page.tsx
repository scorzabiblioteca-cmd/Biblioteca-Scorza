"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api, fecha, fechaHora, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, Portada } from "@/components/ui";

type Detalle = any;
type MovimientoPrestamo = {
  id: number;
  estado: string;
  resultadoDevolucion: string | null;
  fechaDevolucion: string | null;
  prestamoId: number;
  tipoPrestatario: string;
  fechaPrestamo: string;
  fechaPrevistaDevolucion: string;
  codigoEjemplar: string | null;
  prestatario: string;
  registradoPor: string;
  devueltoPor: string | null;
};

export default function LibroDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [l, setL] = useState<Detalle | null>(null);
  const [historial, setHistorial] = useState<Paged<MovimientoPrestamo> | null>(null);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [ubis, setUbis] = useState<{ id: number; codigo: string }[]>([]);
  const [cant, setCant] = useState("1");
  const [ubi, setUbi] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  const cargar = useCallback(() => api(`/libros/${id}`).then(setL).catch((e) => setMsg({ t: "error", m: e.message })), [id]);
  useEffect(() => { cargar(); api<any[]>("/ubicaciones").then(setUbis).catch(() => {}); }, [cargar]);
  useEffect(() => {
    api<Paged<MovimientoPrestamo>>(`/libros/${id}/historial?page=${paginaHistorial}&pageSize=20`)
      .then((data) => { setHistorial(data); setErrorHistorial(null); })
      .catch((e) => setErrorHistorial(e.message));
  }, [id, paginaHistorial]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ codigos: string[] }>(`/libros/${id}/ejemplares`, { json: { cantidad: Number(cant), ubicacionId: ubi ? Number(ubi) : null } });
      setMsg({ t: "ok", m: r.codigos.length ? `Creados: ${r.codigos.join(", ")}` : "Stock actualizado" });
      cargar();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  async function archivar() {
    try { await api(`/libros/${id}`, { method: "PATCH", json: { archivado: l.estado === "ACTIVO" } }); cargar(); }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  if (!l) return <Msg type="error">{msg?.m ?? "Cargando…"}</Msg>;
  const indiv = l.tipoControl === "INDIVIDUAL";
  return (
    <>
      <PageTitle action={<div className="flex gap-2"><Link href={`/libros/${id}/editar`} className="btn">Editar información</Link><button className="btn-ghost" onClick={archivar}>{l.estado === "ACTIVO" ? "Archivar" : "Restaurar"}</button><Link href="/libros" className="btn-ghost">Volver</Link></div>}>{l.titulo}</PageTitle>
      {msg && <div className="mb-3"><Msg type={msg.t}>{msg.m}</Msg></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex gap-4">
            <Portada src={l.imagenUrl} titulo={l.titulo} className="h-40 w-28 rounded-lg" />
            <dl className="grid flex-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {[["ISBN", l.isbn], ["Autor", l.autores], ["Editorial", l.editorial], ["Categoría", l.categoria], ["Año", l.anioPublicacion],
                ["Edición", l.edicion], ["Idioma", l.idioma], ["Nivel", l.nivelEducativo], ["Grado", l.gradoRecomendado], ["Control", indiv ? "Individual" : "Por cantidad"]]
                .map(([k, v]) => <div key={k as string}><dt className="text-xs text-slate-500">{k}</dt><dd>{v ?? "—"}</dd></div>)}
            </dl>
          </div>
          {l.descripcion && <p className="mt-3 text-sm text-slate-600">{l.descripcion}</p>}
        </div>
        <div className="card grid grid-cols-2 gap-2 text-center">
          {[["Total", l.total], ["Disponibles", l.disponibles], ["Prestados", l.prestados], ["Dañados", l.danados], ["Perdidos", l.perdidos]].map(([k, v]) => (
            <div key={k as string}><p className="text-xs text-slate-500">{k}</p><p className="text-xl font-semibold">{v}</p></div>
          ))}
        </div>
      </div>
      <form onSubmit={agregar} className="card mt-4 flex flex-wrap items-end gap-3">
        <label><span className="label">{indiv ? "Ejemplares nuevos" : "Unidades a sumar"}</span><input className="input w-28" type="number" min={1} value={cant} onChange={(e) => setCant(e.target.value)} /></label>
        <label><span className="label">Ubicación</span>
          <select className="input" value={ubi} onChange={(e) => setUbi(e.target.value)}><option value="">Sin ubicación</option>{ubis.map((u) => <option key={u.id} value={u.id}>{u.codigo}</option>)}</select></label>
        <button className="btn">Agregar {indiv ? "ejemplar" : "stock"}</button>
      </form>
      <div className="card responsive-table-shell mt-4 overflow-x-auto p-0">
        {indiv ? (
          <table className="responsive-table w-full"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["Código", "Estado", "Condición", "Ubicación"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {l.ejemplares.map((e: any) => (
                <tr key={e.id}><td className="td font-medium" data-label="Código"><Link className="text-brand-700 hover:underline" href={`/libros/ejemplares/${e.id}`}>{e.codigoInterno}</Link></td>
                  <td className="td" data-label="Estado"><Badge v={e.estado} /></td><td className="td" data-label="Condición">{e.condicion}</td><td className="td" data-label="Ubicación">{e.ubicacion ?? "—"}</td></tr>))}
              {l.ejemplares.length === 0 && <tr><td className="td text-slate-500" colSpan={4}>Aún no hay ejemplares.</td></tr>}
            </tbody></table>
        ) : (
          <table className="responsive-table w-full"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["Ubicación", "Total", "Dañados", "Perdidos", "De baja"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {l.existencias.map((x: any) => <tr key={x.id}><td className="td" data-label="Ubicación">{x.ubicacion ?? "Sin ubicación"}</td><td className="td" data-label="Total">{x.cantidadTotal}</td><td className="td" data-label="Dañados">{x.cantidadDanada}</td><td className="td" data-label="Perdidos">{x.cantidadPerdida}</td><td className="td" data-label="De baja">{x.cantidadBaja}</td></tr>)}
            </tbody></table>
        )}
      </div>
      <section className="mt-6" aria-labelledby="historial-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="historial-heading" className="text-lg font-semibold text-slate-800">Historial de préstamos</h2>
            {historial && <p className="text-sm text-slate-500">{historial.total} unidad(es) prestada(s)</p>}
          </div>
        </div>
        {errorHistorial && <div className="mb-3"><Msg type="error">{errorHistorial}</Msg></div>}
        <div className="card responsive-table-shell overflow-x-auto p-0">
          <table className="responsive-table w-full">
            <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]">
              <tr>{["Fecha de préstamo", "Prestatario", "Ejemplar", "Devolución prevista", "Fecha de devolución", "Resultado", "Registró / devolución"].map((h) => <th key={h} className="th">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {historial?.items.map((item) => (
                <tr key={item.id}>
                  <td className="td whitespace-nowrap" data-label="Fecha de préstamo">{fechaHora(item.fechaPrestamo)}</td>
                  <td className="td" data-label="Prestatario">{item.prestatario}</td>
                  <td className="td" data-label="Ejemplar">{item.codigoEjemplar ?? "Por cantidad"}</td>
                  <td className="td whitespace-nowrap" data-label="Devolución prevista">{fecha(item.fechaPrevistaDevolucion)}</td>
                  <td className="td whitespace-nowrap" data-label="Fecha de devolución">{fechaHora(item.fechaDevolucion)}</td>
                  <td className="td" data-label="Resultado">{item.estado === "PRESTADO" ? "Prestado" : item.resultadoDevolucion === "BUENO" ? "Buena condición" : item.resultadoDevolucion === "DANADO" ? "Dañado" : item.resultadoDevolucion === "PERDIDO" ? "Perdido" : item.resultadoDevolucion === "DETERIORADO" ? "Deteriorado" : item.estado}</td>
                  <td className="td" data-label="Registró / devolución">{item.registradoPor}{item.devueltoPor ? ` / ${item.devueltoPor}` : ""}</td>
                </tr>
              ))}
              {historial && historial.items.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={7}>Este libro aún no registra préstamos.</td></tr>
              )}
              {!historial && !errorHistorial && (
                <tr><td className="td text-slate-500" colSpan={7}>Cargando historial…</td></tr>
              )}
            </tbody>
          </table>
          {historial && historial.total > historial.pageSize && (
            <div className="flex items-center justify-between gap-3 border-t border-[#e6ecf4] px-4 py-3 text-sm text-slate-600">
              <span>Página {historial.page} de {Math.ceil(historial.total / historial.pageSize)}</span>
              <div className="flex gap-2">
                <button className="btn-ghost" disabled={paginaHistorial <= 1} onClick={() => setPaginaHistorial((n) => n - 1)}>Anterior</button>
                <button className="btn-ghost" disabled={paginaHistorial >= Math.ceil(historial.total / historial.pageSize)} onClick={() => setPaginaHistorial((n) => n + 1)}>Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
