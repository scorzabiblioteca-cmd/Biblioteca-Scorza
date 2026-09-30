"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, useDebounced } from "@/components/ui";

type Libro = {
  id: number; titulo: string; autores: string | null; isbn: string | null; categoria: string | null; tipoControl: string;
  total: number; disponibles: number; prestados: number; ubicaciones: string | null; estado: string; imagenUrl: string | null;
};

export default function Libros() {
  const [qtxt, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [disp, setDisp] = useState("");
  const [estado, setEstado] = useState("ACTIVO");
  const [pageN, setPage] = useState(1);
  const [data, setData] = useState<Paged<Libro> | null>(null);
  const [err, setErr] = useState("");
  const dq = useDebounced(qtxt);

  useEffect(() => { setPage(1); }, [dq, tipo, disp, estado]);
  useEffect(() => {
    const p = new URLSearchParams({ page: String(pageN), pageSize: "20", estado });
    if (dq) p.set("q", dq);
    if (tipo) p.set("tipoControl", tipo);
    if (disp) p.set("disponibilidad", disp);
    api<Paged<Libro>>(`/libros?${p}`).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message));
  }, [dq, tipo, disp, estado, pageN]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageTitle action={<Link href="/libros/nuevo" className="btn">Registrar libro</Link>}>Libros</PageTitle>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input className="input sm:col-span-2" placeholder="Buscar por título, autor, ISBN, editorial, categoría, código o estante" value={qtxt} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de control">
          <option value="">Todo tipo de control</option><option value="CANTIDAD">Por cantidad</option><option value="INDIVIDUAL">Individual</option>
        </select>
        <select className="input" value={disp} onChange={(e) => setDisp(e.target.value)} aria-label="Disponibilidad">
          <option value="">Toda disponibilidad</option><option value="disponibles">Con disponibles</option><option value="prestados">Con prestados</option>
          <option value="danados">Con dañados</option><option value="perdidos">Con perdidos</option>
        </select>
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={estado === "todos"} onChange={(e) => setEstado(e.target.checked ? "todos" : "ACTIVO")} /> Incluir archivados
      </label>
      <Msg type="error">{err}</Msg>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr>
            {["", "Título", "Autor", "ISBN", "Categoría", "Control", "Total", "Disp.", "Prest.", "Ubicación", "Estado"].map((h) => <th key={h} className="th">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="td w-12">{l.imagenUrl ? <img src={l.imagenUrl} alt="" className="h-12 w-9 rounded object-cover" /> : <div className="h-12 w-9 rounded bg-slate-100" />}</td>
                <td className="td font-medium"><Link href={`/libros/${l.id}`} className="text-brand-700 hover:underline">{l.titulo}</Link></td>
                <td className="td">{l.autores ?? "—"}</td>
                <td className="td tabular-nums">{l.isbn ?? "—"}</td>
                <td className="td">{l.categoria ?? "—"}</td>
                <td className="td">{l.tipoControl === "CANTIDAD" ? "Cantidad" : "Individual"}</td>
                <td className="td tabular-nums">{l.total}</td>
                <td className="td tabular-nums">{l.disponibles}</td>
                <td className="td tabular-nums">{l.prestados}</td>
                <td className="td">{l.ubicaciones ?? "—"}</td>
                <td className="td"><Badge v={l.estado} /></td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={11}>No hay libros con esos criterios. Registra el primero con «Registrar libro».</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>{data ? `${data.total} título(s)` : ""}</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" disabled={pageN <= 1} onClick={() => setPage(pageN - 1)}>Anterior</button>
          <span>{pageN} / {pages}</span>
          <button className="btn-ghost" disabled={pageN >= pages} onClick={() => setPage(pageN + 1)}>Siguiente</button>
        </div>
      </div>
    </>
  );
}
