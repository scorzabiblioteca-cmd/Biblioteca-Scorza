"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Msg, PageTitle } from "@/components/ui";

type R = { titulos: number; ejemplares: number; disponibles: number; prestados: number; danados: number; perdidos: number; vencidos: number; alumnos: number };
const ITEMS: [keyof R, string][] = [
  ["titulos", "Títulos"], ["ejemplares", "Ejemplares"], ["disponibles", "Disponibles"], ["prestados", "Prestados"],
  ["danados", "Dañados"], ["perdidos", "Perdidos"], ["vencidos", "Préstamos vencidos"], ["alumnos", "Alumnos activos"],
];

export default function Dashboard() {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<R>("/dashboard/resumen").then(setR).catch((e) => setErr(e.message)); }, []);
  return (
    <>
      <PageTitle>Biblioteca escolar</PageTitle>
      <Msg type="error">{err}</Msg>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ITEMS.map(([k, label]) => (
          <div key={k} className="card">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${k === "vencidos" && r && r[k] > 0 ? "text-red-700" : "text-slate-900"}`}>
              {r ? r[k].toLocaleString("es-PE") : "…"}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
