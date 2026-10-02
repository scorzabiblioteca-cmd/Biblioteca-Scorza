"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  ["/dashboard", "Panel"], ["/libros", "Libros"], ["/ejemplares", "Ejemplares"], ["/prestamos", "Préstamos"],
  ["/devoluciones", "Devoluciones"], ["/alumnos", "Alumnos"], ["/profesores", "Profesores"], ["/reportes", "Reportes"],
];
const MOBILE_LINKS = [
  ["/dashboard", "Panel"], ["/libros", "Libros"], ["/prestamos", "Préstamos"], ["/devoluciones", "Devoluciones"],
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
      </div>
      <nav aria-label="Navegación del panel" className="hidden px-2 pb-3 md:block">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            aria-current={path.startsWith(href) ? "page" : undefined}
            className={`block rounded-md px-3 py-2 text-sm ${path.startsWith(href) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </Link>
        ))}
        <button onClick={salir} className="mt-3 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">Cerrar sesión</button>
      </nav>
      {open && (
        <div id="mobile-more-menu" className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 rounded-md border border-slate-200 bg-white p-2 shadow-lg md:hidden">
          <nav aria-label="Más secciones" className="grid grid-cols-2 gap-1">
            {LINKS.filter(([href]) => !MOBILE_LINKS.some(([mobileHref]) => href === mobileHref)).map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                aria-current={path.startsWith(href) ? "page" : undefined}
                className={`rounded px-3 py-2 text-sm ${path.startsWith(href) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
                {label}
              </Link>
            ))}
            <button onClick={salir} className="rounded px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">Cerrar sesión</button>
          </nav>
        </div>
      )}
      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg md:hidden">
        {MOBILE_LINKS.map(([href, label]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={path.startsWith(href) ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 rounded px-1 py-1 text-[11px] ${path.startsWith(href) ? "font-semibold text-brand-700" : "text-slate-600"}`}>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        <button type="button" aria-expanded={open} aria-controls="mobile-more-menu" onClick={() => setOpen(!open)}
          className={`flex min-w-0 flex-col items-center gap-1 rounded px-1 py-1 text-[11px] ${open ? "font-semibold text-brand-700" : "text-slate-600"}`}>
          Más
        </button>
      </nav>
    </aside>
  );
}
