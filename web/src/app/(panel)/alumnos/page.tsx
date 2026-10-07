"use client";
import { useCallback, useEffect, useState } from "react";
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
  const dq = useDebounced(qtxt);
  const cargar = useCallback(() => {
    api<Paged<any>>(`/alumnos?pageSize=50${dq ? `&q=${encodeURIComponent(dq)}` : ""}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [dq]);
  useEffect(() => { cargar(); }, [cargar]);
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
      <PageTitle action={<button type="button" className="btn" onClick={abrir ? () => setAbrir(false) : nuevoAlumno}>{abrir ? "Cerrar" : "Registrar alumno"}</button>}>Alumnos</PageTitle>
      {abrir && (
        <form onSubmit={crear} className="card mb-4 grid gap-3 sm:grid-cols-3">
          <h2 className="text-lg font-semibold sm:col-span-3">{editarId ? "Editar alumno" : "Registrar alumno"}</h2>
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
          <div className="flex items-end gap-2"><button className="btn">{editarId ? "Guardar cambios" : "Guardar alumno"}</button><button type="button" className="btn-ghost" onClick={() => setAbrir(false)}>Cancelar</button></div>
          <div className="sm:col-span-3"><Msg type={msg?.t ?? "error"}>{msg?.t === "error" ? msg.m : ""}</Msg></div>
        </form>
      )}
      <input className="input mb-3 max-w-md" placeholder="Buscar por nombre, DNI o código" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg>
      <div className="card mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[700px]"><thead className="border-b bg-slate-50"><tr>{["Código", "DNI", "Alumno", "Grado", "Sección", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((a) => (
              <tr key={a.id}><td className="td font-mono">{a.codigoAlumno}</td><td className="td">{a.dni ?? "—"}</td><td className="td font-medium">{a.apellidos}, {a.nombres}</td>
                <td className="td">{a.grado ?? "—"}</td><td className="td">{a.seccion ?? "—"}</td><td className="td"><Badge v={a.estado === "ACTIVO" ? "ACTIVO" : "BAJA"} /></td>
                <td className="td"><button type="button" className="btn-ghost py-1" onClick={() => editarAlumno(a)}>Editar</button></td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay alumnos registrados.</td></tr>}
          </tbody></table>
      </div>
    </>
  );
}
