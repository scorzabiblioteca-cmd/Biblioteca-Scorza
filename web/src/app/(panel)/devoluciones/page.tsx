"use client";
import { useState } from "react";
import { api, fecha } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

export default function Devoluciones() {
  const [codigo, setCodigo] = useState("");
  const [p, setP] = useState<any>(null);
  const [res, setRes] = useState("BUENO");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setP(null);
    try { setP(await api(`/prestamos/activo/ejemplar/${encodeURIComponent(codigo.trim())}`)); }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  async function confirmar() {
    try {
      await api("/devoluciones", { json: { codigoEjemplar: p.codigoInterno, resultado: res, observaciones: obs } });
      setMsg({ t: "ok", m: "Devolución registrada correctamente" }); setP(null); setCodigo(""); setObs(""); setRes("BUENO");
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PageTitle>Devoluciones</PageTitle>
      <form onSubmit={buscar} className="card mb-4 flex max-w-xl flex-wrap items-end gap-3">
        <label className="flex-1"><span className="label">Código del ejemplar</span>
          <input className="input" autoFocus placeholder="LIB-000123" value={codigo} onChange={(e) => setCodigo(e.target.value)} required /></label>
        <button className="btn">Buscar préstamo</button>
      </form>
      <Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg>
      {p && (
        <div className="card mt-4 max-w-xl space-y-3">
          <div><p className="font-medium">{p.titulo}</p><p className="font-mono text-sm text-slate-500">{p.codigoInterno}</p></div>
          <p className="text-sm">Prestado a <b>{p.prestatario}</b> el {fecha(p.fechaPrestamo)}. Fecha prevista: {fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " — vencido" : ""}.</p>
          <label className="block"><span className="label">Estado en que regresa</span>
            <select className="input" value={res} onChange={(e) => setRes(e.target.value)}>
              <option value="BUENO">Buena condición</option><option value="DETERIORADO">Deteriorado</option><option value="DANADO">Dañado</option><option value="PERDIDO">Perdido</option>
            </select></label>
          <label className="block"><span className="label">Observaciones</span><textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <button className="btn" onClick={confirmar}>Confirmar devolución</button>
        </div>
      )}
    </>
  );
}
