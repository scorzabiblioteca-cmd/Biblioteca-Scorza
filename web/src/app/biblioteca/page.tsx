"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Msg, Portada, useDebounced } from "@/components/ui";
import { api, Paged } from "@/lib/client";

type Libro = {
  id: number;
  titulo: string;
  isbn: string | null;
  imagenUrl: string | null;
  categoria: string | null;
  autores: string | null;
  disponibles: number;
};

export default function Biblioteca() {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [libros, setLibros] = useState<Paged<Libro> | null>(null);
  const [error, setError] = useState("");
  const consulta = useDebounced(busqueda);

  useEffect(() => {
    setPagina(1);
  }, [consulta]);

  useEffect(() => {
    let vigente = true;
    const parametros = new URLSearchParams({ page: String(pagina), pageSize: "24" });
    if (consulta) parametros.set("q", consulta);

    setError("");
    api<Paged<Libro>>(`/biblioteca?${parametros}`)
      .then((resultado) => {
        if (vigente) setLibros(resultado);
      })
      .catch((e: Error) => {
        if (vigente) setError(e.message);
      });

    return () => {
      vigente = false;
    };
  }, [consulta, pagina]);

  const paginas = libros ? Math.max(1, Math.ceil(libros.total / libros.pageSize)) : 1;

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/escudo-colegio.png"
              alt=""
              aria-hidden="true"
              width="56"
              height="56"
              className="h-14 w-14 object-contain"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">BiblioScorza</p>
              <h1 className="text-2xl font-bold tracking-tight text-[#172b4d]">Biblioteca</h1>
            </div>
          </div>
          <Link href="/login" className="btn-ghost">Volver al inicio de sesión</Link>
        </header>

        <section aria-labelledby="catalogo-heading">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="catalogo-heading" className="text-lg font-semibold text-slate-800">Catálogo de libros</h2>
              <p className="mt-1 text-sm text-slate-500">Consulta los títulos disponibles en la biblioteca.</p>
            </div>
            <label className="w-full sm:max-w-sm">
              <span className="sr-only">Buscar libros</span>
              <input
                className="input"
                type="search"
                maxLength={100}
                placeholder="Buscar por título, autor o categoría"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>

          {error && <div className="mb-4"><Msg type="error">{error}</Msg></div>}
          {!libros && !error && <p className="py-12 text-center text-sm text-slate-500">Cargando catálogo…</p>}
          {libros && libros.items.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
              {consulta ? "No se encontraron libros con esa búsqueda." : "Aún no hay libros en el catálogo."}
            </p>
          )}

          {libros && libros.items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {libros.items.map((libro) => (
                  <article key={libro.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Portada src={libro.imagenUrl} titulo={libro.titulo} className="aspect-[2/3] w-full" />
                    <div className="space-y-1 p-3">
                      <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-800">{libro.titulo}</h3>
                      <p className="line-clamp-2 min-h-5 text-xs text-slate-500">{libro.autores ?? "Autor no registrado"}</p>
                      {libro.categoria && <p className="truncate text-xs text-slate-500">{libro.categoria}</p>}
                      <p className={`pt-1 text-xs font-medium ${libro.disponibles > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {libro.disponibles > 0 ? "Disponible" : "No disponible"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
                <span>{libros.total} título(s)</span>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                  <span>{pagina} / {paginas}</span>
                  <button className="btn-ghost" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="mt-12 text-left text-xs text-slate-400">
          © 2026 Derechos reservados al colegio Manuel Scorza Torres, R.R.R.H.Y.
        </footer>
      </div>
    </main>
  );
}
