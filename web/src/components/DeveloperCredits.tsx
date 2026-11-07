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
        className="m-auto max-h-[90dvh] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#e6ecf4] bg-white p-0 text-[#334155] shadow-panel backdrop:bg-[#0b1b33]/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e6ecf4] bg-[#f7f9fc] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                <circle cx="9" cy="8" r="3" />
                <path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1" />
              </svg>
            </span>
            <div>
              <h2 id="developer-credits-title" className="text-lg font-semibold text-[#172b4d]">
                Conoce a los desarrolladores
              </h2>
              <p className="mt-1 text-sm text-[#718096]">El equipo detrás de BiblioScorza</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-xl leading-none text-[#718096] hover:bg-white hover:text-[#172b4d]"
            onClick={() => setMostrar(false)}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <article className="rounded-xl border border-[#e6ecf4] bg-white p-4">
            <h3 className="font-semibold text-[#172b4d]">Ronald Franco Soto Choquehuanca</h3>
            <p className="mt-1 text-sm text-[#718096]">Desarrollador</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://www.linkedin.com/in/ronald-franco-soto-choquehuanca-638978399"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver LinkedIn de Ronald Franco Soto Choquehuanca"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0a66c2] px-3 text-sm font-semibold text-white transition hover:bg-[#004182] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a66c2]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.35V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.555 20.452h3.564V9H3.555v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
              <a
                href="https://www.tiktok.com/@_f_z_r_"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver TikTok de Ronald Franco Soto Choquehuanca"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#111111] px-3 text-sm font-semibold text-white transition hover:bg-[#333333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M19.589 6.686a4.793 4.793 0 0 1-3.996-4.292V1h-3.445v13.672a2.896 2.896 0 0 1-2.9 2.9 2.9 2.9 0 1 1 2.9-2.9c0-.24-.03-.473-.084-.697V10.46a6.33 6.33 0 1 0 3.529 5.67V9.162a8.176 8.176 0 0 0 4.78 1.536V7.254a4.82 4.82 0 0 1-.784-.568z" />
                </svg>
                TikTok
              </a>
              <a
                href="https://wa.me/51948696091?text=Hola%20Ronald%2C%20te%20escribo%20por%20BiblioScorza."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Escribir a Ronald Franco Soto Choquehuanca por WhatsApp"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#128c7e] px-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128c7e]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.34.13 11.91c0 2.1.55 4.16 1.6 5.97L0 24l6.27-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.91-5.34 11.92-11.91a11.84 11.84 0 0 0-3.46-8.44ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.88 9.88 0 0 1-1.52-5.28c0-5.46 4.45-9.9 9.91-9.9a9.84 9.84 0 0 1 7.01 2.9 9.85 9.85 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.93 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.1 4.5.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </article>
          <article className="rounded-xl border border-[#e6ecf4] bg-white p-4">
            <h3 className="font-semibold text-[#172b4d]">Ricardo Samuel Aquino Arizapana</h3>
            <p className="mt-1 text-sm text-[#718096]">Desarrollador</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://wa.me/51928177377?text=Hola%20Ricardo%2C%20te%20escribo%20por%20BiblioScorza."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Escribir a Ricardo Samuel Aquino Arizapana por WhatsApp"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#128c7e] px-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128c7e]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.34.13 11.91c0 2.1.55 4.16 1.6 5.97L0 24l6.27-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.91-5.34 11.92-11.91a11.84 11.84 0 0 0-3.46-8.44ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.88 9.88 0 0 1-1.52-5.28c0-5.46 4.45-9.9 9.91-9.9a9.84 9.84 0 0 1 7.01 2.9 9.85 9.85 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.93 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.1 4.5.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </article>
          <article className="rounded-xl border border-[#e6ecf4] bg-white p-4">
            <h3 className="font-semibold text-[#172b4d]">Darwin</h3>
            <p className="mt-1 text-sm text-[#718096]">Desarrollador</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://wa.me/51952112451?text=Hola%20Darwin%2C%20te%20escribo%20por%20BiblioScorza."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Escribir a Darwin por WhatsApp"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#128c7e] px-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128c7e]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.34.13 11.91c0 2.1.55 4.16 1.6 5.97L0 24l6.27-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.91-5.34 11.92-11.91a11.84 11.84 0 0 0-3.46-8.44ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.88 9.88 0 0 1-1.52-5.28c0-5.46 4.45-9.9 9.91-9.9a9.84 9.84 0 0 1 7.01 2.9 9.85 9.85 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.93 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.1 4.5.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </article>
          <p className="text-sm leading-relaxed text-[#718096]">
            Sistema creado para apoyar la gestión de la biblioteca escolar Manuel Scorza Torres.
          </p>
          <div className="flex justify-end border-t border-[#e6ecf4] pt-4">
            <button type="button" className="btn-ghost" onClick={() => setMostrar(false)}>
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
