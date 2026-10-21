"use client";

import { useEffect, useRef, useState } from "react";
import { api, fecha, Paged } from "@/lib/client";
import { Badge, Msg } from "@/components/ui";

export type PrestatarioSeleccionado = {
  id: number;
  tipo: "alumno" | "profesor";
  nombre: string;
};

type PrestamoHistorial = {
  id: number;
  items: string | null;
  fechaPrestamo: string;
  fechaPrevistaDevolucion: string;
  fechaCierre: string | null;
  estado: string;
  vencido: boolean;
};

export function HistorialPrestatarioDialog({
  prestatario,
  onClose,
}: {
  prestatario: PrestatarioSeleccionado | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pagina, setPagina] = useState(1);
  const [historial, setHistorial] = useState<Paged<PrestamoHistorial> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (prestatario && !dialog.open) dialog.showModal();
    else if (!prestatario && dialog.open) dialog.close();
  }, [prestatario]);

  useEffect(() => {
    if (!prestatario) {
      setHistorial(null);
      setError(null);
      return;
    }
    let vigente = true;
    const parametro = prestatario.tipo === "alumno" ? "alumnoId" : "profesorId";
    const params = new URLSearchParams({ page: String(pagina), pageSize: "20", [parametro]: String(prestatario.id) });
    setCargando(true);
    setHistorial(null);
    setError(null);
    api<Paged<PrestamoHistorial>>(`/prestamos?${params}`)
      .then((resultado) => { if (vigente) setHistorial(resultado); })
      .catch((e: Error) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [pagina, prestatario]);

  const paginas = historial ? Math.max(1, Math.ceil(historial.total / historial.pageSize)) : 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="historial-prestatario-title"
      onCancel={onClose}
      className="m-auto max-h-[90dvh] w-[min(64rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
    >
      {prestatario && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
            <div>
              <h2 id="historial-prestatario-title" className="text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">Historial de préstamos</h2>
              <p className="mt-1 text-sm text-[#718096]">{prestatario.nombre}</p>
            </div>
            <button type="button" className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d]" aria-label="Cerrar ventana" onClick={onClose}>×</button>
          </div>
          <div className="p-5 sm:p-6">
            {historial && <p className="mb-3 text-sm text-slate-500">{historial.total} préstamo(s)</p>}
            {error && <Msg type="error">{error}</Msg>}
            {cargando && <p className="py-6 text-center text-sm text-slate-500">Cargando historial…</p>}
            {historial && (
              <>
                <div className="responsive-table-shell overflow-x-auto">
                  <table className="responsive-table w-full min-w-[720px]">
                    <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>
                      {["#", "Libros", "Préstamo", "Devolver antes de", "Devolución", "Estado"].map((titulo) => <th key={titulo} className="th">{titulo}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-[#eef2f7]">
                      {historial.items.map((prestamo) => (
                        <tr key={prestamo.id}>
                          <td className="td" data-label="#">{prestamo.id}</td>
                          <td className="td" data-label="Libros">{prestamo.items ?? "—"}</td>
                          <td className="td whitespace-nowrap" data-label="Préstamo">{fecha(prestamo.fechaPrestamo)}</td>
                          <td className={`td whitespace-nowrap ${prestamo.vencido ? "font-medium text-red-700" : ""}`} data-label="Devolver antes de">
                            {fecha(prestamo.fechaPrevistaDevolucion)}{prestamo.vencido ? " (vencido)" : ""}
                          </td>
                          <td className="td whitespace-nowrap" data-label="Devolución">{fecha(prestamo.fechaCierre)}</td>
                          <td className="td" data-label="Estado"><Badge v={prestamo.estado} /></td>
                        </tr>
                      ))}
                      {historial.items.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>No hay préstamos registrados para esta persona.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {historial.total > historial.pageSize && (
                  <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-600">
                    <button type="button" className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
                    <span>{pagina} / {paginas}</span>
                    <button type="button" className="btn-ghost" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
                  </div>
                )}
              </>
            )}
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
