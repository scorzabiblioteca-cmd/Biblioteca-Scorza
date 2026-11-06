import Link from "next/link";

const TABS = [
  { href: "/prestamos", label: "Préstamos" },
  { href: "/devoluciones", label: "Devoluciones" },
] as const;

export default function PrestamosDevolucionesTabs({ actual }: { actual: "prestamos" | "devoluciones" }) {
  return (
    <nav aria-label="Cambiar entre préstamos y devoluciones" className="mb-5 inline-flex rounded-xl border border-[#e6ecf4] bg-white p-1">
      {TABS.map(({ href, label }) => {
        const seleccionado = actual === (href === "/prestamos" ? "prestamos" : "devoluciones");
        return (
          <Link
            key={href}
            href={href}
            aria-current={seleccionado ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
              seleccionado ? "bg-brand-600 text-white" : "text-[#526176] hover:bg-[#f1f5fb] hover:text-[#172b4d]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
