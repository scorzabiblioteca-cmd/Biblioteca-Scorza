"use client";

import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";

export type Profesor = {
  id: number;
  nombres: string;
  apellidos: string;
  dni: string | null;
  area: string | null;
};

export function ProfesorAutocomplete({ value, onChange }: {
  value: Profesor | null;
  onChange: (profesor: Profesor | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Profesor[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [activo, setActivo] = useState(-1);

  useEffect(() => {
    if (!abierto || value) return;
    let vigente = true;
    setItems([]);
    setActivo(-1);
    setError("");
    setCargando(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: texto.trim(), estado: "ACTIVO", pageSize: "10" });
      api<Paged<Profesor>>(`/profesores?${params}`)
        .then((data) => { if (vigente) setItems(data.items); })
        .catch((e: Error) => { if (vigente) setError(e.message); })
        .finally(() => { if (vigente) setCargando(false); });
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [texto, abierto, value]);

  function seleccionar(profesor: Profesor) {
    onChange(profesor);
    setTexto("");
    setAbierto(false);
  }

  const mostrar = abierto && !value;
  return (
    <div className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
    }}>
      <label htmlFor="profesor-busqueda" className="label">Profesor</label>
      <input id="profesor-busqueda" className="input" required autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={mostrar}
        aria-controls="profesor-opciones" aria-describedby="profesor-ayuda"
        aria-activedescendant={mostrar && activo >= 0 ? `profesor-opcion-${items[activo]?.id}` : undefined}
        placeholder="Buscar por nombre o DNI" value={value ? `${value.apellidos}, ${value.nombres}` : texto}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          onChange(null); setTexto(e.target.value); setAbierto(true);
          setItems([]); setActivo(-1); setCargando(true); setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setAbierto(false); return; }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setAbierto(true);
            setActivo((i) => items.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : -1);
          }
          if (e.key === "Enter" && mostrar) {
            e.preventDefault();
            if (activo >= 0 && items[activo]) seleccionar(items[activo]);
          }
        }} />
      <p id="profesor-ayuda" className="mt-1 text-xs text-slate-500">
        {value ? `DNI: ${value.dni ?? "—"}${value.area ? ` · Área: ${value.area}` : ""}` : "Elige una opción."}
      </p>
      {mostrar && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#e6ecf4] bg-white shadow-[0_18px_45px_rgba(11,27,51,0.18)]">
        <p role="status" className="px-3 text-sm text-slate-500">
          {cargando ? "Buscando profesores…" : error || (items.length === 0 ? "No se encontraron profesores activos." : "")}
        </p>
        <ul id="profesor-opciones" role="listbox" aria-label="Profesores registrados" className="max-h-64 overflow-y-auto">
          {items.map((profesor, index) => <li key={profesor.id} id={`profesor-opcion-${profesor.id}`}
            role="option" aria-selected={activo === index}
            className={`cursor-pointer px-3 py-2.5 text-sm transition-colors hover:bg-[#f7faff] ${activo === index ? "bg-brand-50 font-medium text-brand-900" : ""}`}
            onMouseDown={(e) => e.preventDefault()} onClick={() => seleccionar(profesor)}>
            <span className="block font-medium">{profesor.apellidos}, {profesor.nombres}</span>
            <span className="text-xs text-slate-500">DNI: {profesor.dni ?? "—"}{profesor.area ? ` · Área: ${profesor.area}` : ""}</span>
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
