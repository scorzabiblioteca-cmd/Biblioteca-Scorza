"use client";
import { useState } from "react";
import { api, fecha } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

export default function Devoluciones() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [p, setP] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState("BUENO");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setP(null); setBuscando(true);
    try {
      const params = new URLSearchParams({ q: busqueda.trim() });
      const data = await api<{ items: any[] }>(`/prestamos/activo?${params}`);
      setResultados(data.items);
      if (data.items.length === 0) setMsg({ t: "error", m: "No se encontraron préstamos activos." });
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
    finally { setBuscando(false); }
  }
  async function confirmar() {
    try {
      await api("/devoluciones", { json: { prestamoDetalleId: p.detalleId, resultado: res, observaciones: obs } });
      setMsg({ t: "ok", m: "Devolución registrada correctamente" });
      setP(null); setResultados((items) => items.filter((item) => item.detalleId !== p.detalleId));
      setBusqueda(""); setObs(""); setRes("BUENO");
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PageTitle>Devoluciones</PageTitle>
      <form onSubmit={buscar} className="card mb-4 flex max-w-2xl flex-wrap items-end gap-3">
        <label className="flex-1"><span className="label">Buscar préstamo activo</span>
          <input className="input" autoFocus placeholder="Nombre, DNI, código, título, ISBN o ejemplar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
        <button className="btn" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
      </form>
      <Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg>
      {resultados.length > 0 && !p && (
        <div className="card mt-4 max-w-3xl overflow-x-auto p-0">
          <table className="w-full min-w-[600px]"><thead className="border-b bg-slate-50"><tr>
            {["Libro", "Código", "Prestatario", "DNI / código", "Vence", ""].map((h) => <th key={h} className="th">{h}</th>)}
          </tr></thead><tbody className="divide-y divide-slate-100">
            {resultados.map((item) => <tr key={item.detalleId}>
              <td className="td font-medium">{item.titulo}</td>
              <td className="td font-mono text-sm">{item.codigoInterno ?? "Por cantidad"}</td>
              <td className="td">{item.prestatario}</td>
              <td className="td">{item.dni ?? "—"}{item.codigoAlumno ? ` / ${item.codigoAlumno}` : ""}</td>
              <td className={`td whitespace-nowrap ${item.vencido ? "font-medium text-red-700" : ""}`}>{fecha(item.fechaPrevistaDevolucion)}{item.vencido ? " (vencido)" : ""}</td>
              <td className="td"><button type="button" className="btn" onClick={() => setP(item)}>Seleccionar</button></td>
            </tr>)}
          </tbody></table>
        </div>
      )}
      {p && (
        <div className="card mt-4 max-w-xl space-y-3">
          <div><p className="font-medium">{p.titulo}</p><p className="font-mono text-sm text-slate-500">{p.codigoInterno ?? "Préstamo por cantidad"}</p></div>
          <p className="text-sm">Prestado a <b>{p.prestatario}</b> el {fecha(p.fechaPrestamo)}. Fecha prevista: {fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " — vencido" : ""}.</p>
          <label className="block"><span className="label">Estado en que regresa</span>
            <select className="input" value={res} onChange={(e) => setRes(e.target.value)}>
              <option value="BUENO">Buena condición</option><option value="DETERIORADO">Deteriorado</option><option value="DANADO">Dañado</option><option value="PERDIDO">Perdido</option>
            </select></label>
          <label className="block"><span className="label">Observaciones</span><textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div className="flex gap-2"><button className="btn" onClick={confirmar}>Confirmar devolución</button>
            <button type="button" className="btn-ghost" onClick={() => setP(null)}>Cancelar</button></div>
        </div>
      )}
    </>
  );
}
