"use client";
import { useEffect, useState } from "react";

const COLORES: Record<string, string> = {
  DISPONIBLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PRESTADO: "bg-amber-50 text-amber-700 ring-amber-200",
  RESERVADO: "bg-sky-50 text-sky-700 ring-sky-200",
  DANADO: "bg-orange-50 text-orange-700 ring-orange-200",
  PERDIDO: "bg-red-50 text-red-700 ring-red-200",
  REPARACION: "bg-violet-50 text-violet-700 ring-violet-200",
  BAJA: "bg-slate-100 text-slate-600 ring-slate-200",
  ACTIVO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CERRADO: "bg-slate-100 text-slate-700 ring-slate-200",
  ANULADO: "bg-red-50 text-red-700 ring-red-200",
  ARCHIVADO: "bg-slate-100 text-slate-600 ring-slate-200",
};
const ETIQUETA: Record<string, string> = { DANADO: "Dañado", REPARACION: "Reparación" };

export function Badge({ v }: { v: string }) {
  const t = ETIQUETA[v] ?? v.charAt(0) + v.slice(1).toLowerCase();
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset ${COLORES[v] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}>{t}</span>;
}

export function Msg({ type, children }: { type: "ok" | "error"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className={`rounded-[10px] border px-3.5 py-2.5 text-sm ${type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
      {children}
    </p>
  );
}

export function PageTitle({ children, action, kicker }: { children: React.ReactNode; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
      <div>
        {kicker && <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-600">{kicker}</p>}
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#172b4d]">{children}</h1>
      </div>
      {action && (
        <div className="flex w-full items-center gap-2 sm:w-auto [&>a]:flex-1 [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none">
          {action}
        </div>
      )}
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
