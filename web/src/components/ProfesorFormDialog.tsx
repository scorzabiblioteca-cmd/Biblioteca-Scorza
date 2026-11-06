"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Field, Msg } from "@/components/ui";

export type ProfesorGuardado = {
  id: number;
  dni: string | null;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  area: string | null;
  estado: string;
  createdAt: string;
};

export type ProfesorEditable = ProfesorGuardado;

const VACIO = { dni: "", nombres: "", apellidos: "", correo: "", telefono: "", area: "", estado: "ACTIVO" };

export function ProfesorFormDialog({ open, profesor, onClose, onSaved }: {
  open: boolean;
  profesor?: ProfesorEditable | null;
  onClose: () => void;
  onSaved?: (profesor: ProfesorGuardado) => void;
}) {
  const [f, setF] = useState(VACIO);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editando = Boolean(profesor);

  useEffect(() => {
    if (!open) return;
    setF(profesor ? {
      dni: profesor.dni ?? "",
      nombres: profesor.nombres,
      apellidos: profesor.apellidos,
      correo: profesor.correo ?? "",
      telefono: profesor.telefono ?? "",
      area: profesor.area ?? "",
      estado: profesor.estado,
    } : VACIO);
    setMsg(null);
  }, [open, profesor]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((actual) => ({ ...actual, [k]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    try {
      const guardado = await api<ProfesorGuardado>(profesor ? `/profesores/${profesor.id}` : "/profesores", {
        method: profesor ? "PUT" : "POST",
        json: f,
      });
      onSaved?.(guardado);
      onClose();
    } catch (x) {
      setMsg({ t: "error", m: (x as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="profesor-form-title"
      onCancel={() => onClose()}
      onClose={() => onClose()}
      className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
        <div>
          <h2 id="profesor-form-title" className="text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">{editando ? "Editar profesor" : "Registrar profesor"}</h2>
        </div>
        <button type="button" className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d]" aria-label="Cerrar ventana" onClick={onClose}>×</button>
      </div>
      <form onSubmit={guardar} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
        <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
        <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
        <Field label="Correo"><input className="input" type="email" value={f.correo} onChange={set("correo")} /></Field>
        <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Field>
        <Field label="Área"><input className="input" value={f.area} onChange={set("area")} /></Field>
        {editando && <Field label="Estado"><select className="input" value={f.estado} onChange={set("estado")}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>}
        {msg?.t === "error" && <div className="sm:col-span-2"><Msg type="error">{msg.m}</Msg></div>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={guardando}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar profesor"}</button>
        </div>
      </form>
    </dialog>
  );
}
