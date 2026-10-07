"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";

type Detalle = any;

export default function LibroDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [l, setL] = useState<Detalle | null>(null);
  const [ubis, setUbis] = useState<{ id: number; codigo: string }[]>([]);
  const [cant, setCant] = useState("1");
  const [ubi, setUbi] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  const cargar = useCallback(() => api(`/libros/${id}`).then(setL).catch((e) => setMsg({ t: "error", m: e.message })), [id]);
  useEffect(() => { cargar(); api<any[]>("/ubicaciones").then(setUbis).catch(() => {}); }, [cargar]);

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
            {l.imagenUrl ? <img src={l.imagenUrl} alt="Portada" className="h-40 w-28 rounded object-cover" /> : <div className="h-40 w-28 rounded bg-slate-100" />}
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
      <div className="card mt-4 overflow-x-auto p-0">
        {indiv ? (
          <table className="w-full"><thead className="border-b bg-slate-50"><tr>{["Código", "Estado", "Condición", "Ubicación"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {l.ejemplares.map((e: any) => (
                <tr key={e.id}><td className="td font-medium"><Link className="text-brand-700 hover:underline" href={`/ejemplares/${e.id}`}>{e.codigoInterno}</Link></td>
                  <td className="td"><Badge v={e.estado} /></td><td className="td">{e.condicion}</td><td className="td">{e.ubicacion ?? "—"}</td></tr>))}
              {l.ejemplares.length === 0 && <tr><td className="td text-slate-500" colSpan={4}>Aún no hay ejemplares.</td></tr>}
            </tbody></table>
        ) : (
          <table className="w-full"><thead className="border-b bg-slate-50"><tr>{["Ubicación", "Total", "Dañados", "Perdidos", "De baja"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {l.existencias.map((x: any) => <tr key={x.id}><td className="td">{x.ubicacion ?? "Sin ubicación"}</td><td className="td">{x.cantidadTotal}</td><td className="td">{x.cantidadDanada}</td><td className="td">{x.cantidadPerdida}</td><td className="td">{x.cantidadBaja}</td></tr>)}
            </tbody></table>
        )}
      </div>
    </>
  );
}
