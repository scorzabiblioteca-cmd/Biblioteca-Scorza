"use client";

import { useEffect, useState } from "react";
import { api, Paged } from "@/lib/client";

export type Alumno = {
  id: number;
  nombres: string;
  apellidos: string;
  dni: string;
  codigoAlumno: string;
};

export function AlumnoAutocomplete({ value, onChange }: {
  value: Alumno | null;
  onChange: (alumno: Alumno | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Alumno[]>([]);
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
      api<Paged<Alumno>>(`/alumnos?${params}`)
        .then((data) => { if (vigente) setItems(data.items); })
        .catch((e: Error) => { if (vigente) setError(e.message); })
        .finally(() => { if (vigente) setCargando(false); });
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [texto, abierto, value]);

  function seleccionar(alumno: Alumno) {
    onChange(alumno);
    setTexto("");
    setAbierto(false);
  }

  const mostrar = abierto && !value;
  return (
    <div className="relative" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
    }}>
      <label htmlFor="alumno-busqueda" className="label">Alumno (nombre, DNI o código)</label>
      <input id="alumno-busqueda" className="input" required autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={mostrar}
        aria-controls="alumno-opciones" aria-describedby="alumno-ayuda"
        aria-activedescendant={mostrar && activo >= 0 ? `alumno-opcion-${items[activo]?.id}` : undefined}
        placeholder="Buscar alumno registrado" value={value ? `${value.apellidos}, ${value.nombres}` : texto}
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
      <p id="alumno-ayuda" className="mt-1 text-xs text-slate-500">
        {value ? `DNI: ${value.dni} · Código: ${value.codigoAlumno}` : "Selecciona un alumno de las sugerencias."}
      </p>
      {mostrar && <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg">
        <p role="status" className="px-3 text-sm text-slate-500">
          {cargando ? "Buscando alumnos…" : error || (items.length === 0 ? "No se encontraron alumnos activos." : "")}
        </p>
        <ul id="alumno-opciones" role="listbox" aria-label="Alumnos registrados" className="max-h-64 overflow-y-auto">
          {items.map((alumno, index) => <li key={alumno.id} id={`alumno-opcion-${alumno.id}`}
            role="option" aria-selected={activo === index}
            className={`cursor-pointer px-3 py-2 text-sm hover:bg-emerald-50 ${activo === index ? "bg-emerald-50" : ""}`}
            onMouseDown={(e) => e.preventDefault()} onClick={() => seleccionar(alumno)}>
            <span className="block font-medium">{alumno.apellidos}, {alumno.nombres}</span>
            <span className="text-xs text-slate-500">DNI: {alumno.dni} · Código: {alumno.codigoAlumno}</span>
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
