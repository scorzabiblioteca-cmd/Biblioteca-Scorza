"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fechaHora, Paged } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

type Notificacion = {
  id: number;
  tipo: "PRESTAMO" | "DEVOLUCION" | "INVENTARIO" | "VENCIDO" | "POR_VENCER";
  titulo: string;
  mensaje: string;
  enlace: string;
  leidaEn: string | null;
  createdAt: string;
};
type Bandeja = Paged<Notificacion> & { noLeidas: number };

const ETIQUETAS: Record<Notificacion["tipo"], string> = {
  PRESTAMO: "Préstamo",
  DEVOLUCION: "Devolución",
  INVENTARIO: "Inventario",
  VENCIDO: "Vencido",
  POR_VENCER: "Por vencer",
};

export default function NotificacionesPage() {
  const router = useRouter();
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setBandeja(await api<Bandeja>(`/notificaciones?page=${pagina}&pageSize=30`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [pagina]);
  useEffect(() => { cargar(); }, [cargar]);

  async function marcarTodas() {
    setOcupado(true);
    try {
      await api("/notificaciones/leer-todas", { method: "POST", json: {} });
      window.dispatchEvent(new Event("notificaciones:actualizadas"));
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function abrir(item: Notificacion) {
    if (!item.leidaEn) {
      try {
        await api(`/notificaciones/${item.id}`, { method: "PATCH", json: { leida: true } });
        window.dispatchEvent(new Event("notificaciones:actualizadas"));
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    router.push(item.enlace);
  }

  return (
    <>
      <PageTitle action={bandeja && bandeja.noLeidas > 0 ? (
        <button className="btn-ghost" disabled={ocupado} onClick={marcarTodas}>Marcar todas como leídas</button>
      ) : undefined}>Notificaciones</PageTitle>
      {error && <div className="mb-4"><Msg type="error">{error}</Msg></div>}
      {bandeja && (
        <p className="mb-3 text-sm text-slate-500">
          {bandeja.noLeidas} sin leer · {bandeja.total} en total
        </p>
      )}
      <div className="card divide-y divide-[#eef2f7] p-0">
        {bandeja?.items.map((item) => (
          <div key={item.id} className={`flex items-start gap-3 p-4 ${item.leidaEn ? "" : "bg-blue-50/60"}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.leidaEn ? "bg-slate-200" : "bg-brand-600"}`} aria-label={item.leidaEn ? "Leída" : "No leída"} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => abrir(item)}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#172b4d]">{item.titulo}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-600">{ETIQUETAS[item.tipo]}</span>
              </span>
              <span className="mt-1 block text-sm text-slate-600">{item.mensaje}</span>
              <span className="mt-1 block text-xs text-slate-400">{fechaHora(item.createdAt)}</span>
            </button>
            <Link href={item.enlace} className="btn-ghost shrink-0" onClick={(event) => {
              event.preventDefault();
              abrir(item);
            }}>Ver</Link>
          </div>
        ))}
        {!bandeja && !error && <p className="p-5 text-sm text-slate-500">Cargando notificaciones…</p>}
        {bandeja && bandeja.items.length === 0 && <p className="p-5 text-sm text-slate-500">No tienes notificaciones.</p>}
      </div>
      {bandeja && bandeja.total > bandeja.pageSize && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
          <button className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
          <span>{pagina} / {Math.ceil(bandeja.total / bandeja.pageSize)}</span>
          <button className="btn-ghost" disabled={pagina >= Math.ceil(bandeja.total / bandeja.pageSize)} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
        </div>
      )}
    </>
  );
}
