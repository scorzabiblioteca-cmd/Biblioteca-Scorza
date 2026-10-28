"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";
import { Badge, Msg, PageTitle, Portada, useDebounced } from "@/components/ui";

type Libro = {
  id: number; titulo: string; autores: string | null; isbn: string | null; categoria: string | null; tipoControl: string;
  total: number; disponibles: number; prestados: number; ubicaciones: string | null; estado: string; imagenUrl: string | null;
};
type Categoria = { id: number; nombre: string };

export default function Libros() {
  const [qtxt, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [disp, setDisp] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [estado, setEstado] = useState("ACTIVO");
  const [vista, setVista] = useState<"tabla" | "portadas">("tabla");
  const [pageN, setPage] = useState(1);
  const [data, setData] = useState<Paged<Libro> | null>(null);
  const [err, setErr] = useState("");
  const [errorCategorias, setErrorCategorias] = useState("");
  const dq = useDebounced(qtxt);

  useEffect(() => {
    api<Categoria[]>("/categorias").then(setCategorias).catch((e) => setErrorCategorias(e.message));
  }, []);
  useEffect(() => { setPage(1); }, [dq, tipo, disp, categoriaId, estado]);
  useEffect(() => {
    const p = new URLSearchParams({ page: String(pageN), pageSize: "20", estado });
    if (dq) p.set("q", dq);
    if (tipo) p.set("tipoControl", tipo);
    if (disp) p.set("disponibilidad", disp);
    if (categoriaId) p.set("categoriaId", categoriaId);
    api<Paged<Libro>>(`/libros?${p}`).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message));
  }, [dq, tipo, disp, categoriaId, estado, pageN]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageTitle action={<>
        <Link href="/libros/ejemplares" className="btn-ghost">Ver ejemplares</Link>
        <Link href="/libros/nuevo" className="btn">Registrar libro</Link>
      </>}>Libros</PageTitle>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input sm:col-span-2" placeholder="Título, autor, ISBN, editorial o código" value={qtxt} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
        </select>
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
      {errorCategorias && <Msg type="error">No se pudieron cargar las categorías: {errorCategorias}</Msg>}
      <div className="mb-3 flex justify-end" role="group" aria-label="Vista de libros">
        <div className="segmented">
          <button type="button" aria-pressed={vista === "tabla"} onClick={() => setVista("tabla")}>
            Tabla
          </button>
          <button type="button" aria-pressed={vista === "portadas"} onClick={() => setVista("portadas")}>
            Portadas
          </button>
        </div>
      </div>
      {vista === "tabla" ? (
        <div className="card responsive-table-shell overflow-x-auto p-0">
          <table className="responsive-table w-full min-w-[820px]">
            <thead className="border-b border-[#e6ecf4] bg-[#f7f9fc]"><tr>
              {["", "Título", "Autor", "ISBN", "Categoría", "Control", "Total", "Disp.", "Prest.", "Ubicación", "Estado"].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#eef2f7]">
              {data?.items.map((l) => (
                <tr key={l.id} className="hover:bg-[#f7faff]">
                  <td className="td w-12" data-label=""><Portada src={l.imagenUrl} titulo={l.titulo} compacto className="h-12 w-9 rounded-lg" /></td>
                  <td className="td font-medium" data-label="Título"><Link href={`/libros/${l.id}`} className="text-brand-700 hover:underline">{l.titulo}</Link></td>
                  <td className="td" data-label="Autor">{l.autores ?? "—"}</td>
                  <td className="td tabular-nums" data-label="ISBN">{l.isbn ?? "—"}</td>
                  <td className="td" data-label="Categoría">{l.categoria ?? "—"}</td>
                  <td className="td" data-label="Control">{l.tipoControl === "CANTIDAD" ? "Cantidad" : "Individual"}</td>
                  <td className="td tabular-nums" data-label="Total">{l.total}</td>
                  <td className="td tabular-nums" data-label="Disponibles">{l.disponibles}</td>
                  <td className="td tabular-nums" data-label="Prestados">{l.prestados}</td>
                  <td className="td" data-label="Ubicación">{l.ubicaciones ?? "—"}</td>
                  <td className="td" data-label="Estado"><Badge v={l.estado} /></td>
                </tr>
              ))}
              {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={11}>No hay libros con esos criterios. Registra el primero con «Registrar libro».</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data?.items.map((l) => (
            <Link key={l.id} href={`/libros/${l.id}`} className="overflow-hidden rounded-xl border border-[#e6ecf4] bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
              <Portada src={l.imagenUrl} titulo={l.titulo} className="aspect-[2/3] w-full" />
              <span className="line-clamp-2 block min-h-10 p-2.5 text-sm font-medium text-[#334155]">{l.titulo}</span>
            </Link>
          ))}
          {data && data.items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">No hay libros con esos criterios. Registra el primero con «Registrar libro».</p>}
        </div>
      )}
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
