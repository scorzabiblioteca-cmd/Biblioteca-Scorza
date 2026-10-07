"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Field, Msg, PageTitle, useDebounced } from "@/components/ui";

const VACIO = { dni: "", nombres: "", apellidos: "", correo: "", telefono: "", area: "", estado: "ACTIVO" };

type Profesor = {
  id: number;
  dni: string | null;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  area: string | null;
  estado: string;
};

export default function Profesores() {
  const [qtxt, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Paged<Profesor> | null>(null);
  const [f, setF] = useState(VACIO);
  const [abrir, setAbrir] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dq = useDebounced(qtxt);

  useEffect(() => { setPagina(1); }, [dq]);
  const cargar = useCallback(() => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: "50" });
    if (dq) params.set("q", dq);
    api<Paged<Profesor>>(`/profesores?${params}`).then(setData).catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [dq, pagina]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (abrir && !dialog.open) dialog.showModal();
    else if (!abrir && dialog.open) dialog.close();
  }, [abrir]);

  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((actual) => ({ ...actual, [k]: e.target.value }));

  function nuevoProfesor() {
    setF(VACIO);
    setEditarId(null);
    setMsg(null);
    setAbrir(true);
  }

  function editarProfesor(profesor: Profesor) {
    setF({
      dni: profesor.dni ?? "",
      nombres: profesor.nombres,
      apellidos: profesor.apellidos,
      correo: profesor.correo ?? "",
      telefono: profesor.telefono ?? "",
      area: profesor.area ?? "",
      estado: profesor.estado,
    });
    setEditarId(profesor.id);
    setMsg(null);
    setAbrir(true);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(editarId ? `/profesores/${editarId}` : "/profesores", { method: editarId ? "PUT" : "POST", json: f });
      setMsg({ t: "ok", m: editarId ? "Profesor actualizado correctamente" : "Profesor registrado correctamente" });
      setF(VACIO); setEditarId(null); setAbrir(false); cargar();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageTitle action={<button type="button" className="btn" onClick={nuevoProfesor}>Registrar profesor</button>}>Profesores</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <dialog
        ref={dialogRef}
        aria-labelledby="profesor-dialog-title"
        onCancel={() => setAbrir(false)}
        className="m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="profesor-dialog-title" className="text-lg font-semibold text-slate-900">{editarId ? "Editar profesor" : "Registrar profesor"}</h2>
            <p className="mt-1 text-sm text-slate-500">Completa la información del profesor.</p>
          </div>
          <button type="button" className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar ventana" onClick={() => setAbrir(false)}>×</button>
        </div>
        <form onSubmit={crear} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
          <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
          <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.correo} onChange={set("correo")} /></Field>
          <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Field>
          <Field label="Área"><input className="input" value={f.area} onChange={set("area")} /></Field>
          {editarId && <Field label="Estado"><select className="input" value={f.estado} onChange={set("estado")}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>}
          {msg?.t === "error" && <div className="sm:col-span-2"><Msg type="error">{msg.m}</Msg></div>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => setAbrir(false)}>Cancelar</button>
            <button className="btn">{editarId ? "Guardar cambios" : "Guardar profesor"}</button>
          </div>
        </form>
      </dialog>
      <input className="input mb-3 max-w-md" placeholder="Buscar por nombre o DNI" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <div className="card responsive-table-shell mt-3 overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[640px]">
          <thead className="border-b bg-slate-50"><tr>{["DNI", "Profesor", "Área", "Teléfono", "Correo", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((profesor) => (
              <tr key={profesor.id}>
                <td className="td" data-label="DNI">{profesor.dni ?? "—"}</td>
                <td className="td font-medium" data-label="Profesor">{profesor.apellidos}, {profesor.nombres}</td>
                <td className="td" data-label="Área">{profesor.area ?? "—"}</td>
                <td className="td" data-label="Teléfono">{profesor.telefono ?? "—"}</td>
                <td className="td" data-label="Correo">{profesor.correo ?? "—"}</td>
                <td className="td" data-label="Estado"><Badge v={profesor.estado} /></td>
                <td className="td" data-label="Acciones"><button type="button" className="btn-ghost py-1" onClick={() => editarProfesor(profesor)}>Editar</button></td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay profesores registrados.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.total > data.pageSize && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-600">
          <button className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
          <span>{pagina} / {paginas}</span>
          <button className="btn-ghost" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
        </div>
      )}
    </>
  );
}