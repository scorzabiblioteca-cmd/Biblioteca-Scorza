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
      <form onSubmit={enviar} className="login-card">

        <div>
          <h1 className="login-title">
            BiblioScorza
          </h1>

          <p className="login-subtitle">
            Ingresa con tu usuario de biblioteca
          </p>
        </div>

        <label>
          <span className="login-label">
            Usuario
          </span>

          <input
            className="login-input"
            autoFocus
            autoComplete="username"
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

        <label>
          <span className="login-label">
            Contraseña
          </span>

          <input
            className="login-input"
            type="password"
            autoComplete="current-password"
            value={f.password}
            onChange={(e) =>
              setF({
                ...f,
                password: e.target.value,
              })
            }
            required
          />
        </label>

        {err && (
          <div className="login-error">
            <Msg type="error">{err}</Msg>
          </div>
        )}

        <button
          className="login-button"
          disabled={busy}
        >
          {busy ? "Ingresando…" : "Ingresar"}
        </button>

      </form>
    </main>
  );
}