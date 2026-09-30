"use client";

import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";

export type LibroCantidad = { libroId: number; titulo: string; cantidad: number; disponibles: number };

type Ejemplar = { libroId?: number; disponibles?: number; id: number; codigoInterno: string; titulo: string; isbn: string | null; categoria: string | null };

export function EjemplarAutocomplete({ codigos, onChange, cantidades, onCantidadesChange }: {
  cantidades: LibroCantidad[];
  onCantidadesChange: (items: LibroCantidad[]) => void;
  codigos: string;
  onChange: (codigos: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Ejemplar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [activo, setActivo] = useState(-1);
  const [aviso, setAviso] = useState("");
  const seleccionados = new Set(codigos.split(/[\s,;]+/).filter(Boolean));

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setItems([]); setActivo(-1); setError(""); setCargando(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: texto.trim(), estado: "DISPONIBLE", pageSize: "20" });
      const librosParams = new URLSearchParams({ q: texto.trim(), tipoControl: "CANTIDAD", disponibilidad: "disponibles", pageSize: "20" });
      Promise.all([
        api<Paged<Ejemplar>>(`/ejemplares?${params}`),
        api<Paged<{ id: number; titulo: string; isbn: string | null; categoria: string | null; disponibles: number }>>(`/libros?${librosParams}`),
      ]).then(([ejemplares, libros]) => {
        if (vigente) setItems([...ejemplares.items, ...libros.items.map((l) => ({
          ...l, libroId: l.id, codigoInterno: "",
        }))]);
      })
        .catch((e: Error) => { if (vigente) setError(e.message); })
        .finally(() => { if (vigente) setCargando(false); });
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [texto, abierto]);

  function seleccionar(ejemplar: Ejemplar) {
    if (ejemplar.libroId) {
      const existente = cantidades.find((l) => l.libroId === ejemplar.libroId);
      if ((existente?.cantidad ?? 0) >= (ejemplar.disponibles ?? 0)) {
        setAviso("Ya agregaste todas las unidades disponibles de este libro.");
        return;
      }
      onCantidadesChange(existente
        ? cantidades.map((l) => l.libroId === ejemplar.libroId ? { ...l, cantidad: l.cantidad + 1 } : l)
        : [...cantidades, { libroId: ejemplar.libroId, titulo: ejemplar.titulo, cantidad: 1, disponibles: ejemplar.disponibles! }]);
      setAviso(`Agregado: ${ejemplar.titulo}.`);
      setTexto(""); setAbierto(false); setActivo(-1);
      return;
    }
    if (seleccionados.has(ejemplar.codigoInterno)) {
      setAviso("Este ejemplar ya está agregado.");
      return;
    }
    onChange([...seleccionados, ejemplar.codigoInterno].join("\n"));
    setAviso(`Agregado: ${ejemplar.titulo} (${ejemplar.codigoInterno}).`);
    setTexto(""); setAbierto(false); setActivo(-1);
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="relative" onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}>
        <label htmlFor="ejemplar-busqueda" className="label">Libro (nombre, código, ISBN o categoría)</label>
        <input id="ejemplar-busqueda" className="input" autoComplete="off" placeholder="Busca y selecciona un ejemplar disponible"
          value={texto} role="combobox" aria-autocomplete="list" aria-expanded={abierto}
          aria-controls="ejemplar-opciones"
          aria-activedescendant={abierto && activo >= 0 && items[activo] ? `ejemplar-opcion-${items[activo].libroId ? "libro" : "ejemplar"}-${items[activo].id}` : undefined}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value); setAbierto(true); setItems([]); setActivo(-1);
            setCargando(true); setError(""); setAviso("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setAbierto(false); return; }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault(); setAbierto(true);
              setActivo((i) => items.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : -1);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (abierto && activo >= 0 && items[activo]) seleccionar(items[activo]);
            }
          }} />
        {abierto && <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg">
          <p role="status" className="px-3 text-sm text-slate-500">
            {cargando ? "Buscando libros…" : error || (items.length === 0 ? "No se encontraron ejemplares disponibles." : "")}
          </p>
          <ul id="ejemplar-opciones" role="listbox" aria-label="Ejemplares disponibles" className="max-h-64 overflow-y-auto">
            {items.map((ejemplar, index) => <li key={`${ejemplar.libroId ? "libro" : "ejemplar"}-${ejemplar.id}`} id={`ejemplar-opcion-${ejemplar.libroId ? "libro" : "ejemplar"}-${ejemplar.id}`}
              role="option" aria-selected={activo === index} aria-disabled={seleccionados.has(ejemplar.codigoInterno)}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-emerald-50 ${activo === index ? "bg-emerald-50" : ""} ${seleccionados.has(ejemplar.codigoInterno) ? "opacity-50" : ""}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => seleccionar(ejemplar)}>
              <span className="block font-medium">{ejemplar.titulo}</span>
              <span className="text-xs text-slate-500">{ejemplar.libroId ? `${ejemplar.disponibles} unidades disponibles` : `Código: ${ejemplar.codigoInterno}`} · {ejemplar.categoria || "Sin categoría"}
                {ejemplar.isbn ? ` · ISBN: ${ejemplar.isbn}` : ""}{seleccionados.has(ejemplar.codigoInterno) ? " · Agregado" : ""}</span>
            </li>)}
          </ul>
        </div>}
      </div>
      <p role="status" className="text-xs text-emerald-800">{aviso}</p>
      <label className="block"><span className="label">Códigos de ejemplares a prestar</span>
        <textarea className="input" rows={2} required={cantidades.length === 0} placeholder="Selecciona libros arriba o pega códigos separados por coma"
          value={codigos} onChange={(e) => onChange(e.target.value)} />
      </label>
      {cantidades.map((libro) => <div key={libro.libroId} className="flex items-center gap-2 rounded border p-2 text-sm">
        <span className="flex-1">{libro.titulo}</span>
        <input className="input max-w-20" type="number" min={1} max={libro.disponibles} required
          aria-label={`Cantidad de ${libro.titulo}`} value={libro.cantidad}
          onChange={(e) => onCantidadesChange(cantidades.map((l) => l.libroId === libro.libroId ? { ...l, cantidad: Number(e.target.value) } : l))} />
        <button type="button" className="text-red-700" aria-label={`Quitar ${libro.titulo}`}
          onClick={() => onCantidadesChange(cantidades.filter((l) => l.libroId !== libro.libroId))}>Quitar</button>
      </div>)}
      <p className="text-xs text-slate-500">Puedes agregar varios libros. Para quitar uno, borra su código.</p>
    </div>
  );
}
