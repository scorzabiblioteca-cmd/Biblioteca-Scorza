"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Msg } from "@/components/ui";
import "./dashboard.css";

type Punto = { fecha: string; cantidad: number };
type Dia = { dow: number; cantidad: number };
type LibroTop = { titulo: string; vecesPrestado: number; categoria: string };
type Resumen = {
  titulos: number;
  ejemplares: number;
  disponibles: number;
  prestados: number;
  danados: number;
  perdidos: number;
  vencidos: number;
  alumnos: number;
  profesores: number;
  prestamosPeriodo: number;
  prestamosAnterior: number;
  devolucionesPeriodo: number;
  devolucionesAnterior: number;
  dias: number;
  seriePrestamos: Punto[];
  actividadSemana: Dia[];
  masPrestados: LibroTop[];
};

const NUMBER_FORMAT = new Intl.NumberFormat("es-PE");
const DATE_FORMAT = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" });
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const PERIODOS = [
  { value: 7, label: "Últimos 7 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
] as const;

function delta(actual: number, anterior: number) {
  if (anterior <= 0) return actual > 0 ? 100 : 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

function Sparkline({ points }: { points: Punto[] }) {
  const max = Math.max(1, ...points.map((p) => p.cantidad));
  const w = 640;
  const h = 168;
  const pad = 8;
  const coords = points.map((p, i) => {
    const x = points.length <= 1 ? w / 2 : pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - (p.cantidad / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `0,${h} ${coords.join(" ")} ${w},${h}`;

  return (
    <div className="dash-chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Préstamos por día">
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#eef2f7" strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#dashArea)" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" points={line} />
      </svg>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 72;
  const c = Math.PI * r;
  const filled = (pct / 100) * c;

  return (
    <div className="dash-gauge">
      <div className="dash-gauge-wrap">
        <svg viewBox="0 0 180 110" aria-hidden="true">
          <path d="M18 100 A72 72 0 0 1 162 100" fill="none" stroke="#eef2f7" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M18 100 A72 72 0 0 1 162 100"
            fill="none"
            stroke="#34d399"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
          />
        </svg>
        <div className="dash-gauge-center">
          <strong>{pct}%</strong>
          <span>Disponibilidad</span>
        </div>
      </div>
    </div>
  );
}

function Icon({ name }: { name: "books" | "loan" | "return" | "alert" | "download" }) {
  const d: Record<typeof name, React.ReactNode> = {
    books: <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M6 19a2 2 0 0 1 2-2h10" /></>,
    loan: <><path d="M4 19V7l8-4 8 4v12" /><path d="M12 11v8M8 15h8" /></>,
    return: <><path d="M3 12a9 9 0 1 0 3-6.7L4 8" /><path d="M4 3v5h5" /></>,
    alert: <><path d="M12 8v5M12 16h.01" /><path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /></>,
    download: <><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 18h14" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {d[name]}
    </svg>
  );
}

export default function Dashboard() {
  const [dias, setDias] = useState(30);
  const [r, setR] = useState<Resumen | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api<Resumen>(`/dashboard/resumen?dias=${dias}`)
      .then(setR)
      .catch((e) => setErr(e.message));
  }, [dias]);

  const kpis = useMemo(() => {
    const prestamosDelta = r ? delta(r.prestamosPeriodo, r.prestamosAnterior) : 0;
    const devolucionesDelta = r ? delta(r.devolucionesPeriodo, r.devolucionesAnterior) : 0;
    return [
      {
        label: "Títulos activos",
        value: r?.titulos,
        meta: "Libros en catálogo",
        icon: "books" as const,
        tint: "#eff6ff",
        color: "#2563eb",
      },
      {
        label: "Préstamos",
        value: r?.prestamosPeriodo,
        meta: `vs periodo anterior`,
        icon: "loan" as const,
        tint: "#eef2ff",
        color: "#4f46e5",
        delta: prestamosDelta,
      },
      {
        label: "Devoluciones",
        value: r?.devolucionesPeriodo,
        meta: "Unidades devueltas",
        icon: "return" as const,
        tint: "#ecfdf5",
        color: "#059669",
        delta: devolucionesDelta,
      },
      {
        label: "Vencidos",
        value: r?.vencidos,
        meta: "Requieren seguimiento",
        icon: "alert" as const,
        tint: r && r.vencidos > 0 ? "#fef2f2" : "#ecfdf5",
        color: r && r.vencidos > 0 ? "#dc2626" : "#059669",
      },
    ];
  }, [r]);

  const inventario = r
    ? [
        { label: "Disponibles", value: r.disponibles, color: "#10b981" },
        { label: "Prestados", value: r.prestados, color: "#3b82f6" },
        { label: "Dañados", value: r.danados, color: "#f59e0b" },
        { label: "Perdidos", value: r.perdidos, color: "#ef4444" },
      ]
    : [];
  const maxInventario = Math.max(1, ...inventario.map((i) => i.value));
  const maxActividad = Math.max(1, ...(r?.actividadSemana.map((d) => d.cantidad) ?? [1]));
  const pico = r?.actividadSemana.reduce((a, b) => (b.cantidad > a.cantidad ? b : a), { dow: 0, cantidad: 0 });
  const disponibilidad = r && r.ejemplares > 0 ? Math.round((r.disponibles / r.ejemplares) * 100) : 0;
  const rango = r?.seriePrestamos.length
    ? `${DATE_FORMAT.format(new Date(`${r.seriePrestamos[0].fecha}T00:00:00`))} – ${DATE_FORMAT.format(new Date(`${r.seriePrestamos.at(-1)!.fecha}T00:00:00`))}`
    : "";

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <p className="dash-kicker">Biblioteca escolar</p>
          <h1>Dashboard</h1>
        </div>
        <div className="dash-actions">
          <label className="sr-only" htmlFor="dash-range">Periodo</label>
          <select
            id="dash-range"
            className="dash-range"
            value={dias}
            onChange={(e) => {
              setR(null);
              setDias(Number(e.target.value));
            }}
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <a className="dash-export" href="/api/reportes/mas-prestados?formato=csv">
            <Icon name="download" />
            Exportar
          </a>
        </div>
      </header>

      <Msg type="error">{err}</Msg>

      <section className="dash-kpis" aria-label="Indicadores de la biblioteca">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="dash-kpi">
            <div className="dash-kpi-top">
              <p className="dash-kpi-label">{kpi.label}</p>
              <span className="dash-icon" style={{ background: kpi.tint, color: kpi.color }}>
                <Icon name={kpi.icon} />
              </span>
            </div>
            <p className="dash-kpi-value">{kpi.value === undefined ? <span className="dash-skel" /> : NUMBER_FORMAT.format(kpi.value)}</p>
            {"delta" in kpi && kpi.delta !== undefined ? (
              <span className={`dash-delta ${kpi.delta > 0 ? "up" : kpi.delta < 0 ? "down" : "flat"}`}>
                {kpi.delta > 0 ? "+" : ""}{kpi.delta}% vs periodo anterior
              </span>
            ) : (
              <p className="dash-kpi-meta">{kpi.meta}</p>
            )}
          </article>
        ))}
      </section>

      {r && (
        <>
          <div className="dash-grid">
            <section className="dash-card" aria-labelledby="prestamos-heading">
              <div className="dash-card-title">
                <div>
                  <h2 id="prestamos-heading">Actividad de préstamos</h2>
                  <p>{rango}</p>
                </div>
              </div>
              <p className="dash-hero-value">{NUMBER_FORMAT.format(r.prestamosPeriodo)}</p>
              <Sparkline points={r.seriePrestamos} />
            </section>

            <section className="dash-card" aria-labelledby="dias-heading">
              <div className="dash-card-title">
                <div>
                  <h2 id="dias-heading">Día más activo</h2>
                  <p>{pico && pico.cantidad > 0 ? DIAS_SEMANA[pico.dow] : "Sin movimientos"}</p>
                </div>
              </div>
              <div className="dash-bars">
                {r.actividadSemana.map((dia) => {
                  const alto = Math.max(8, (dia.cantidad / maxActividad) * 100);
                  return (
                    <div key={dia.dow} className="dash-bar-col">
                      <div className="dash-bar-track">
                        <div
                          className={`dash-bar${pico?.dow === dia.dow && dia.cantidad > 0 ? " active" : ""}`}
                          style={{ height: `${alto}%` }}
                          title={`${DIAS_SEMANA[dia.dow]}: ${dia.cantidad}`}
                        />
                      </div>
                      <span className="dash-bar-label">{DIAS_SEMANA[dia.dow]}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="dash-grid dash-bottom">
            <section className="dash-card" aria-labelledby="top-heading">
              <div className="dash-card-title">
                <div>
                  <h2 id="top-heading">Libros más prestados</h2>
                  <p>En el periodo seleccionado</p>
                </div>
                <Link href="/reportes" className="text-sm font-medium text-blue-600 hover:text-blue-700">Ver reportes</Link>
              </div>
              {r.masPrestados.length === 0 ? (
                <p className="dash-empty">Aún no hay préstamos en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Categoría</th>
                        <th>Préstamos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.masPrestados.map((libro) => (
                        <tr key={libro.titulo}>
                          <td data-label="Título">{libro.titulo}</td>
                          <td data-label="Categoría">{libro.categoria}</td>
                          <td data-label="Préstamos">{NUMBER_FORMAT.format(libro.vecesPrestado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid gap-[0.9rem]">
              <section className="dash-card" aria-labelledby="stock-heading">
                <div className="dash-card-title">
                  <div>
                    <h2 id="stock-heading">Estado del inventario</h2>
                    <p>{NUMBER_FORMAT.format(r.ejemplares)} ejemplares · {NUMBER_FORMAT.format(r.alumnos)} alumnos · {NUMBER_FORMAT.format(r.profesores)} profesores</p>
                  </div>
                </div>
                <div className="dash-split">
                  {inventario.map((item) => (
                    <div key={item.label} className="dash-split-row">
                      <span className="dash-split-dot" style={{ background: item.color }} />
                      <span className="dash-split-name">{item.label}</span>
                      <span className="dash-split-val">{NUMBER_FORMAT.format(item.value)}</span>
                      <div className="dash-split-bar">
                        <div className="dash-split-fill" style={{ width: `${(item.value / maxInventario) * 100}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="dash-card" aria-labelledby="disp-heading">
                <div className="dash-card-title">
                  <div>
                    <h2 id="disp-heading">Colección disponible</h2>
                    <p>Sobre el inventario activo</p>
                  </div>
                </div>
                <Gauge value={disponibilidad} />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
