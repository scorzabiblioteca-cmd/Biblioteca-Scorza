import Link from "next/link";

export default function PoliticaPrivacidad() {
  return (
    <main className="min-h-dvh bg-[#f7f9fc] px-4 py-10 text-[#334155] sm:py-16">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#e6ecf4] bg-white p-6 shadow-panel sm:p-10">
        <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline">← Volver al inicio de sesión</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-brand-700">BiblioScorza</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172b4d]">Política de Privacidad</h1>
        <p className="mt-3 text-sm text-slate-500">Última actualización: 7 de noviembre de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Responsable y alcance</h2>
            <p className="mt-2">
              BiblioScorza es el sistema de gestión de la biblioteca escolar del colegio Manuel Scorza Torres.
              Esta política explica cómo se utiliza la información ingresada en el sistema para administrar
              el catálogo y los préstamos de la biblioteca.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Información que se utiliza</h2>
            <p className="mt-2">
              El sistema puede almacenar datos de identificación y contacto de alumnos y profesores, como
              nombres, apellidos, DNI, código de alumno, grado, sección, área, teléfono y correo. También
              registra cuentas del personal autorizado, préstamos, devoluciones e información del catálogo.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Uso de la información</h2>
            <p className="mt-2">
              Estos datos se utilizan para identificar a los usuarios de la biblioteca, registrar y dar
              seguimiento a los préstamos y devoluciones, mantener el catálogo y proteger el acceso al sistema.
              Si se solicita recuperar una contraseña, el sistema envía un código temporal al correo
              institucional configurado para la biblioteca.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Acceso, conservación y seguridad</h2>
            <p className="mt-2">
              El acceso a los registros está destinado al personal autorizado para las tareas de la biblioteca.
              La información se conserva mientras sea necesaria para la gestión del servicio y de acuerdo con
              los procedimientos del colegio. Se aplican controles de acceso al sistema; ningún sistema
              conectado a internet puede garantizar seguridad absoluta.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#172b4d]">Consultas</h2>
            <p className="mt-2">
              Para solicitar información sobre los datos registrados o comunicar una inquietud relacionada
              con esta política, dirígete al personal de la biblioteca del colegio Manuel Scorza Torres.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
