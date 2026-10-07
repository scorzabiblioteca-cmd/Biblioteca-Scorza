"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Field, Msg, PageTitle, useDebounced } from "@/components/ui";

const VACIO = { codigoAlumno: "", dni: "", nombres: "", apellidos: "", nivelEducativo: "SECUNDARIA", grado: "", seccion: "", telefono: "", correo: "", estado: "ACTIVO" };

export default function Alumnos() {
  const [qtxt, setQ] = useState("");
  const [data, setData] = useState<Paged<any> | null>(null);
  const [f, setF] = useState(VACIO);
  const [abrir, setAbrir] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dq = useDebounced(qtxt);
  const cargar = useCallback(() => {
    api<Paged<any>>(`/alumnos?pageSize=50${dq ? `&q=${encodeURIComponent(dq)}` : ""}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [dq]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (abrir && !dialog.open) dialog.showModal();
    else if (!abrir && dialog.open) dialog.close();
  }, [abrir]);
  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((actual) => ({ ...actual, [k]: e.target.value }));

  function nuevoAlumno() {
    setF(VACIO);
    setEditarId(null);
    setMsg(null);
    setAbrir(true);
  }

  function editarAlumno(alumno: any) {
    setF({
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
    });
    setEditarId(alumno.id);
    setMsg(null);
    setAbrir(true);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(editarId ? `/alumnos/${editarId}` : "/alumnos", {
        method: editarId ? "PUT" : "POST",
        json: { ...f, nivelEducativo: f.nivelEducativo || null },
      });
      setMsg({ t: "ok", m: editarId ? "Alumno actualizado correctamente" : "Alumno registrado correctamente" });
      setF(VACIO); setEditarId(null); setAbrir(false); cargar();
    }
    catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PageTitle action={<button type="button" className="btn" onClick={nuevoAlumno}>Registrar alumno</button>}>Alumnos</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <dialog
        ref={dialogRef}
        aria-labelledby="alumno-dialog-title"
        onCancel={() => setAbrir(false)}
        className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="alumno-dialog-title" className="text-lg font-semibold text-slate-900">{editarId ? "Editar alumno" : "Registrar alumno"}</h2>
            <p className="mt-1 text-sm text-slate-500">Completa la información del alumno.</p>
          </div>
          <button type="button" className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar ventana" onClick={() => setAbrir(false)}>×</button>
        </div>
        <form onSubmit={crear} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Código de alumno *"><input className="input" required value={f.codigoAlumno} onChange={set("codigoAlumno")} /></Field>
          <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
          <Field label="Nivel"><select className="input" value={f.nivelEducativo} onChange={set("nivelEducativo")}><option value="">—</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option><option value="SECUNDARIA">Secundaria</option></select></Field>
          <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
          <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Grado"><input className="input" type="number" min={1} max={6} value={f.grado} onChange={set("grado")} /></Field>
            <Field label="Sección"><input className="input" maxLength={5} value={f.seccion} onChange={set("seccion")} /></Field></div>
          <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.correo} onChange={set("correo")} /></Field>
          {editarId && <Field label="Estado"><select className="input" value={f.estado} onChange={set("estado")}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="RETIRADO">Retirado</option></select></Field>}
          {msg?.t === "error" && <div className="sm:col-span-2"><Msg type="error">{msg.m}</Msg></div>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => setAbrir(false)}>Cancelar</button>
            <button className="btn">{editarId ? "Guardar cambios" : "Guardar alumno"}</button>
          </div>
        </form>
      </dialog>
      <input className="input mb-3 max-w-md" placeholder="Buscar por nombre, DNI o código" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <div className="card responsive-table-shell mt-3 overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[700px]"><thead className="border-b bg-slate-50"><tr>{["Código", "DNI", "Alumno", "Grado", "Sección", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((a) => (
              <tr key={a.id}><td className="td font-mono" data-label="Código">{a.codigoAlumno}</td><td className="td" data-label="DNI">{a.dni ?? "—"}</td><td className="td font-medium" data-label="Alumno">{a.apellidos}, {a.nombres}</td>
                <td className="td" data-label="Grado">{a.grado ?? "—"}</td><td className="td" data-label="Sección">{a.seccion ?? "—"}</td><td className="td" data-label="Estado"><Badge v={a.estado === "ACTIVO" ? "ACTIVO" : "BAJA"} /></td>
                <td className="td" data-label="Acciones"><button type="button" className="btn-ghost py-1" onClick={() => editarAlumno(a)}>Editar</button></td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay alumnos registrados.</td></tr>}
          </tbody></table>
      </div>
    </>
  );
}
