import Link from "next/link";

export default function CondicionesServicio() {
  return (
    <main className="min-h-dvh bg-[#f7f9fc] px-4 py-10 text-[#334155] sm:py-16">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#e6ecf4] bg-white p-6 shadow-panel sm:p-10">
        <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline">← Volver al inicio de sesión</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-700">BiblioScorza</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172b4d]">Condiciones del Servicio</h1>
        <p className="mt-3 text-sm text-slate-500">Última actualización: 7 de noviembre de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Uso del sistema</h2>
            <p className="mt-2">
              BiblioScorza es una herramienta para apoyar la administración de la biblioteca escolar del
              colegio Manuel Scorza Torres. Su uso está destinado a las actividades relacionadas con el
              catálogo, los usuarios de la biblioteca, los préstamos y las devoluciones.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Cuentas y responsabilidades</h2>
            <p className="mt-2">
              Las cuentas son para el personal autorizado. Cada usuario debe mantener la confidencialidad de
              sus credenciales, utilizar el sistema solo para sus tareas autorizadas y comunicar al personal
              responsable si sospecha que su cuenta fue utilizada sin permiso.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Registros correctos y uso adecuado</h2>
            <p className="mt-2">
              Al registrar o actualizar información, el personal debe procurar que sea correcta y utilizarla
              únicamente para la gestión de la biblioteca. No se debe intentar acceder a funciones o datos sin
              autorización, interferir con el funcionamiento del sistema ni usarlo para fines ajenos al colegio.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Disponibilidad y cambios</h2>
            <p className="mt-2">
              El sistema se ofrece como apoyo operativo y puede estar temporalmente fuera de servicio por
              mantenimiento, actualizaciones o problemas técnicos. Las funciones y estas condiciones pueden
              actualizarse para responder a las necesidades de la biblioteca y del colegio.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Ayuda</h2>
            <p className="mt-2">
              Para consultas sobre el acceso o el uso del sistema, comunícate con el personal de la biblioteca
              del colegio Manuel Scorza Torres.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
