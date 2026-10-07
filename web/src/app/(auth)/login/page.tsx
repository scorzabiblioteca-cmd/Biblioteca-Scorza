"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Msg } from "@/components/ui";
import "./login.css";

export default function Login() {
  const router = useRouter();

  const [f, setF] = useState({
    username: "",
    password: "",
  });

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");

    try {
      await api("/auth/login", { json: f });
      router.push("/dashboard");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-brand" aria-label="BiblioScorza">
          <div className="login-brand-content">
            <div className="login-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <path d="M8 12.5c6.2-.9 11.5.4 16 3.8v23c-4.5-3.4-9.8-4.7-16-3.8v-23Z" />
                <path d="M40 12.5c-6.2-.9-11.5.4-16 3.8v23c4.5-3.4 9.8-4.7 16-3.8v-23Z" />
                <path d="M24 16.3v23" />
              </svg>
            </div>
            <p className="login-eyebrow">Biblioteca escolar</p>
            <h1 className="login-title">BiblioScorza</h1>
            <p className="login-brand-copy">
              Un espacio para organizar, descubrir y compartir historias.
            </p>
          </div>
          <div className="login-brand-art" aria-hidden="true">
            <span className="login-book login-book-one" />
            <span className="login-book login-book-two" />
            <span className="login-book login-book-three" />
          </div>
          <p className="login-brand-caption">Tu biblioteca, siempre cerca.</p>
        </aside>

        <section className="login-panel" aria-labelledby="login-heading">
          <form onSubmit={enviar} className="login-card">
            <div className="login-heading">
              <p className="login-kicker">Acceso al sistema</p>
              <h2 id="login-heading">Bienvenido/a</h2>
              <p className="login-subtitle">
                Ingresa con tu usuario de biblioteca para continuar.
              </p>
            </div>

            <label className="login-field" htmlFor="login-username">
              <span className="login-label">Usuario</span>
              <input
                id="login-username"
                className="login-input"
                autoFocus
                autoComplete="username"
                placeholder="Escribe tu usuario"
                value={f.username}
                onChange={(e) =>
                  setF({
                    ...f,
                    username: e.target.value,
                  })
                }
                required
              />
            </label>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Contraseña
              </label>
              <div className="login-password-field">
                <input
                  id="login-password"
                  className="login-input"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Escribe tu contraseña"
                  value={f.password}
                  onChange={(e) =>
                    setF({
                      ...f,
                      password: e.target.value,
                    })
                  }
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={mostrarPassword}
                  onClick={() => setMostrarPassword((mostrar) => !mostrar)}
                >
                  {mostrarPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {err && (
              <div className="login-error" aria-live="polite">
                <Msg type="error">{err}</Msg>
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={busy}
              aria-busy={busy}
            >
              {busy && <span className="login-spinner" aria-hidden="true" />}
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
            <p className="login-help">
              ¿Necesitas ayuda? Comunícate con el equipo de biblioteca.
            </p>
          </form>
          <p className="login-copyright">Sistema de gestión de biblioteca escolar</p>
        </section>
      </div>
    </main>
  );
}