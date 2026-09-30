"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fecha, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle } from "@/components/ui";
import { AlumnoAutocomplete, type Alumno } from "@/components/AlumnoAutocomplete";
import { EjemplarAutocomplete, type LibroCantidad } from "@/components/EjemplarAutocomplete";

export default function Prestamos() {
  const [data, setData] = useState<Paged<any> | null>(null);
  const [filtro, setFiltro] = useState("");
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [cantidades, setCantidades] = useState<LibroCantidad[]>([]);
  const [codigos, setCodigos] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  const cargar = useCallback(() => {
    const p = new URLSearchParams({ pageSize: "30" });
    if (filtro === "vencidos") p.set("vencidos", "true"); else if (filtro) p.set("estado", filtro);
    api<Paged<any>>(`/prestamos?${p}`).then(setData).catch((e) => setMsg({ t: "error", m: e.message }));
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!alumno) {
      setMsg({ t: "error", m: "Selecciona un alumno registrado de las sugerencias." });
      return;
    }
    const items = [...codigos.split(/[\s,;]+/).filter(Boolean).map((c) => ({ codigoEjemplar: c })),
      ...cantidades.map(({ libroId, cantidad }) => ({ libroId, cantidad }))];
    try {
      await api("/prestamos", { json: { alumnoId: alumno.id, items } });
      setCantidades([]);
      setFormVersion((v) => v + 1);
      setMsg({ t: "ok", m: "Préstamo registrado correctamente" }); setCodigos(""); setAlumno(null); cargar();
    } catch (x) { setMsg({ t: "error", m: (x as Error).message }); }
  }
  return (
    <>
      <PageTitle>Préstamos</PageTitle>
      <form onSubmit={crear} className="card mb-4 grid gap-3 sm:grid-cols-3">
        <AlumnoAutocomplete value={alumno} onChange={setAlumno} />
        <EjemplarAutocomplete key={formVersion} codigos={codigos} onChange={setCodigos} cantidades={cantidades} onCantidadesChange={setCantidades} />
        <div className="sm:col-span-3 space-y-2"><Msg type={msg?.t ?? "ok"}>{msg?.m}</Msg><button className="btn">Registrar préstamo</button>
          <p className="text-xs text-slate-500">Busca por título, código, ISBN o categoría y agrega los libros al préstamo.</p></div>
      </form>
      <select className="input mb-3 max-w-xs" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtro">
        <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="vencidos">Vencidos</option><option value="CERRADO">Cerrados</option>
      </select>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px]"><thead className="border-b bg-slate-50"><tr>{["#", "Prestatario", "Libros", "Préstamo", "Devolver antes de", "Estado", "Registró"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((p) => (
              <tr key={p.id}><td className="td">{p.id}</td><td className="td font-medium">{p.prestatario}</td><td className="td">{p.items}</td>
                <td className="td">{fecha(p.fechaPrestamo)}</td>
                <td className={`td ${p.vencido ? "font-medium text-red-700" : ""}`}>{fecha(p.fechaPrevistaDevolucion)}{p.vencido ? " (vencido)" : ""}</td>
                <td className="td"><Badge v={p.estado === "CERRADO" ? "BAJA" : "PRESTADO"} /><span className="sr-only">{p.estado}</span></td><td className="td">{p.registradoPor}</td></tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No hay préstamos todavía.</td></tr>}
          </tbody></table>
      </div>
    </>
  );
}
