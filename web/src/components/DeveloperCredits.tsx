"use client";

import { useEffect, useRef, useState } from "react";

export default function DeveloperCredits({
  className = "",
}: {
  className?: string;
}) {
  const [mostrar, setMostrar] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mostrar && !dialog.open) dialog.showModal();
    else if (!mostrar && dialog.open) dialog.close();
  }, [mostrar]);

  return (
    <div className={className}>
      <p className="m-0">© 2026 Derechos reservados al colegio Manuel Scorza Torres.</p>
      <button
        type="button"
        className="mt-1 text-left font-medium underline decoration-current/40 underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        onClick={() => setMostrar(true)}
      >
        Conoce a los desarrolladores
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="developer-credits-title"
        onCancel={() => setMostrar(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMostrar(false);
        }}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-[#e6ecf4] bg-white p-6 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="developer-credits-title" className="text-lg font-semibold text-[#172b4d]">
              Desarrolladores
            </h2>
            <p className="mt-1 text-sm text-[#718096]">BiblioScorza</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-[#f1f5fb] hover:text-[#172b4d]"
            onClick={() => setMostrar(false)}
          >
            ×
          </button>
        </div>
        <ul className="mt-5 space-y-3 text-sm">
          <li>Ronald Franco Soto Choquehuanca</li>
          <li>Ricardo Samuel Aquino Arizapana</li>
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-[#526176]">
          Sistema creado para apoyar la gestión de la biblioteca escolar Manuel Scorza Torres.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-ghost" onClick={() => setMostrar(false)}>
            Cerrar
          </button>
        </div>
      </dialog>
    </div>
  );
}
