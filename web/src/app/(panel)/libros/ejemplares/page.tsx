"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, useDebounced } from "@/components/ui";

export default function Ejemplares() {
  const [qtxt, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [data, setData] = useState<Paged<any> | null>(null);
  const [err, setErr] = useState("");
  const dq = useDebounced(qtxt);
  useEffect(() => {
    const p = new URLSearchParams({ pageSize: "50" });
    if (dq) p.set("q", dq);
    if (estado) p.set("estado", estado);
    api<Paged<any>>(`/ejemplares?${p}`).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message));
  }, [dq, estado]);
  return (
    <>
      <PageTitle action={<Link href="/libros" className="btn-ghost">Volver a libros</Link>}>Ejemplares</PageTitle>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input className="input sm:col-span-2" placeholder="Código (LIB-000123), título o ISBN" value={qtxt} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {["DISPONIBLE", "PRESTADO", "RESERVADO", "DANADO", "PERDIDO", "REPARACION", "BAJA"].map((s) => <option key={s} value={s}>{s === "DANADO" ? "Dañado" : s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
      </div>
      <Msg type="error">{err}</Msg>
      <div className="card responsive-table-shell overflow-x-auto p-0">
        <table className="responsive-table w-full min-w-[640px]"><thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>{["Código", "Título", "Estado", "Condición", "Ubicación"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#eef2f7]">
            {data?.items.map((e) => (
              <tr key={e.id} className="hover:bg-[#f7faff]">
                <td className="td font-medium" data-label="Código"><Link className="text-brand-700 hover:underline" href={`/libros/ejemplares/${e.id}`}>{e.codigoInterno}</Link></td>
                <td className="td" data-label="Título"><Link className="text-brand-700 hover:underline" href={`/libros/${e.libroId}`}>{e.titulo}</Link></td><td className="td" data-label="Estado"><Badge v={e.estado} /></td><td className="td" data-label="Condición">{e.condicion}</td><td className="td" data-label="Ubicación">{e.ubicacion ?? "—"}</td>
              </tr>))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>Sin resultados. Los ejemplares individuales se crean al registrar o ampliar un libro de control individual.</td></tr>}
          </tbody></table>
      </div>
      {data && <p className="mt-2 text-sm text-slate-500">{data.total} ejemplar(es)</p>}
    </>
  );
}
