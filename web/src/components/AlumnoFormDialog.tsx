"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Field, Msg } from "@/components/ui";

export type AlumnoGuardado = {
  id: number;
  codigoAlumno: string;
  dni: string | null;
  nombres: string;
  apellidos: string;
  nivelEducativo: string | null;
  grado: number | null;
  seccion: string | null;
  telefono: string | null;
  correo: string | null;
  estado: string;
  fechaRegistro: string;
};

export type AlumnoEditable = AlumnoGuardado;

const VACIO = { codigoAlumno: "", dni: "", nombres: "", apellidos: "", nivelEducativo: "SECUNDARIA", grado: "", seccion: "", telefono: "", correo: "", estado: "ACTIVO" };

export function AlumnoFormDialog({ open, alumno, onClose, onSaved }: {
  open: boolean;
  alumno?: AlumnoEditable | null;
  onClose: () => void;
  onSaved?: (alumno: AlumnoGuardado) => void;
}) {
  const [f, setF] = useState(VACIO);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editando = Boolean(alumno);

  useEffect(() => {
    if (!open) return;
    setF(alumno ? {
      codigoAlumno: alumno.codigoAlumno,
      dni: alumno.dni ?? "",
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      nivelEducativo: alumno.nivelEducativo ?? "",
      grado: alumno.grado == null ? "" : String(alumno.grado),
      seccion: alumno.seccion ?? "",
      telefono: alumno.telefono ?? "",
      correo: alumno.correo ?? "",
      estado: alumno.estado,
    } : VACIO);
    setMsg(null);
  }, [open, alumno]);

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
      const guardado = await api<AlumnoGuardado>(alumno ? `/alumnos/${alumno.id}` : "/alumnos", {
        method: alumno ? "PUT" : "POST",
        json: { ...f, nivelEducativo: f.nivelEducativo || null },
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
      aria-labelledby="alumno-form-title"
      onCancel={() => onClose()}
      onClose={() => onClose()}
      className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
        <div>
          <h2 id="alumno-form-title" className="text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">{editando ? "Editar alumno" : "Registrar alumno"}</h2>
        </div>
        <button type="button" className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d]" aria-label="Cerrar ventana" onClick={onClose}>×</button>
      </div>
      <form onSubmit={guardar} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Código de alumno *"><input className="input" required value={f.codigoAlumno} onChange={set("codigoAlumno")} /></Field>
        <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
        <Field label={`Nivel${!editando ? " *" : ""}`}><select className="input" required={!editando} value={f.nivelEducativo} onChange={set("nivelEducativo")}><option value="">—</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option><option value="SECUNDARIA">Secundaria</option></select></Field>
        <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
        <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label={`Grado${!editando ? " *" : ""}`}><input className="input" type="number" min={1} max={6} required={!editando} value={f.grado} onChange={set("grado")} /></Field>
          <Field label={`Sección${!editando ? " *" : ""}`}><input className="input" maxLength={5} required={!editando} value={f.seccion} onChange={set("seccion")} /></Field></div>
        <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Field>
        <Field label="Correo"><input className="input" type="email" value={f.correo} onChange={set("correo")} /></Field>
        {editando && <Field label="Estado"><select className="input" value={f.estado} onChange={set("estado")}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="RETIRADO">Retirado</option></select></Field>}
        {msg?.t === "error" && <div className="sm:col-span-2"><Msg type="error">{msg.m}</Msg></div>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={guardando}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar alumno"}</button>
        </div>
      </form>
    </dialog>
  );
}
