"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api, fechaHora } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";

const ESTADOS = ["DISPONIBLE", "RESERVADO", "DANADO", "REPARACION", "PERDIDO", "BAJA"];
const CONDS = ["NUEVO", "BUENO", "REGULAR", "DETERIORADO"];

export default function EjemplarDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [e, setE] = useState<any>(null);
  const [h, setH] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [qrKey, setQrKey] = useState(0);

  const cargar = useCallback(async () => {
    try { setE(await api(`/ejemplares/${id}`)); setH(await api(`/ejemplares/${id}/historial`)); }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function patch(json: object, ok: string) {
    try { await api(`/ejemplares/${id}`, { method: "PATCH", json }); setMsg({ t: "ok", m: ok }); cargar(); }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  async function regenerar() {
    try { await api(`/ejemplares/${id}/qr`, { method: "POST", json: {} }); setQrKey((k) => k + 1); setMsg({ t: "ok", m: "QR regenerado" }); cargar(); }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  if (!e) return <Msg type="error">{msg?.m ?? "Cargando…"}</Msg>;
  const bloqueado = e.estado === "PRESTADO" || e.estado === "BAJA";
  return (
    <>
      <PageTitle action={<Link href={`/libros/${e.libroId}`} className="btn-ghost">Ver libro</Link>}>{e.codigoInterno} — {e.titulo}</PageTitle>
      {msg && <div className="mb-3 print:hidden"><Msg type={msg.t}>{msg.m}</Msg></div>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card text-center">
          {/* Etiqueta imprimible: QR + código escrito debajo */}
          <img key={qrKey} src={`/api/ejemplares/${id}/qr?v=${qrKey}`} alt={`QR de ${e.codigoInterno}`} className="mx-auto h-48 w-48" />
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{e.codigoInterno}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden">
            <a className="btn-ghost" href={`/api/ejemplares/${id}/qr?descargar=1`}>Descargar</a>
            <button className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
            <button className="btn-ghost" onClick={regenerar}>Regenerar</button>
          </div>
        </div>
        <div className="card space-y-3 md:col-span-2 print:hidden">
          <div className="flex flex-wrap items-center gap-3"><Badge v={e.estado} /><span className="text-sm text-slate-600">Condición: {e.condicion}</span></div>
          <p className="text-sm">Ubicación: {e.ubicacion ?? "Sin ubicación"}</p>
          {e.observaciones && <p className="text-sm text-slate-600">{e.observaciones}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Cambiar estado</span>
              <select className="input" disabled={bloqueado} value="" onChange={(ev) => ev.target.value && patch({ estado: ev.target.value }, "Estado actualizado")}>
                <option value="">{bloqueado ? (e.estado === "PRESTADO" ? "Prestado: usa Devoluciones" : "Dado de baja") : "Elegir…"}</option>
                {ESTADOS.filter((s) => s !== e.estado).map((s) => <option key={s} value={s}>{s === "DANADO" ? "Dañado" : s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select></label>
            <label><span className="label">Condición física</span>
              <select className="input" value={e.condicion} onChange={(ev) => patch({ condicion: ev.target.value }, "Condición actualizada")}>
                {CONDS.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
        </div>
      </div>
      <div className="card mt-4 overflow-x-auto p-0 print:hidden">
        <table className="w-full"><thead className="border-b bg-slate-50"><tr>{["Fecha", "Evento", "Detalle", "Registró"].map((x) => <th key={x} className="th">{x}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {h.map((x) => (
              <tr key={x.id}><td className="td whitespace-nowrap">{fechaHora(x.createdAt)}</td>
                <td className="td">{x.tipoEvento.replace(/_/g, " ").toLowerCase()}{x.estadoNuevo ? ` → ${x.estadoNuevo}` : ""}</td>
                <td className="td">{x.prestatario ? `${x.prestatario}. ` : ""}{x.detalle ?? ""}</td><td className="td">{x.usuario}</td></tr>))}
          </tbody></table>
      </div>
    </>
  );
}
