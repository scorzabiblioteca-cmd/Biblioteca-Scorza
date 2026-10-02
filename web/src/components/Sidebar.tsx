"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  ["/dashboard", "Panel"], ["/libros", "Libros"], ["/ejemplares", "Ejemplares"], ["/prestamos", "Préstamos"],
  ["/devoluciones", "Devoluciones"], ["/alumnos", "Alumnos"], ["/profesores", "Profesores"], ["/reportes", "Reportes"],
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <aside className="border-b border-slate-200 bg-white print:hidden md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-4 py-3 md:block">
        <div>
          <p className="text-base font-semibold text-brand-700">BiblioScorza</p>
          <p className="text-xs text-slate-500">Biblioteca escolar</p>
        </div>
        <button className="btn-ghost md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>Menú</button>
      </div>
      <nav className={`${open ? "block" : "hidden"} px-2 pb-3 md:block`}>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 text-sm ${path.startsWith(href) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </Link>
        ))}
        <button onClick={salir} className="mt-3 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">Cerrar sesión</button>
      </nav>
    </aside>
  );
}
