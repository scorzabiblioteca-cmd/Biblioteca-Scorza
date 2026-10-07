"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

type R = { titulos: number; ejemplares: number; disponibles: number; prestados: number; danados: number; perdidos: number; vencidos: number; alumnos: number };
const NUMBER_FORMAT = new Intl.NumberFormat("es-PE");
const COLORS = {
  disponibles: "#10b981",
  prestados: "#3b82f6",
  danados: "#f59e0b",
  perdidos: "#ef4444",
  otros: "#94a3b8",
} as const;

function DistributionChart({ resumen }: { resumen: R }) {
  const otros = Math.max(0, resumen.ejemplares - resumen.disponibles - resumen.prestados - resumen.danados - resumen.perdidos);
  const segmentos = [
    { key: "disponibles", label: "Disponibles", value: resumen.disponibles, color: COLORS.disponibles },
    { key: "prestados", label: "Prestados", value: resumen.prestados, color: COLORS.prestados },
    { key: "danados", label: "Dañados", value: resumen.danados, color: COLORS.danados },
    { key: "perdidos", label: "Perdidos", value: resumen.perdidos, color: COLORS.perdidos },
    { key: "otros", label: "Reservados o en reparación", value: otros, color: COLORS.otros },
  ];
  const radio = 45;
  const circunferencia = 2 * Math.PI * radio;
  let desplazamiento = 0;

  return (
    <section className="card" aria-labelledby="distribucion-heading">
      <div className="mb-5">
        <h2 id="distribucion-heading" className="font-semibold text-slate-900">Estado del inventario</h2>
        <p className="mt-1 text-sm text-slate-500">Distribución de ejemplares registrados</p>
      </div>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        <div className="relative h-48 w-48 shrink-0" role="img" aria-label={`Distribución de ${NUMBER_FORMAT.format(resumen.ejemplares)} ejemplares por estado`}>
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r={radio} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            {resumen.ejemplares > 0 && segmentos.map((segmento) => {
              const longitud = (segmento.value / resumen.ejemplares) * circunferencia;
              const offset = desplazamiento;
              desplazamiento += longitud;
              if (!segmento.value) return null;
              return (
                <circle
                  key={segmento.key}
                  cx="60"
                  cy="60"
                  r={radio}
                  fill="none"
                  stroke={segmento.color}
                  strokeWidth="12"
                  strokeDasharray={`${longitud} ${circunferencia - longitud}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums text-slate-900">{NUMBER_FORMAT.format(resumen.ejemplares)}</span>
            <span className="mt-0.5 text-xs text-slate-500">ejemplares</span>
          </div>
        </div>
        <ul className="grid w-full grid-cols-1 gap-3 sm:max-w-xs" aria-label="Detalle por estado">
          {segmentos.map((segmento) => {
            const porcentaje = resumen.ejemplares > 0 ? Math.round((segmento.value / resumen.ejemplares) * 100) : 0;
            return (
              <li key={segmento.key} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segmento.color }} aria-hidden="true" />
                  <span className="truncate">{segmento.label}</span>
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums text-slate-900">
                  {NUMBER_FORMAT.format(segmento.value)}
                  <span className="ml-1.5 text-xs font-normal text-slate-400">{porcentaje}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<R>("/dashboard/resumen").then(setR).catch((e) => setErr(e.message)); }, []);

  const tarjetas: { label: string; value: number | undefined; detail: string; color: string }[] = [
    { label: "Títulos activos", value: r?.titulos, detail: "Libros en catálogo", color: "text-sky-700 bg-sky-50" },
    { label: "Ejemplares", value: r?.ejemplares, detail: "Unidades en inventario", color: "text-indigo-700 bg-indigo-50" },
    { label: "Alumnos activos", value: r?.alumnos, detail: "Lectores registrados", color: "text-violet-700 bg-violet-50" },
    { label: "Préstamos vencidos", value: r?.vencidos, detail: "Requieren seguimiento", color: r && r.vencidos > 0 ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50" },
  ];

  const porcentajePrestado = r && r.ejemplares > 0 ? Math.min(100, Math.round((r.prestados / r.ejemplares) * 100)) : 0;
  const porcentajeDisponible = r && r.ejemplares > 0 ? Math.min(100, Math.round((r.disponibles / r.ejemplares) * 100)) : 0;

  return (
    <div className="space-y-5">
      <PageTitle>Biblioteca escolar</PageTitle>
      <Msg type="error">{err}</Msg>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores de la biblioteca">
        {tarjetas.map((tarjeta) => (
          <article key={tarjeta.label} className="card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-600">{tarjeta.label}</p>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tarjeta.color.split(" ")[1]}`} aria-hidden="true" />
            </div>
            <p className={`mt-3 text-3xl font-semibold tabular-nums ${tarjeta.color.split(" ")[0]}`}>
              {tarjeta.value === undefined ? "…" : NUMBER_FORMAT.format(tarjeta.value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{tarjeta.detail}</p>
          </article>
        ))}
      </section>

      {r && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <DistributionChart resumen={r} />

          <section className="card flex flex-col" aria-labelledby="uso-heading">
            <div>
              <h2 id="uso-heading" className="font-semibold text-slate-900">Uso de la colección</h2>
              <p className="mt-1 text-sm text-slate-500">Disponibilidad y circulación actual</p>
            </div>

            <div className="mt-7 space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">En préstamo</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {NUMBER_FORMAT.format(r.prestados)}
                    <span className="ml-1.5 font-normal text-slate-500">{porcentajePrestado}%</span>
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Porcentaje de ejemplares en préstamo"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={porcentajePrestado}
                >
                  <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${porcentajePrestado}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">Disponibles</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {NUMBER_FORMAT.format(r.disponibles)}
                    <span className="ml-1.5 font-normal text-slate-500">{porcentajeDisponible}%</span>
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Porcentaje de ejemplares disponibles"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={porcentajeDisponible}
                >
                  <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${porcentajeDisponible}%` }} />
                </div>
              </div>
            </div>

            <p className="mt-auto pt-7 text-xs leading-relaxed text-slate-500">
              El porcentaje se calcula sobre los {NUMBER_FORMAT.format(r.ejemplares)} ejemplares del inventario.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
