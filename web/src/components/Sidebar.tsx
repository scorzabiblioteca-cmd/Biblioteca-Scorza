"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  ["/dashboard", "Panel"], ["/libros", "Libros"], ["/ejemplares", "Ejemplares"], ["/prestamos", "Préstamos"],
  ["/devoluciones", "Devoluciones"], ["/alumnos", "Alumnos"], ["/profesores", "Profesores"], ["/reportes", "Reportes"],
];
const MOBILE_LINKS = [
  ["/dashboard", "Panel", "home"], ["/libros", "Libros", "books"], ["/prestamos", "Préstamos", "loan"],
  ["/devoluciones", "Devoluciones", "return"],
] as const;
const MOBILE_MORE_LINKS = [
  ["/ejemplares", "Ejemplares", "copies"], ["/alumnos", "Alumnos", "students"],
  ["/profesores", "Profesores", "teachers"], ["/reportes", "Reportes", "reports"],
] as const;

type MobileIconName = (typeof MOBILE_LINKS)[number][2] | (typeof MOBILE_MORE_LINKS)[number][2] | "more" | "logout";

function MobileIcon({ name }: { name: MobileIconName }) {
  const paths: Record<MobileIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    books: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h8M8 9h8" /></>,
    loan: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3M15 15l2 2 3-3" /></>,
    return: <><path d="M3 11a8 8 0 0 1 14-5l2 2" /><path d="M19 3v5h-5M21 13a8 8 0 0 1-14 5l-2-2" /><path d="M5 21v-5h5" /></>,
    copies: <><path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" /><rect x="8" y="3" width="13" height="16" rx="2" /><path d="M11 7h7M11 11h7M11 15h4" /></>,
    students: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1" /></>,
    teachers: <><path d="M3 8.5 12 4l9 4.5-9 4.5zM7 11v5c3 2.5 7 2.5 10 0v-5M21 9v6" /></>,
    reports: <><path d="M5 3h10l4 4v14H5z" /><path d="M14 3v5h5M8 16v-3M12 16v-5M16 16v-2" /></>,
    more: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><rect x="14.5" y="14.5" width="6" height="6" rx="1" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      {paths[name]}
    </svg>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const moreActive = LINKS.some(([href]) =>
    path.startsWith(href) && !MOBILE_LINKS.some(([mobileHref]) => mobileHref === href),
  );
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
        <div id="mobile-more-menu" className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 max-h-[70dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.12)] md:hidden">
          <nav aria-label="Más secciones" className="flex flex-col gap-1">
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Más opciones</p>
            {MOBILE_MORE_LINKS.map(([href, label, icon]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                aria-current={path.startsWith(href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 ${path.startsWith(href) ? "bg-cyan-50 font-semibold text-cyan-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <MobileIcon name={icon} />
                <span className="flex-1">{label}</span>
                {path.startsWith(href) && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cyan-500" />}
              </Link>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button onClick={salir} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
              <MobileIcon name="logout" />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}
      <nav aria-label="Navegación principal" className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white px-2 pt-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(15,23,42,0.12)] md:hidden">
        {MOBILE_LINKS.map(([href, label, icon]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={path.startsWith(href) ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 pt-1 pb-2 text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-500 ${path.startsWith(href) ? "font-semibold text-cyan-600" : "text-slate-500 hover:text-slate-800"}`}>
            <MobileIcon name={icon} />
            <span className="max-w-full truncate">{label}</span>
            {path.startsWith(href) && <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-8 rounded-full bg-cyan-500" />}
          </Link>
        ))}
        <button type="button" aria-expanded={open} aria-controls="mobile-more-menu" onClick={() => setOpen(!open)}
          className={`relative flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 pt-1 pb-2 text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-500 ${open || moreActive ? "font-semibold text-cyan-600" : "text-slate-500 hover:text-slate-800"}`}>
          <MobileIcon name="more" />
          Más
          {(open || moreActive) && <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-8 rounded-full bg-cyan-500" />}
        </button>
      </nav>
    </aside>
  );
}
