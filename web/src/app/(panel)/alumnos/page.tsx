"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, useDebounced } from "@/components/ui";
import { HistorialPrestatarioDialog, type PrestatarioSeleccionado } from "@/components/HistorialPrestatarioDialog";
import { AlumnoFormDialog, type AlumnoGuardado } from "@/components/AlumnoFormDialog";
import AlumnosProfesoresTabs from "@/components/AlumnosProfesoresTabs";

export default function Alumnos() {
  const [qtxt, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Paged<AlumnoGuardado> | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [editando, setEditando] = useState<AlumnoGuardado | null>(null);
  const [historialDe, setHistorialDe] = useState<PrestatarioSeleccionado | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const dq = useDebounced(qtxt);
  useEffect(() => { setPagina(1); }, [dq]);
  const cargar = useCallback(() => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: "10" });
    if (dq) params.set("q", dq);
    api<Paged<AlumnoGuardado>>(`/alumnos?${params}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [dq, pagina]);
  useEffect(() => { cargar(); }, [cargar]);
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function nuevoAlumno() {
    setEditando(null);
    setMsg(null);
    setAbrir(true);
  }

  function editarAlumno(alumno: AlumnoGuardado) {
    setEditando(alumno);
    setMsg(null);
    setAbrir(true);
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
      <AlumnoFormDialog
        open={abrir}
        alumno={editando}
        onClose={() => setAbrir(false)}
        onSaved={() => {
          setMsg({ t: "ok", m: editando ? "Alumno actualizado correctamente" : "Alumno registrado correctamente" });
          cargar();
        }}
      />
      <input className="input mb-3 max-w-md" placeholder="Nombre, DNI o código" value={qtxt} onChange={(e) => setQ(e.target.value)} />
      <div className="card responsive-table-shell mt-3 overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[760px]"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["Código", "DNI", "Alumno", "Nivel", "Grado", "Sección", "Estado", "Acciones"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((a) => (
              <tr key={a.id}><td className="td font-mono" data-label="Código">{a.codigoAlumno}</td><td className="td" data-label="DNI">{a.dni ?? "—"}</td><td className="td font-medium" data-label="Alumno">
                  <button type="button" className="text-left hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setHistorialDe({
                    id: a.id,
                    tipo: "alumno",
                    nombre: `${a.apellidos}, ${a.nombres}`,
                    codigoAlumno: a.codigoAlumno,
                    dni: a.dni,
                    nombres: a.nombres,
                    apellidos: a.apellidos,
                    nivelEducativo: a.nivelEducativo,
                    grado: a.grado,
                    seccion: a.seccion,
                    telefono: a.telefono,
                    correo: a.correo,
                    estado: a.estado,
                    fechaRegistro: a.fechaRegistro,
                  })}>
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
