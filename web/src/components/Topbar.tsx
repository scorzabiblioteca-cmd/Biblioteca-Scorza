"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fechaHora, Paged } from "@/lib/client";

type Usuario = {
  id: number;
  username: string;
  nombreCompleto: string | null;
  email: string | null;
  roles: string[];
};

type Notificacion = {
  id: number;
  tipo: "PRESTAMO" | "DEVOLUCION" | "INVENTARIO" | "VENCIDO" | "POR_VENCER";
  titulo: string;
  mensaje: string;
  enlace: string;
  leidaEn: string | null;
  createdAt: string;
};
type Bandeja = Paged<Notificacion> & { noLeidas: number };

const ROLES: Record<string, string> = { ADMIN: "Administrador", BIBLIOTECARIO: "Bibliotecario" };

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function IconoCampana() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export default function Topbar() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState<"perfil" | "notificaciones" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const cargarContador = useCallback(() => {
    api<Bandeja>("/notificaciones?pageSize=1")
      .then((data) => setNoLeidas(data.noLeidas))
      .catch((e) => console.error("No se pudo actualizar el contador de notificaciones", e));
  }, []);

  const cargarNotificaciones = useCallback(async () => {
    try {
      const data = await api<Bandeja>("/notificaciones?pageSize=8");
      setNotificaciones(data.items);
      setNoLeidas(data.noLeidas);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    api<Usuario>("/auth/me")
      .then((data) => { if (activo) setUsuario(data); })
      .catch((e) => console.error("No se pudo cargar el perfil", e));
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    cargarContador();
    const timer = window.setInterval(cargarContador, 60_000);
    window.addEventListener("notificaciones:actualizadas", cargarContador);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("notificaciones:actualizadas", cargarContador);
    };
  }, [cargarContador]);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (event: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(event.target as Node)) setAbierto(null);
    };
    const alTeclear = (event: KeyboardEvent) => { if (event.key === "Escape") setAbierto(null); };
    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  function alternar(panel: "perfil" | "notificaciones") {
    setError(null);
    if (abierto === panel) { setAbierto(null); return; }
    setAbierto(panel);
    if (panel === "notificaciones") void cargarNotificaciones();
  }

  async function abrirNotificacion(item: Notificacion) {
    if (!item.leidaEn) {
      try {
        await api(`/notificaciones/${item.id}`, { method: "PATCH", json: { leida: true } });
        setNoLeidas((n) => Math.max(0, n - 1));
        setNotificaciones((items) => items.map((i) => i.id === item.id ? { ...i, leidaEn: new Date().toISOString() } : i));
        window.dispatchEvent(new Event("notificaciones:actualizadas"));
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    setAbierto(null);
    router.push(item.enlace);
  }

  async function marcarTodas() {
    setOcupado(true);
    try {
      await api("/notificaciones/leer-todas", { method: "POST", json: {} });
      setNoLeidas(0);
      setNotificaciones((items) => items.map((i) => ({ ...i, leidaEn: i.leidaEn ?? new Date().toISOString() })));
      window.dispatchEvent(new Event("notificaciones:actualizadas"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const nombre = usuario?.nombreCompleto?.trim() || usuario?.username || "Mi perfil";
  const rol = usuario?.roles?.map((r) => ROLES[r] ?? r).join(" · ") || "Usuario";

  return (
    <header className="rail-top sticky top-0 z-40 border-b border-transparent backdrop-blur print:hidden md:border-[#e6ecf4]">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-6 md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 md:hidden">
          <img src="/escudo-colegio.png" alt="Escudo del colegio Manuel Scorza Torres" width="36" height="36" className="h-9 w-9 object-contain" />
          <span>
            <span className="block text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/75 md:text-[#94a3b8]">Biblioteca escolar</span>
            <span className="block text-base font-bold tracking-[-0.03em] text-white md:text-[#172b4d]">BiblioScorza</span>
          </span>
        </Link>
        <div className="hidden min-w-0 md:block">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">BiblioScorza</p>
          <p className="truncate text-sm font-semibold text-[#172b4d]">Hola, {nombre}</p>
        </div>

        <div ref={contenedor} className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button type="button" onClick={() => alternar("notificaciones")} aria-label="Notificaciones"
              aria-haspopup="true" aria-expanded={abierto === "notificaciones"}
              className="relative grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 md:text-[#35445b] md:hover:bg-[#f2f7ff]">
              <IconoCampana />
              {noLeidas > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[0.62rem] font-bold leading-[18px] text-white">
                  {noLeidas > 99 ? "99+" : noLeidas}
                </span>
              )}
            </button>

            {abierto === "notificaciones" && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#e6ecf4] bg-white shadow-[0_18px_45px_rgba(11,27,51,0.18)]">
                <div className="flex items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
                  <p className="text-sm font-semibold text-[#172b4d]">Notificaciones</p>
                  {noLeidas > 0 && (
                    <button type="button" onClick={marcarTodas} disabled={ocupado}
                      className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50">
                      Marcar todas
                    </button>
                  )}
                </div>
                <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
                  {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
                  {notificaciones.map((item) => (
                    <button key={item.id} type="button" onClick={() => abrirNotificacion(item)}
                      className={`flex w-full items-start gap-2.5 border-b border-[#f3f6fa] px-4 py-3 text-left transition hover:bg-[#f7faff] ${item.leidaEn ? "" : "bg-blue-50/60"}`}>
                      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.leidaEn ? "bg-slate-200" : "bg-brand-600"}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#172b4d]">{item.titulo}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{item.mensaje}</span>
                        <span className="mt-1 block text-[0.68rem] text-slate-400">{fechaHora(item.createdAt)}</span>
                      </span>
                    </button>
                  ))}
                  {!error && notificaciones.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">No tienes notificaciones.</p>
                  )}
                </div>
                <Link href="/notificaciones" onClick={() => setAbierto(null)}
                  className="block border-t border-[#eef2f7] px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-[#f7faff]">
                  Ver todas
                </Link>
              </div>
            )}
          </div>

          <div className="relative">
            <button type="button" onClick={() => alternar("perfil")} aria-label="Perfil"
              aria-haspopup="true" aria-expanded={abierto === "perfil"}
              className="flex items-center gap-2 rounded-full p-0.5 pr-2.5 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 md:text-[#172b4d] md:hover:bg-[#f2f7ff]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/25 md:bg-gradient-to-br md:from-[#2867d9] md:to-[#2456bd] md:ring-0">
                {iniciales(nombre) || "U"}
              </span>
              <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-white sm:block md:text-[#172b4d]">{nombre}</span>
            </button>

            {abierto === "perfil" && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-[#e6ecf4] bg-white shadow-[0_18px_45px_rgba(11,27,51,0.18)]">
                <div className="border-b border-[#eef2f7] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[#172b4d]">{nombre}</p>
                  <p className="truncate text-xs text-slate-500">{usuario?.email || usuario?.username || "—"}</p>
                  <span className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[0.68rem] font-semibold text-brand-700">{rol}</span>
                </div>
                <button type="button" onClick={salir}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-[#718096] transition hover:bg-[#f7faff] hover:text-[#172b4d]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                    strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M10 17l5-5-5-5M15 12H3" />
                    <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
