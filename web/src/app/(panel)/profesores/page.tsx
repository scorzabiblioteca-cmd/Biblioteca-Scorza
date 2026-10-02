"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Field, Msg, PageTitle, useDebounced } from "@/components/ui";

const VACIO = { dni: "", nombres: "", apellidos: "", correo: "", telefono: "", area: "" };

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
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dq = useDebounced(qtxt);

  useEffect(() => { setPagina(1); }, [dq]);
  const cargar = useCallback(() => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: "50" });
    if (dq) params.set("q", dq);
    api<Paged<Profesor>>(`/profesores?${params}`).then(setData).catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [dq, pagina]);
  useEffect(() => { cargar(); }, [cargar]);

  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/profesores", { json: f });
      setMsg({ t: "ok", m: "Profesor registrado correctamente" });
      setF(VACIO); setAbrir(false); cargar();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageTitle action={<button type="button" className="btn" onClick={() => setAbrir(!abrir)}>{abrir ? "Cerrar" : "Registrar profesor"}</button>}>Profesores</PageTitle>
      {abrir && (
        <form onSubmit={crear} className="card mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="DNI"><input className="input" value={f.dni} onChange={set("dni")} inputMode="numeric" /></Field>
          <Field label="Nombres *"><input className="input" required value={f.nombres} onChange={set("nombres")} /></Field>
          <Field label="Apellidos *"><input className="input" required value={f.apellidos} onChange={set("apellidos")} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.correo} onChange={set("correo")} /></Field>
          <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set("telefono")} /></Field>
          <Field label="Área"><input className="input" value={f.area} onChange={set("area")} /></Field>
          <div className="flex items-end"><button className="btn">Guardar profesor</button></div>
        </form>
      )}
      <input className="input mb-3 max-w-md" placeholder="Buscar por nombre o DNI" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg>
      <div className="card mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b bg-slate-50"><tr>{["DNI", "Profesor", "Área", "Teléfono", "Correo", "Estado"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((profesor) => (
              <tr key={profesor.id}>
                <td className="td">{profesor.dni ?? "—"}</td>
                <td className="td font-medium">{profesor.apellidos}, {profesor.nombres}</td>
                <td className="td">{profesor.area ?? "—"}</td>
                <td className="td">{profesor.telefono ?? "—"}</td>
                <td className="td">{profesor.correo ?? "—"}</td>
                <td className="td"><Badge v={profesor.estado} /></td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>No hay profesores registrados.</td></tr>}
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