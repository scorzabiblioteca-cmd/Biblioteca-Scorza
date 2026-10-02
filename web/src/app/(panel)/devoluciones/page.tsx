"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fecha, fechaHora, Paged } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

type DevolucionHistorial = {
  id: number;
  fechaDevolucion: string;
  resultado: string;
  observaciones: string | null;
  titulo: string;
  codigoInterno: string | null;
  prestatario: string;
};

export default function Devoluciones() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [p, setP] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState("BUENO");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [historial, setHistorial] = useState<Paged<DevolucionHistorial> | null>(null);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");

  const cargarHistorial = useCallback(() => {
    const params = new URLSearchParams({ page: String(paginaHistorial), pageSize: "20" });
    if (busquedaHistorial.trim()) params.set("q", busquedaHistorial.trim());
    return api<Paged<DevolucionHistorial>>(`/devoluciones?${params}`).then(setHistorial)
      .catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [paginaHistorial, busquedaHistorial]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

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
      await cargarHistorial();
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
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Historial de devoluciones</h2>
            <p className="text-sm text-slate-500">{historial ? `${historial.total} registro(s)` : "Cargando…"}</p>
          </div>
          <input className="input max-w-sm" aria-label="Buscar en el historial de devoluciones"
            placeholder="Buscar libro, prestatario o código" value={busquedaHistorial}
            onChange={(e) => { setBusquedaHistorial(e.target.value); setPaginaHistorial(1); }} />
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px]">
            <thead className="border-b bg-slate-50"><tr>
              {["Fecha", "Libro", "Código", "Prestatario", "Resultado", "Observaciones"].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {historial?.items.map((item) => (
                <tr key={item.id}>
                  <td className="td whitespace-nowrap">{fechaHora(item.fechaDevolucion)}</td>
                  <td className="td font-medium">{item.titulo}</td>
                  <td className="td font-mono text-sm">{item.codigoInterno ?? "Por cantidad"}</td>
                  <td className="td">{item.prestatario}</td>
                  <td className="td">{item.resultado === "BUENO" ? "Buena condición" : item.resultado === "DANADO" ? "Dañado" : item.resultado === "PERDIDO" ? "Perdido" : "Deteriorado"}</td>
                  <td className="td">{item.observaciones ?? "—"}</td>
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
