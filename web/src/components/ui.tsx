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

const TONOS_PORTADA = [
  "bg-gradient-to-br from-[#dde8fb] to-[#bfd3f3] text-[#2a5cb8]",
  "bg-gradient-to-br from-[#e0eef5] to-[#bdd8e8] text-[#2c6a8f]",
  "bg-gradient-to-br from-[#e6e6f8] to-[#c9c9ec] text-[#4a4a9e]",
  "bg-gradient-to-br from-[#e2f0e7] to-[#c2dfcd] text-[#2f7a52]",
  "bg-gradient-to-br from-[#f7ead9] to-[#ecd2ae] text-[#96682a]",
  "bg-gradient-to-br from-[#f6e2e5] to-[#ecc4cb] text-[#9c4557]",
];

function tonoDe(titulo: string) {
  let h = 0;
  for (let i = 0; i < titulo.length; i++) h = (h * 31 + titulo.charCodeAt(i)) >>> 0;
  return TONOS_PORTADA[h % TONOS_PORTADA.length];
}

function inicialesDe(titulo: string) {
  const palabras = titulo.trim().split(/\s+/).filter(Boolean);
  return palabras.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Portada de libro: muestra la imagen y, si no hay (o falla la URL), una portada
 *  decorativa con el ícono del libro y las iniciales del título. */
export function Portada({ src, titulo, className = "", compacto = false }: {
  src?: string | null; titulo?: string | null; className?: string; compacto?: boolean;
}) {
  const [falla, setFalla] = useState(false);
  const url = src?.trim() || null;
  const nombre = titulo?.trim() || "";
  if (url && !falla) {
    return <img src={url} alt={nombre ? `Portada de ${nombre}` : "Portada"}
      className={`object-cover ${className}`} onError={() => setFalla(true)} />;
  }
  return (
    <div aria-hidden="true"
      className={`relative flex flex-col items-center justify-center gap-1 overflow-hidden ${tonoDe(nombre)} ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-[13%] w-[3px] rounded-full bg-white/55" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        className={compacto ? "h-5 w-5" : "h-[34%] w-[34%] max-h-14 max-w-14"}>
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h8M8 9h8" />
      </svg>
      {!compacto && inicialesDe(nombre) && (
        <span className="px-1 text-[0.62rem] font-bold uppercase tracking-[0.12em]">{inicialesDe(nombre)}</span>
      )}
    </div>
  );
}
