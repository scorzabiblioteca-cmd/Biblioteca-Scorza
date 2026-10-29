"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Msg } from "@/components/ui";
import LoginCharacters from "../login/login-characters";
import "../login/login.css";

type Paso = "solicitar" | "codigo" | "cambiar" | "listo";

const TITULOS: Record<Paso, { titulo: string; subtitulo: string }> = {
  solicitar: {
    titulo: "Recuperar contraseña",
    subtitulo: "Escribe tu usuario de biblioteca. Enviaremos un código de verificación al correo de la institución.",
  },
  codigo: {
    titulo: "Verifica el código",
    subtitulo: "El código de 6 dígitos se envió a scorzabiblioteca@gmail.com. Solicítalo al personal de biblioteca e ingrésalo aquí.",
  },
  cambiar: {
    titulo: "Nueva contraseña",
    subtitulo: "Elige una contraseña de al menos 8 caracteres y confírmala.",
  },
  listo: {
    titulo: "Contraseña actualizada",
    subtitulo: "Ya puedes ingresar con tu nueva contraseña.",
  },
};

function Contenido() {
  const sp = useSearchParams();
  const [paso, setPaso] = useState<Paso>("solicitar");
  const [username, setUsername] = useState(() => sp.get("usuario")?.trim() ?? "");
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [passwordActivo, setPasswordActivo] = useState(false);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);

  const mood = err ? "angry" : mostrarPassword ? "shy" : passwordActivo ? "password" : paso === "codigo" ? "surprised" : "happy";
  const { titulo, subtitulo } = TITULOS[paso];

  async function solicitar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username.trim()) {
      setErr("Escribe tu usuario");
      return;
    }
    setBusy(true);
    setErr("");
    setAviso("");
    try {
      await api("/auth/forgot-password", { json: { username: username.trim() } });
      setAviso("Si el usuario existe, enviamos un código de 6 dígitos al correo de la biblioteca.");
      setCodigo("");
      setPaso("codigo");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) {
      setErr("El código debe tener 6 dígitos.");
      return;
    }
    setBusy(true);
    setErr("");
    setAviso("");
    try {
      const { ticket: t } = await api<{ ticket: string }>("/auth/verify-reset-code", {
        json: { username: username.trim(), codigo },
      });
      setTicket(t);
      setPassword("");
      setConfirmar("");
      setPaso("cambiar");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api("/auth/reset-password", { json: { ticket, password } });
      setPaso("listo");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function cambiarUsuario() {
    setPaso("solicitar");
    setCodigo("");
    setErr("");
    setAviso("");
  }

  return (
    <main className="login-page login-page--scroll">
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

        <section className="login-panel" aria-labelledby="recuperar-heading">
          {paso === "solicitar" && (
            <form onSubmit={solicitar} className="login-card">
              <div className="login-heading">
                <p className="login-kicker">Recuperación de acceso</p>
                <h2 id="recuperar-heading">{titulo}</h2>
                <p className="login-subtitle">{subtitulo}</p>
              </div>

              <label className="login-field" htmlFor="recuperar-username">
                <span className="login-label">Usuario</span>
                <input
                  id="recuperar-username"
                  className="login-input"
                  autoComplete="username"
                  placeholder="Escribe tu usuario"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErr("");
                  }}
                  required
                  autoFocus
                />
              </label>

              {err && (
                <div className="login-error" aria-live="polite">
                  <Msg type="error">{err}</Msg>
                </div>
              )}

              <button className="login-button" type="submit" disabled={busy} aria-busy={busy}>
                {busy && <span className="login-spinner" aria-hidden="true" />}
                {busy ? "Enviando…" : "Enviar código"}
              </button>

              <Link className="login-back" href="/login">
                Volver al inicio de sesión
              </Link>
            </form>
          )}

          {paso === "codigo" && (
            <form onSubmit={verificar} className="login-card">
              <div className="login-heading">
                <p className="login-kicker">Recuperación de acceso</p>
                <h2 id="recuperar-heading">{titulo}</h2>
                <p className="login-subtitle">{subtitulo}</p>
              </div>

              <p className="login-user-chip">
                Usuario: <strong>{username}</strong>
                <button type="button" className="login-link-button" onClick={cambiarUsuario}>
                  Cambiar
                </button>
              </p>

              {aviso && (
                <div aria-live="polite">
                  <Msg type="ok">{aviso}</Msg>
                </div>
              )}

              <label className="login-field" htmlFor="recuperar-codigo">
                <span className="login-label">Código de verificación</span>
                <input
                  id="recuperar-codigo"
                  className="login-input login-code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setErr("");
                  }}
                  required
                  autoFocus
                />
              </label>

              {err && (
                <div className="login-error" aria-live="polite">
                  <Msg type="error">{err}</Msg>
                </div>
              )}

              <button className="login-button" type="submit" disabled={busy} aria-busy={busy}>
                {busy && <span className="login-spinner" aria-hidden="true" />}
                {busy ? "Verificando…" : "Verificar código"}
              </button>

              <button type="button" className="login-link-button login-link-button--center" onClick={() => solicitar()} disabled={busy}>
                Reenviar código
              </button>

              <Link className="login-back" href="/login">
                Volver al inicio de sesión
              </Link>
            </form>
          )}

          {paso === "cambiar" && (
            <form onSubmit={guardar} className="login-card">
              <div className="login-heading">
                <p className="login-kicker">Recuperación de acceso</p>
                <h2 id="recuperar-heading">{titulo}</h2>
                <p className="login-subtitle">{subtitulo}</p>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="recuperar-password">
                  Nueva contraseña
                </label>
                <div className="login-password-field">
                  <input
                    id="recuperar-password"
                    className="login-input"
                    type={mostrarPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Escribe tu nueva contraseña"
                    value={password}
                    onFocus={() => setPasswordActivo(true)}
                    onBlur={() => setPasswordActivo(false)}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErr("");
                    }}
                    required
                    autoFocus
                  />
                  <button
                    className="login-password-toggle"
                    type="button"
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={mostrarPassword}
                    onClick={() => setMostrarPassword((m) => !m)}
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
              </div>

              <label className="login-field" htmlFor="recuperar-confirmar">
                <span className="login-label">Confirmar contraseña</span>
                <input
                  id="recuperar-confirmar"
                  className="login-input"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repite tu nueva contraseña"
                  value={confirmar}
                  onChange={(e) => {
                    setConfirmar(e.target.value);
                    setErr("");
                  }}
                  required
                />
              </label>

              {err && (
                <div className="login-error" aria-live="polite">
                  <Msg type="error">{err}</Msg>
                </div>
              )}

              <button className="login-button" type="submit" disabled={busy} aria-busy={busy}>
                {busy && <span className="login-spinner" aria-hidden="true" />}
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>

              <Link className="login-back" href="/login">
                Volver al inicio de sesión
              </Link>
            </form>
          )}

          {paso === "listo" && (
            <div className="login-card">
              <div className="login-heading">
                <p className="login-kicker">Recuperación de acceso</p>
                <h2 id="recuperar-heading">{titulo}</h2>
                <p className="login-subtitle">{subtitulo}</p>
              </div>

              <Msg type="ok">Tu contraseña se actualizó correctamente.</Msg>

              <Link className="login-button" href="/login">
                Iniciar sesión
              </Link>
            </div>
          )}

          <p className="login-copyright">
            © 2026 Derechos reservados al colegio Manuel Scorza Torres, R.R.R.H.Y.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function RecuperarPassword() {
  return (
    <Suspense fallback={null}>
      <Contenido />
    </Suspense>
  );
}
