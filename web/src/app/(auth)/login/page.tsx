"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Msg } from "@/components/ui";
import LoginCharacters from "./login-characters";
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
  const [usuarioActivo, setUsuarioActivo] = useState(false);
  const [passwordActivo, setPasswordActivo] = useState(false);
  const [campoInvalido, setCampoInvalido] = useState(false);
  const mood = mostrarPassword ? "shy" : err || campoInvalido ? "angry" : passwordActivo ? "password" : usuarioActivo ? "surprised" : "happy";

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
            <div className="login-brand-mark">
              <img
                src="/escudo-colegio.png"
                alt="Escudo del colegio Manuel Scorza Torres"
                width="136"
                height="136"
              />
            </div>
            <p className="login-eyebrow">Biblioteca escolar</p>
            <h1 className="login-title">BiblioScorza</h1>
            <p className="login-brand-copy">
              Un espacio para organizar, descubrir y compartir historias.
            </p>
          </div>
          <LoginCharacters mood={mood} />
          <p className="login-brand-caption">Tu biblioteca, siempre cerca.</p>
        </aside>

        <section className="login-panel" aria-labelledby="login-heading">
          <form
            onSubmit={enviar}
            onInvalid={() => setCampoInvalido(true)}
            onChange={() => { setCampoInvalido(false); setErr(""); }}
            className="login-card"
          >
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
                autoComplete="username"
                placeholder="Escribe tu usuario"
                value={f.username}
                onFocus={() => setUsuarioActivo(true)}
                onBlur={() => setUsuarioActivo(false)}
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
                  onFocus={() => setPasswordActivo(true)}
                  onBlur={() => setPasswordActivo(false)}
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
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {mostrarPassword ? (
                      <>
                        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.1 0 9.5 7 9.5 7a16.6 16.6 0 0 1-4.1 5.1M6.2 6.2A16.7 16.7 0 0 0 2.5 12s3.4 6 9.5 6c1.1 0 2.1-.1 3-.4" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <Link
                className="login-forgot"
                href={
                  f.username.trim()
                    ? `/recuperar-password?usuario=${encodeURIComponent(f.username.trim())}`
                    : "/recuperar-password"
                }
              >
                ¿Olvidaste la contraseña?
              </Link>
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
            <Link className="login-library-button" href="/biblioteca">
              Ver biblioteca
            </Link>
          </form>
          <p className="login-copyright">
            © 2026 Derechos reservados al colegio Manuel Scorza Torres, R.R.R.H.Y.
          </p>
        </section>
      </div>
    </main>
  );
}
