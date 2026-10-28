"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Field, Msg, PageTitle, useDebounced } from "@/components/ui";
import { HistorialPrestatarioDialog, type PrestatarioSeleccionado } from "@/components/HistorialPrestatarioDialog";
import AlumnosProfesoresTabs from "@/components/AlumnosProfesoresTabs";

const VACIO = { codigoAlumno: "", dni: "", nombres: "", apellidos: "", nivelEducativo: "SECUNDARIA", grado: "", seccion: "", telefono: "", correo: "", estado: "ACTIVO" };

export default function Alumnos() {
  const [qtxt, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Paged<any> | null>(null);
  const [f, setF] = useState(VACIO);
  const [abrir, setAbrir] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [historialDe, setHistorialDe] = useState<PrestatarioSeleccionado | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dq = useDebounced(qtxt);
  useEffect(() => { setPagina(1); }, [dq]);
  const cargar = useCallback(() => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: "50" });
    if (dq) params.set("q", dq);
    api<Paged<any>>(`/alumnos?${params}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [dq, pagina]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (abrir && !dialog.open) dialog.showModal();
    else if (!abrir && dialog.open) dialog.close();
  }, [abrir]);
  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((actual) => ({ ...actual, [k]: e.target.value }));
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
      <AlumnosProfesoresTabs actual="alumnos" />
      <PageTitle action={<button type="button" className="btn" onClick={nuevoAlumno}>Registrar alumno</button>}>Alumnos</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <HistorialPrestatarioDialog
        key={historialDe ? `${historialDe.tipo}-${historialDe.id}` : "cerrado"}
        prestatario={historialDe}
        onClose={() => setHistorialDe(null)}
      />
      <dialog
        ref={dialogRef}
        aria-labelledby="alumno-dialog-title"
        onCancel={() => setAbrir(false)}
        className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] px-5 py-4 sm:px-6">
          <div>
            <h2 id="alumno-dialog-title" className="text-lg font-semibold tracking-[-0.02em] text-[#172b4d]">{editarId ? "Editar alumno" : "Registrar alumno"}</h2>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d]" aria-label="Cerrar ventana" onClick={() => setAbrir(false)}>×</button>
        </div>
        <form onSubmit={crear} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Código de alumno *"><input className="input" required value={f.codigoAlumno} onChange={set("codigoAlumno")} /></Field>
          <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
          <Field label={`Nivel${!editarId ? " *" : ""}`}><select className="input" required={!editarId} value={f.nivelEducativo} onChange={set("nivelEducativo")}><option value="">—</option><option value="INICIAL">Inicial</option><option value="PRIMARIA">Primaria</option><option value="SECUNDARIA">Secundaria</option></select></Field>
          <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
          <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label={`Grado${!editarId ? " *" : ""}`}><input className="input" type="number" min={1} max={6} required={!editarId} value={f.grado} onChange={set("grado")} /></Field>
            <Field label={`Sección${!editarId ? " *" : ""}`}><input className="input" maxLength={5} required={!editarId} value={f.seccion} onChange={set("seccion")} /></Field></div>
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
      <input className="input mb-3 max-w-md" placeholder="Nombre, DNI o código" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <div className="card responsive-table-shell mt-3 overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[760px]"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["Código", "DNI", "Alumno", "Nivel", "Grado", "Sección", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((a) => (
              <tr key={a.id}><td className="td font-mono" data-label="Código">{a.codigoAlumno}</td><td className="td" data-label="DNI">{a.dni ?? "—"}</td><td className="td font-medium" data-label="Alumno">
                  <button type="button" className="text-left hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setHistorialDe({ id: a.id, tipo: "alumno", nombre: `${a.apellidos}, ${a.nombres}` })}>
                    {a.apellidos}, {a.nombres}
                  </button>
                </td>
                <td className="td" data-label="Nivel">{a.nivelEducativo ? a.nivelEducativo.charAt(0) + a.nivelEducativo.slice(1).toLowerCase() : "—"}</td><td className="td" data-label="Grado">{a.grado ?? "—"}</td><td className="td" data-label="Sección">{a.seccion ?? "—"}</td><td className="td" data-label="Estado"><Badge v={a.estado === "ACTIVO" ? "ACTIVO" : "BAJA"} /></td>
                <td className="td" data-label="Acciones"><button type="button" className="btn-ghost py-1" onClick={() => editarAlumno(a)}>Editar</button></td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>No hay alumnos registrados.</td></tr>}
          </tbody></table>
      </div>
      {data && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            {data.total === 0
              ? "0 alumnos"
              : `${(pagina - 1) * data.pageSize + 1}–${Math.min(pagina * data.pageSize, data.total)} de ${data.total} alumnos`}
          </span>
          {data.total > data.pageSize && (
            <div className="flex items-center gap-2">
              <button className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
              <span>{pagina} / {paginas}</span>
              <button className="btn-ghost" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
