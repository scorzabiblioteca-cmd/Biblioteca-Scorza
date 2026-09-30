"use client";
import { useEffect, useState } from "react";

const COLORES: Record<string, string> = {
  DISPONIBLE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PRESTADO: "bg-amber-50 text-amber-800 ring-amber-200",
  RESERVADO: "bg-sky-50 text-sky-800 ring-sky-200",
  DANADO: "bg-orange-50 text-orange-800 ring-orange-200",
  PERDIDO: "bg-red-50 text-red-800 ring-red-200",
  REPARACION: "bg-violet-50 text-violet-800 ring-violet-200",
  BAJA: "bg-slate-100 text-slate-600 ring-slate-200",
  ACTIVO: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ARCHIVADO: "bg-slate-100 text-slate-600 ring-slate-200",
};
const ETIQUETA: Record<string, string> = { DANADO: "Dañado", REPARACION: "Reparación" };

export function Badge({ v }: { v: string }) {
  const t = ETIQUETA[v] ?? v.charAt(0) + v.slice(1).toLowerCase();
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ${COLORES[v] ?? "bg-slate-50 ring-slate-200"}`}>{t}</span>;
}

export function Msg({ type, children }: { type: "ok" | "error"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className={`rounded-md px-3 py-2 text-sm ${type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {children}
    </p>
  );
}

export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <h1 className="text-xl font-semibold text-slate-900">{children}</h1>
      {action}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="label">{label}</span>{children}</label>;
}
