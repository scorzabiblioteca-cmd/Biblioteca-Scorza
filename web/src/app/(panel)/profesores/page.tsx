"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, useDebounced } from "@/components/ui";
import { HistorialPrestatarioDialog, type PrestatarioSeleccionado } from "@/components/HistorialPrestatarioDialog";
import { ProfesorFormDialog, type ProfesorGuardado } from "@/components/ProfesorFormDialog";
import AlumnosProfesoresTabs from "@/components/AlumnosProfesoresTabs";

export default function Profesores() {
  const [qtxt, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Paged<ProfesorGuardado> | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [editando, setEditando] = useState<ProfesorGuardado | null>(null);
  const [historialDe, setHistorialDe] = useState<PrestatarioSeleccionado | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dq = useDebounced(qtxt);

  useEffect(() => { setPagina(1); }, [dq]);
  const cargar = useCallback(() => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: "10" });
    if (dq) params.set("q", dq);
    api<Paged<ProfesorGuardado>>(`/profesores?${params}`).then(setData).catch((e: Error) => setMsg({ t: "error", m: e.message }));
  }, [dq, pagina]);
  useEffect(() => { cargar(); }, [cargar]);

  function nuevoProfesor() {
    setEditando(null);
    setMsg(null);
    setAbrir(true);
  }

  function editarProfesor(profesor: ProfesorGuardado) {
    setEditando(profesor);
    setMsg(null);
    setAbrir(true);
  }

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <AlumnosProfesoresTabs actual="profesores" />
      <PageTitle action={<button type="button" className="btn" onClick={nuevoProfesor}>Registrar profesor</button>}>Profesores</PageTitle>
      {msg?.t === "ok" && <Msg type="ok">{msg.m}</Msg>}
      <HistorialPrestatarioDialog
        key={historialDe ? `${historialDe.tipo}-${historialDe.id}` : "cerrado"}
        prestatario={historialDe}
        onClose={() => setHistorialDe(null)}
      />
      <ProfesorFormDialog
        open={abrir}
        profesor={editando}
        onClose={() => setAbrir(false)}
        onSaved={() => {
          setMsg({ t: "ok", m: editando ? "Profesor actualizado correctamente" : "Profesor registrado correctamente" });
          cargar();
        }}
      />
      <input className="input mb-3 max-w-md" placeholder="Nombre o DNI" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <div className="card responsive-table-shell mt-3 overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[640px]">
          <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["DNI", "Profesor", "Área", "Teléfono", "Correo", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((profesor) => (
              <tr key={profesor.id}>
                <td className="td" data-label="DNI">{profesor.dni ?? "—"}</td>
                <td className="td font-medium" data-label="Profesor">
                  <button type="button" className="text-left hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setHistorialDe({
                    id: profesor.id,
                    tipo: "profesor",
                    nombre: `${profesor.apellidos}, ${profesor.nombres}`,
                    dni: profesor.dni,
                    nombres: profesor.nombres,
                    apellidos: profesor.apellidos,
                    area: profesor.area,
                    telefono: profesor.telefono,
                    correo: profesor.correo,
                    estado: profesor.estado,
                    createdAt: profesor.createdAt,
                  })}>
                    {profesor.apellidos}, {profesor.nombres}
                  </button>
                </td>
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